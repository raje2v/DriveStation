use std::net::SocketAddr;
use std::sync::Arc;
use std::time::{Instant, SystemTime, UNIX_EPOCH};

use byteorder::{BigEndian, WriteBytesExt};
use parking_lot::RwLock;
use serde::{Deserialize, Serialize};
use tokio::net::UdpSocket;
use tokio::sync::mpsc;

use super::types::*;

/// Convert days since Unix epoch to (year, month, day)
fn days_to_date(days: u64) -> (u16, u8, u8) {
    // Civil calendar algorithm from Howard Hinnant
    let z = days as i64 + 719468;
    let era = z.div_euclid(146097);
    let doe = z.rem_euclid(146097) as u64;
    let yoe = (doe - doe / 1460 + doe / 36524 - doe / 146096) / 365;
    let y = (yoe as i64 + era * 400) as u16;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let d = (doy - (153 * mp + 2) / 5 + 1) as u8;
    let m = if mp < 10 { mp + 3 } else { mp - 9 } as u8;
    let y = if m <= 2 { y + 1 } else { y };
    (y, m, d)
}

/// Builds the DS→Robot UDP packet (sent to port 1110 every 20ms)
fn build_outbound_packet(
    seq: u16,
    state: &DsState,
    joysticks: &[JoystickState],
) -> Vec<u8> {
    let mut pkt = Vec::with_capacity(64);

    // Bytes 0-1: Sequence number (uint16 big endian)
    pkt.extend_from_slice(&seq.to_be_bytes());

    // Byte 2: Comm version tag
    pkt.push(0x01);

    // Byte 3: Control byte
    let mut control: u8 = 0;
    if state.estop {
        control |= 0x80; // bit 7: E-Stop
    }
    if state.enabled {
        control |= 0x04; // bit 2: Enabled
    }
    control |= state.mode.to_bits(); // bits 0-1: Mode
    pkt.push(control);

    // Byte 4: Request byte
    let mut request: u8 = 0;
    if state.request_reboot {
        request |= 0x08; // bit 3: Reboot
    }
    if state.request_restart_code {
        request |= 0x04; // bit 2: Restart code
    }
    pkt.push(request);

    // Byte 5: Alliance station
    pkt.push(state.alliance.to_byte());

    // Joystick tags (tag 0x0C)
    // Tag format: [size][id][data...] where size = len(id + data), NOT including size byte itself
    for js in joysticks.iter().take(6) {
        let num_buttons = js.buttons.len();
        let button_bytes = (num_buttons + 7) / 8;
        // data = axes_count(1) + axes + button_count(1) + button_bytes + pov_count(1) + povs*2
        let data_size = 1 + js.axes.len() + 1 + button_bytes + 1 + js.povs.len() * 2;
        // size field = id(1) + data
        let tag_size: u8 = (1 + data_size) as u8;

        pkt.push(tag_size); // Size (includes id byte + data)
        pkt.push(0x0C);     // Tag ID: Joystick

        // Axes
        pkt.push(js.axes.len() as u8);
        for &axis in &js.axes {
            // Convert f32 (-1.0..1.0) to i8 (-128..127)
            let val = (axis * 127.0).clamp(-128.0, 127.0) as i8;
            pkt.push(val as u8);
        }

        // Buttons (packed as bits)
        pkt.push(num_buttons as u8);
        for byte_idx in 0..button_bytes {
            let mut byte: u8 = 0;
            for bit in 0..8 {
                let btn_idx = byte_idx * 8 + bit;
                if btn_idx < num_buttons && js.buttons[btn_idx] {
                    byte |= 1 << (7 - bit);
                }
            }
            pkt.push(byte);
        }

        // POVs
        pkt.push(js.povs.len() as u8);
        for &pov in &js.povs {
            let _ = (&mut pkt as &mut Vec<u8>).write_i16::<BigEndian>(pov);
        }
    }

    // Date/time tag (tag 0x0F) - sent periodically
    // Tag format: [size][id][data...]
    if seq % 50 == 0 {
        if let Ok(dur) = SystemTime::now().duration_since(UNIX_EPOCH) {
            let secs = dur.as_secs();
            let micros = dur.subsec_micros();
            // Simple time decomposition (UTC)
            let sec = (secs % 60) as u8;
            let min = ((secs / 60) % 60) as u8;
            let hour = ((secs / 3600) % 24) as u8;
            // Days since epoch for date (approximate, sufficient for protocol)
            let days = (secs / 86400) as u64;
            // Simple Gregorian calendar decomposition
            let (year, month, day) = days_to_date(days);

            // DateTime data: micros(4) + sec(1) + min(1) + hour(1) + day(1) + month(1) + year(1) = 10 bytes
            pkt.push(11);   // Size: id(1) + data(10)
            pkt.push(0x0F); // Tag ID: DateTime
            let _ = (&mut pkt as &mut Vec<u8>).write_u32::<BigEndian>(micros);
            pkt.push(sec);
            pkt.push(min);
            pkt.push(hour);
            pkt.push(day);
            pkt.push(month.wrapping_sub(1)); // 0-indexed month
            pkt.push((year.wrapping_sub(1900)) as u8);
        }
    }

    pkt
}

