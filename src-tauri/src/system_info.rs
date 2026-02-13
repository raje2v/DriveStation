use serde::{Deserialize, Serialize};
use tokio::sync::mpsc;

use crate::protocol::connection::DsEvent;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SystemInfoData {
    pub pc_battery_percent: Option<f32>,
    pub pc_cpu_usage: f32,
    pub pc_charging: bool,
}

/// Polls host PC battery and CPU at ~1Hz, emitting SystemInfo events
pub async fn system_info_loop(event_tx: mpsc::Sender<DsEvent>) {
    use sysinfo::System;

    let mut sys = System::new();
    // Initial CPU refresh (sysinfo needs two measurements for accurate CPU)
    sys.refresh_cpu_usage();
    tokio::time::sleep(std::time::Duration::from_secs(1)).await;

    loop {
        // CPU
        sys.refresh_cpu_usage();
        let cpu_avg = if sys.cpus().is_empty() {
            0.0
        } else {
            sys.cpus().iter().map(|c| c.cpu_usage()).sum::<f32>() / sys.cpus().len() as f32
        };

        // Battery
        let (battery_pct, charging) = read_battery();

        let data = SystemInfoData {
            pc_battery_percent: battery_pct,
            pc_cpu_usage: cpu_avg,
            pc_charging: charging,
        };

        if event_tx.send(DsEvent::SystemInfo(data)).await.is_err() {
            break;
        }

        tokio::time::sleep(std::time::Duration::from_secs(1)).await;
    }
}

fn read_battery() -> (Option<f32>, bool) {
    let manager = match battery::Manager::new() {
        Ok(m) => m,
        Err(_) => return (None, false),
    };
    let mut batteries = match manager.batteries() {
        Ok(b) => b,
        Err(_) => return (None, false),
    };
    if let Some(Ok(bat)) = batteries.next() {
        let pct = bat.state_of_charge().get::<battery::units::ratio::percent>();
        let charging = bat.state() == battery::State::Charging
            || bat.state() == battery::State::Full;
        (Some(pct), charging)
    } else {
        (None, false)
    }
}
