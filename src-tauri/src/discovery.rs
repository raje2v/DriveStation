use mdns_sd::{ServiceDaemon, ServiceEvent};
use std::time::Duration;
use tokio::sync::mpsc;
use tracing;

/// Discover the roboRIO via mDNS, falling back to static IP
pub async fn discover_roborio(team: u32, result_tx: mpsc::Sender<String>) {
    if team == 0 {
        let _ = result_tx.send("127.0.0.1".to_string()).await;
        return;
    }

    let mdns_name = format!("roborio-{team}-frc");

    // Try mDNS discovery
    let mdns = ServiceDaemon::new();
    match mdns {
        Ok(mdns) => {
            let service_type = "_ni._tcp.local.";
            match mdns.browse(service_type) {
                Ok(receiver) => {
                    let timeout = tokio::time::sleep(Duration::from_secs(5));
                    tokio::pin!(timeout);

                    loop {
                        tokio::select! {
                            _ = &mut timeout => {
                                tracing::info!("mDNS timeout, falling back to static IP");
                                break;
                            }
                            event = tokio::task::spawn_blocking({
                                let receiver = receiver.clone();
                                move || receiver.recv_timeout(Duration::from_secs(1))
                            }) => {
                                match event {
                                    Ok(Ok(ServiceEvent::ServiceResolved(info))) => {
                                        let name = info.get_fullname().to_lowercase();
                                        if name.contains(&mdns_name.to_lowercase()) {
                                            if let Some(addr) = info.get_addresses().iter().next() {
                                                tracing::info!("Found roboRIO via mDNS: {addr}");
                                                let _ = result_tx.send(addr.to_string()).await;
                                                let _ = mdns.shutdown();
                                                return;
                                            }
                                        }
                                    }
                                    Ok(Ok(_)) => continue,
                                    _ => break,
                                }
                            }
                        }
                    }
                    let _ = mdns.shutdown();
                }
                Err(e) => {
                    tracing::warn!("mDNS browse failed: {e}");
                }
            }
        }
        Err(e) => {
            tracing::warn!("mDNS init failed: {e}");
        }
    }

    // Fallback to static IP
    let te = team / 100;
    let am = team % 100;
    let ip = format!("10.{te}.{am}.2");
    tracing::info!("Using static IP: {ip}");
    let _ = result_tx.send(ip).await;
}
