use anyhow::Result;
use tokio::io::AsyncReadExt;
use tokio::net::TcpStream;
use tokio::sync::{mpsc, watch};

use crate::protocol::types::{ConsoleMessage, PowerData, VersionInfo};

/// Reads console output from the roboRIO TCP stream (port 1740)
///
/// TCP framing: Size(2 BE) + Tag(1) + Data(variable)
///   Size = length of (tag + data), NOT including the size field itself
///
/// Tags (roboRIO → DS):
///   0x0C = Standard Output: timestamp(4 f32) + seqnum(2 u16) + message(n)
///   0x0B = Error Message:   timestamp(4 f32) + seqnum(2 u16) + unknown(2)
///                           + error_code(4 i32) + flags(1) + details(2+n)
///                           + location(2+n) + callstack(2+n)
///   0x0A = Version Info: image(2+n) + wpilib(2+n) + rio(2+n)
///   0x00 = Radio Events
///   0x04 = Disable Faults: comms(2 u16) + 12v(2 u16)
///   0x05 = Rail Faults: 6v(2 u16) + 5v(2 u16) + 3.3v(2 u16)
pub async fn console_log_listener(
    mut target_ip_rx: watch::Receiver<String>,
    log_tx: mpsc::Sender<ConsoleMessage>,
    power_tx: mpsc::Sender<PowerData>,
    mut shutdown_rx: watch::Receiver<bool>,
    version_tx: mpsc::Sender<VersionInfo>,
) {
    loop {
        if *shutdown_rx.borrow() {
            return;
        }

        let addr = format!("{}:1740", *target_ip_rx.borrow());
        tracing::info!("Attempting TCP console connection to {addr}");

        let stream = tokio::select! {
            result = TcpStream::connect(&addr) => {
                match result {
                    Ok(s) => s,
                    Err(e) => {
                        tracing::trace!("TCP console connect failed: {e}");
                        // Wait for IP change or retry after 2s
                        tokio::select! {
                            _ = target_ip_rx.changed() => continue,
                            _ = tokio::time::sleep(std::time::Duration::from_secs(2)) => continue,
                            _ = shutdown_rx.changed() => return,
                        }
                    }
                }
            }
            _ = target_ip_rx.changed() => continue,
            _ = shutdown_rx.changed() => return,
        };

        tracing::info!("Connected to roboRIO console at {addr}");

        if let Err(e) = read_console_stream(stream, &log_tx, &power_tx, &mut shutdown_rx, &mut target_ip_rx, &version_tx).await {
            tracing::warn!("Console stream error: {e}");
        }

        tracing::info!("Console connection lost, reconnecting...");
        tokio::time::sleep(std::time::Duration::from_secs(1)).await;
    }
}

/// Read a length-prefixed string: 2-byte BE length + UTF-8 bytes
fn read_prefixed_string(data: &[u8], offset: usize) -> Option<(String, usize)> {
    if offset + 2 > data.len() {
        return None;
    }
    let len = u16::from_be_bytes([data[offset], data[offset + 1]]) as usize;
    let start = offset + 2;
    if start + len > data.len() {
        return None;
    }
    let s = String::from_utf8_lossy(&data[start..start + len])
        .trim_end()
        .to_string();
    Some((s, start + len))
}

