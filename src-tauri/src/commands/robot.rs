use tauri::State;

use crate::protocol::connection::DsCommand;
use crate::protocol::types::Mode;
use crate::AppState;

#[tauri::command]
pub async fn enable_robot(state: State<'_, AppState>) -> Result<(), String> {
    state
        .cmd_tx
        .send(DsCommand::Enable)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn disable_robot(state: State<'_, AppState>) -> Result<(), String> {
    state
        .cmd_tx
        .send(DsCommand::Disable)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn estop_robot(state: State<'_, AppState>) -> Result<(), String> {
    state
        .cmd_tx
        .send(DsCommand::EStop)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn set_mode(state: State<'_, AppState>, mode: String) -> Result<(), String> {
    let m = match mode.as_str() {
        "Teleoperated" => Mode::Teleoperated,
        "Autonomous" => Mode::Autonomous,
        "Test" => Mode::Test,
        _ => return Err(format!("Unknown mode: {mode}")),
    };
    state
        .cmd_tx
        .send(DsCommand::SetMode(m))
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn reboot_rio(state: State<'_, AppState>) -> Result<(), String> {
    state
        .cmd_tx
        .send(DsCommand::RebootRio)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn restart_code(state: State<'_, AppState>) -> Result<(), String> {
    state
        .cmd_tx
        .send(DsCommand::RestartCode)
        .await
        .map_err(|e| e.to_string())
}