/// Parses Robot→DS UDP packet (from port 1150)
fn parse_inbound_packet(data: &[u8], robot_state: &mut RobotState, diag: &mut DiagnosticData) {
    if data.len() < 7 {
        return;
    }

    // Bytes 0-1: Sequence number
    robot_state.sequence_number = u16::from_be_bytes([data[0], data[1]]);

    // Byte 3: Status byte
    let status = data[3];
    robot_state.estopped = (status & 0x80) != 0;
    robot_state.brownout = (status & 0x10) != 0;
    robot_state.enabled = (status & 0x04) != 0;
    robot_state.mode = Mode::from_bits(status);

    // Byte 4: Trace byte (robot code flags)
    let trace = data[4];
    robot_state.code_running = (trace & 0x20) != 0;

    // Bytes 5-6: Battery voltage (integer + fractional/256)
    robot_state.battery_voltage = data[5] as f32 + (data[6] as f32 / 256.0);

    robot_state.connected = true;

    // Parse tags starting at byte 8
    // Tag format: [size][id][data...] where size = len(id + data)
    let mut i = 8;
    while i < data.len() {
        let size = data[i] as usize;
        if size == 0 || i + 1 + size > data.len() {
            break;
        }
        let tag = data[i + 1];
        let tag_data = &data[i + 2..i + 1 + size];

        match tag {
            0x04 => {
                // Disk usage
                if tag_data.len() >= 4 {
                    diag.disk_usage = u32::from_be_bytes([
                        tag_data[0], tag_data[1], tag_data[2], tag_data[3],
                    ]) as f32;
                }
            }
            0x05 => {
                // CPU usage
                if tag_data.len() >= 12 {
                    // CPU count + per-core usage as float
                    let num_cpus = tag_data[0] as usize;
                    if num_cpus > 0 && tag_data.len() >= 1 + num_cpus * 4 {
                        let mut total = 0.0f32;
                        for c in 0..num_cpus {
                            let offset = 1 + c * 4;
                            let cpu = f32::from_bits(u32::from_be_bytes([
                                tag_data[offset],
                                tag_data[offset + 1],
                                tag_data[offset + 2],
                                tag_data[offset + 3],
                            ]));
                            total += cpu;
                        }
                        diag.cpu_usage = total / num_cpus as f32;
                    }
                }
            }
            0x06 => {
                // RAM usage
                if tag_data.len() >= 4 {
                    diag.ram_usage = f32::from_bits(u32::from_be_bytes([
                        tag_data[0], tag_data[1], tag_data[2], tag_data[3],
                    ]));
                }
            }
            0x0E => {
                // CAN metrics
                if tag_data.len() >= 14 {
                    diag.can_utilization =
                        f32::from_bits(u32::from_be_bytes([
                            tag_data[0], tag_data[1], tag_data[2], tag_data[3],
                        ]));
                    diag.can_bus_off =
                        u32::from_be_bytes([tag_data[4], tag_data[5], tag_data[6], tag_data[7]]);
                    diag.can_tx_full =
                        u32::from_be_bytes([tag_data[8], tag_data[9], tag_data[10], tag_data[11]]);
                    // More CAN fields if available
                }
            }
            _ => {} // Unknown tag, skip
        }

        // Advance past this tag: size_byte(1) + size
        i += 1 + size;
    }
}

/// Internal state of the driver station control loop
pub struct DsState {
    pub mode: Mode,
    pub enabled: bool,
    pub estop: bool,
    pub alliance: Alliance,
    pub request_reboot: bool,
    pub request_restart_code: bool,
}

impl Default for DsState {
    fn default() -> Self {
        Self {
            mode: Mode::Teleoperated,
            enabled: false,
            estop: false,
            alliance: Alliance::Red1,
            request_reboot: false,
            request_restart_code: false,
        }
    }
}

/// Commands sent from the frontend to the protocol loop
#[derive(Debug)]
pub enum DsCommand {
    SetTeamNumber(u32),
    SetMode(Mode),
    Enable,
    Disable,
    EStop,
    SetAlliance(Alliance),
    RebootRio,
    RestartCode,
    SetTargetIp(String),
}

