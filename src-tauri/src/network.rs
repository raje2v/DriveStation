use std::time::Duration;
use tokio::net::TcpStream;

/// Network interface details gathered from if-addrs
pub struct NetworkInfo {
    /// Any non-loopback interface has an IPv4 address
    pub enet_link: bool,
    /// First non-loopback, non-USB IPv4 address found
    pub enet_ip: Option<String>,
    /// A wireless interface (en0 on macOS, wlan* on Linux) is up with an IP
    pub wifi: bool,
    /// A USB-tethered roboRIO interface (172.22.11.x) is present
    pub usb: bool,
}

/// Scan local network interfaces for link, WiFi, and USB status
pub fn check_interfaces() -> NetworkInfo {
    let ifaces = match if_addrs::get_if_addrs() {
        Ok(i) => i,
        Err(_) => {
            return NetworkInfo {
                enet_link: false,
                enet_ip: None,
                wifi: false,
                usb: false,
            };
        }
    };

    let mut enet_link = false;
    let mut enet_ip: Option<String> = None;
    let mut wifi = false;
    let mut usb = false;

    for iface in &ifaces {
        if iface.is_loopback() {
            continue;
        }
        let ip = iface.addr.ip();
        if !ip.is_ipv4() {
            continue;
        }

        let ip_str = ip.to_string();

        // USB roboRIO connection uses 172.22.11.x
        if ip_str.starts_with("172.22.11.") {
            usb = true;
            continue;
        }

        enet_link = true;

        // Detect WiFi interfaces by name
        // macOS: en0 is typically WiFi on laptops
        // Linux: wlan*, wlp*
        let name = &iface.name;
        if name == "en0" || name.starts_with("wlan") || name.starts_with("wlp") {
            wifi = true;
        }

        // Use the first non-loopback, non-USB IPv4 as the reported IP
        if enet_ip.is_none() {
            enet_ip = Some(ip_str);
        }
    }

    NetworkInfo {
        enet_link,
        enet_ip,
        wifi,
        usb,
    }
}

/// Try a quick TCP connect to the radio (port 80) with a short timeout
pub async fn check_radio(radio_ip: &str) -> bool {
    let addr = format!("{radio_ip}:80");
    tokio::time::timeout(
        Duration::from_millis(200),
        TcpStream::connect(&addr),
    )
    .await
    .map(|r| r.is_ok())
    .unwrap_or(false)
}

/// Derive the radio IP from the team number (10.TE.AM.1)
pub fn team_to_radio_ip(team: u32) -> String {
    if team == 0 {
        return "127.0.0.1".to_string();
    }
    let te = team / 100;
    let am = team % 100;
    format!("10.{te}.{am}.1")
}