async fn read_console_stream(
    mut stream: TcpStream,
    log_tx: &mpsc::Sender<ConsoleMessage>,
    power_tx: &mpsc::Sender<PowerData>,
    shutdown_rx: &mut watch::Receiver<bool>,
    target_ip_rx: &mut watch::Receiver<String>,
    version_tx: &mpsc::Sender<VersionInfo>,
) -> Result<()> {
    // Accumulate power data across tags (0x04 and 0x05 arrive separately)
    let mut power = PowerData::default();

    loop {
        // Read size (2 bytes big endian)
        let size = tokio::select! {
            result = stream.read_u16() => result?,
            _ = shutdown_rx.changed() => return Ok(()),
            _ = target_ip_rx.changed() => {
                tracing::info!("Target IP changed, dropping TCP console connection");
                return Ok(());
            }
        };

        if size == 0 || size > 32768 {
            continue;
        }

        let mut payload = vec![0u8; size as usize];
        tokio::select! {
            result = stream.read_exact(&mut payload) => result?,
            _ = shutdown_rx.changed() => return Ok(()),
            _ = target_ip_rx.changed() => {
                tracing::info!("Target IP changed, dropping TCP console connection");
                return Ok(());
            }
        };

        if payload.is_empty() {
            continue;
        }

        let tag = payload[0];
        let data = &payload[1..];

        match tag {
            // Standard Output (0x0C): timestamp(4 f32) + seqnum(2) + message
            0x0C => {
                if data.len() >= 6 {
                    let timestamp = f32::from_be_bytes([
                        data[0], data[1], data[2], data[3],
                    ]) as f64;
                    let sequence = u16::from_be_bytes([data[4], data[5]]);
                    let message = String::from_utf8_lossy(&data[6..])
                        .trim_end()
                        .to_string();

                    if !message.is_empty() {
                        let _ = log_tx.send(ConsoleMessage {
                            timestamp,
                            message,
                            is_error: false,
                            sequence,
                        }).await;
                    }
                }
            }
            // Error Message (0x0B): timestamp(4) + seqnum(2) + unknown(2) + error_code(4)
            //   + flags(1) + details(2+n) + location(2+n) + callstack(2+n)
            0x0B => {
                if data.len() >= 13 {
                    let timestamp = f32::from_be_bytes([
                        data[0], data[1], data[2], data[3],
                    ]) as f64;
                    let sequence = u16::from_be_bytes([data[4], data[5]]);
                    // data[6..8] = unknown (2 bytes)
                    // data[8..12] = error_code (4 bytes i32)
                    let flags = data[12];
                    let is_error = (flags & 0x01) != 0;

                    // Parse length-prefixed strings: Details, Location, Call Stack
                    let mut offset = 13;
                    let details = read_prefixed_string(data, offset);
                    if let Some((ref _s, next)) = details {
                        offset = next;
                    }
                    let location = read_prefixed_string(data, offset);
                    if let Some((ref _s, next)) = location {
                        offset = next;
                    }
                    let callstack = read_prefixed_string(data, offset);

                    // Build a readable message from the structured fields
                    let details_str = details.map(|(s, _)| s).unwrap_or_default();
                    let location_str = location.map(|(s, _)| s).unwrap_or_default();
                    let callstack_str = callstack.map(|(s, _)| s).unwrap_or_default();

                    let mut message = details_str;
                    if !location_str.is_empty() {
                        message = format!("{message} @ {location_str}");
                    }
                    if !callstack_str.is_empty() {
                        message = format!("{message}\n{callstack_str}");
                    }

                    if !message.is_empty() {
                        let _ = log_tx.send(ConsoleMessage {
                            timestamp,
                            message,
                            is_error,
                            sequence,
                        }).await;
                    }
                } else if data.len() >= 6 {
                    // Fallback: treat like stdout format
                    let timestamp = f32::from_be_bytes([
                        data[0], data[1], data[2], data[3],
                    ]) as f64;
                    let sequence = u16::from_be_bytes([data[4], data[5]]);
                    let message = String::from_utf8_lossy(&data[6..])
                        .trim_end()
                        .to_string();

                    if !message.is_empty() {
                        let _ = log_tx.send(ConsoleMessage {
                            timestamp,
                            message,
                            is_error: true,
                            sequence,
                        }).await;
                    }
                }
            }
            // Disable Faults (0x04): comms(2 u16 BE) + 12v(2 u16 BE)
            0x04 => {
                if data.len() >= 4 {
                    power.disable_count_comms = u16::from_be_bytes([data[0], data[1]]);
                    power.disable_count_12v = u16::from_be_bytes([data[2], data[3]]);
                    let _ = power_tx.send(power.clone()).await;
                }
            }
            // Rail Faults (0x05): 6v(2 u16 BE) + 5v(2 u16 BE) + 3.3v(2 u16 BE)
            0x05 => {
                if data.len() >= 6 {
                    power.rail_faults_6v = u16::from_be_bytes([data[0], data[1]]);
                    power.rail_faults_5v = u16::from_be_bytes([data[2], data[3]]);
                    power.rail_faults_3v3 = u16::from_be_bytes([data[4], data[5]]);
                    let _ = power_tx.send(power.clone()).await;
                }
            }
            // Version Info (0x0A): image(2+n) + wpilib(2+n) + rio(2+n)
            0x0A => {
                let mut offset = 0;
                let image = read_prefixed_string(data, offset);
                if let Some((ref _s, next)) = image {
                    offset = next;
                }
                let wpilib = read_prefixed_string(data, offset);
                if let Some((ref _s, next)) = wpilib {
                    offset = next;
                }
                let rio = read_prefixed_string(data, offset);

                let info = VersionInfo {
                    image_version: image.map(|(s, _)| s).unwrap_or_default(),
                    wpilib_version: wpilib.map(|(s, _)| s).unwrap_or_default(),
                    rio_version: rio.map(|(s, _)| s).unwrap_or_default(),
                };
                tracing::info!("Version info: image={}, wpilib={}, rio={}", info.image_version, info.wpilib_version, info.rio_version);
                let _ = version_tx.send(info).await;
            }
            // Other tags — log for debugging but don't display
            other => {
                if !data.is_empty() {
                    tracing::debug!("TCP tag 0x{other:02X}, {} bytes", data.len());
                }
            }
        }
    }
}