/// Events emitted from the protocol loop to the frontend
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum DsEvent {
    RobotState(RobotState),
    Diagnostics(DiagnosticData),
    Console(ConsoleMessage),
    GamepadUpdate(GamepadUpdate),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GamepadUpdate {
    pub gamepads: Vec<GamepadInfo>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GamepadInfo {
    pub id: usize,
    pub name: String,
    pub slot: usize,
    pub axes: Vec<f32>,
    pub buttons: Vec<bool>,
    pub povs: Vec<i16>,
}

/// Resolves the target IP for a given team number
pub fn team_to_ip(team: u32) -> String {
    if team == 0 {
        // Simulation mode — connect to localhost
        return "127.0.0.1".to_string();
    }
    let te = team / 100;
    let am = team % 100;
    format!("10.{te}.{am}.2")
}

/// The main protocol loop, run as a Tokio task
pub async fn protocol_loop(
    mut cmd_rx: mpsc::Receiver<DsCommand>,
    event_tx: mpsc::Sender<DsEvent>,
    joystick_state: Arc<RwLock<Vec<JoystickState>>>,
) {
    let mut _team_number: u32 = 0;
    let mut target_ip = team_to_ip(0);
    let mut ds_state = DsState::default();
    let mut robot_state = RobotState::default();
    let mut diag = DiagnosticData::default();
    let mut sequence: u16 = 0;
    let mut last_recv = Instant::now();
    let mut send_socket: Option<UdpSocket> = None;
    let mut recv_socket: Option<UdpSocket> = None;

    // Bind receive socket
    match UdpSocket::bind("0.0.0.0:1150").await {
        Ok(sock) => {
            tracing::info!("Bound UDP receive socket on port 1150");
            recv_socket = Some(sock);
        }
        Err(e) => {
            tracing::error!("Failed to bind UDP receive socket: {e}");
        }
    }

    // Bind send socket
    match UdpSocket::bind("0.0.0.0:0").await {
        Ok(sock) => {
            send_socket = Some(sock);
        }
        Err(e) => {
            tracing::error!("Failed to bind UDP send socket: {e}");
        }
    }

    let mut recv_buf = [0u8; 1024];
    let mut tick_interval = tokio::time::interval(std::time::Duration::from_millis(20));
    let mut event_interval = tokio::time::interval(std::time::Duration::from_millis(100));

    loop {
        tokio::select! {
            // Process commands from frontend
            Some(cmd) = cmd_rx.recv() => {
                match cmd {
                    DsCommand::SetTeamNumber(team) => {
                        _team_number = team;
                        target_ip = team_to_ip(team);
                        tracing::info!("Team set to {team}, target IP: {target_ip}");
                        // Reset connection state
                        robot_state = RobotState::default();
                        ds_state.enabled = false;
                    }
                    DsCommand::SetMode(mode) => {
                        ds_state.mode = mode;
                        // Disable when switching modes (safety)
                        ds_state.enabled = false;
                    }
                    DsCommand::Enable => {
                        if !ds_state.estop {
                            ds_state.enabled = true;
                        }
                    }
                    DsCommand::Disable => {
                        ds_state.enabled = false;
                    }
                    DsCommand::EStop => {
                        ds_state.estop = true;
                        ds_state.enabled = false;
                    }
                    DsCommand::SetAlliance(alliance) => {
                        ds_state.alliance = alliance;
                    }
                    DsCommand::RebootRio => {
                        ds_state.request_reboot = true;
                        ds_state.estop = false;
                        ds_state.enabled = false;
                    }
                    DsCommand::RestartCode => {
                        ds_state.request_restart_code = true;
                    }
                    DsCommand::SetTargetIp(ip) => {
                        target_ip = ip;
                    }
                }
            }

            // 50Hz send tick
            _ = tick_interval.tick() => {
                if let Some(ref sock) = send_socket {
                    let joysticks = joystick_state.read().clone();
                    let pkt = build_outbound_packet(sequence, &ds_state, &joysticks);
                    let dest: SocketAddr = format!("{target_ip}:1110")
                        .parse()
                        .unwrap_or_else(|_| "127.0.0.1:1110".parse().unwrap());

                    if let Err(e) = sock.send_to(&pkt, dest).await {
                        tracing::trace!("Send error: {e}");
                    }

                    sequence = sequence.wrapping_add(1);

                    // Clear one-shot requests after sending
                    ds_state.request_reboot = false;
                    ds_state.request_restart_code = false;

                    // If no response for 1 second, mark disconnected
                    if last_recv.elapsed() > std::time::Duration::from_secs(1) {
                        if robot_state.connected {
                            // Robot just disconnected — clear E-Stop so it can
                            // be re-enabled after a reboot/restart
                            ds_state.estop = false;
                            ds_state.enabled = false;
                            tracing::info!("Robot disconnected, clearing E-Stop");
                        }
                        robot_state.connected = false;
                        robot_state.battery_voltage = 0.0;
                        robot_state.code_running = false;
                        robot_state.enabled = false;
                    }
                }
            }

            // Receive robot responses
            result = async {
                if let Some(ref sock) = recv_socket {
                    sock.recv_from(&mut recv_buf).await
                } else {
                    // No socket, just sleep forever
                    std::future::pending::<std::io::Result<(usize, SocketAddr)>>().await
                }
            } => {
                if let Ok((len, _addr)) = result {
                    parse_inbound_packet(&recv_buf[..len], &mut robot_state, &mut diag);
                    last_recv = Instant::now();
                }
            }

            // 10Hz event emission to frontend
            _ = event_interval.tick() => {
                let _ = event_tx.send(DsEvent::RobotState(robot_state.clone())).await;
                let _ = event_tx.send(DsEvent::Diagnostics(diag.clone())).await;
            }
        }
    }
}
