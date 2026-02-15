use std::time::Duration;
use tokio::sync::mpsc;
use tracing;

/// Discover the roboRIO via mDNS hostname resolution, then static IP fallback
pub async fn discover_roborio(team: u32, result_tx: mpsc::Sender<String>) {
    if team == 0 {
        let _ = result_tx.send("127.0.0.1".to_string()).await;
        return;
    }

    // Try direct mDNS hostname resolution (roboRIO-TEAM-FRC.local)
    // The system resolver handles .local domains via mDNS on macOS/Linux
    let hostname = format!("roboRIO-{team}-FRC.local:1110");
    tracing::info!("Trying mDNS hostname resolution: {hostname}");

    match tokio::time::timeout(
        Duration::from_secs(5),
        tokio::net::lookup_host(&hostname),
    )
    .await
    {
        Ok(Ok(mut addrs)) => {
            // Prefer IPv4 addresses
            if let Some(addr) = addrs.find(|a| a.is_ipv4()) {
                let ip = addr.ip().to_string();
                tracing::info!("mDNS resolved roboRIO to {ip}");
                let _ = result_tx.send(ip).await;
                return;
            }
        }
        Ok(Err(e)) => {
            tracing::info!("mDNS hostname resolution failed: {e}");
        }
        Err(_) => {
            tracing::info!("mDNS hostname resolution timed out");
        }
    }

    // Fallback to static IP
    let te = team / 100;
    let am = team % 100;
    let ip = format!("10.{te}.{am}.2");
    tracing::info!("Using static IP fallback: {ip}");
    let _ = result_tx.send(ip).await;
}
