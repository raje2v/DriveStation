use tauri::{AppHandle, Emitter};
use tokio::sync::mpsc;

use crate::protocol::connection::DsEvent;

/// Bridges protocol events to Tauri frontend events
pub async fn event_bridge(app: AppHandle, mut event_rx: mpsc::Receiver<DsEvent>) {
    while let Some(event) = event_rx.recv().await {
        match &event {
            DsEvent::RobotState(state) => {
                let _ = app.emit("robot-state", state);
            }
            DsEvent::Diagnostics(diag) => {
                let _ = app.emit("diagnostics", diag);
            }
            DsEvent::Console(msg) => {
                tracing::info!("Console: {}", msg.message);
                let _ = app.emit("console-message", msg);
            }
            DsEvent::GamepadUpdate(update) => {
                let _ = app.emit("gamepad-update", update);
            }
            DsEvent::SystemInfo(info) => {
                let _ = app.emit("system-info", info);
            }
            DsEvent::ConnectionStatus(status) => {
                let _ = app.emit("connection-status", status);
            }
            DsEvent::PowerData(data) => {
                let _ = app.emit("power-data", data);
            }
            DsEvent::VersionInfo(info) => {
                let _ = app.emit("version-info", info);
            }
        }
    }
}
