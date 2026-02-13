use tauri::State;

use crate::protocol::connection::DsCommand;
use crate::protocol::types::Alliance;
use crate::AppState;

#[tauri::command]
pub async fn set_team_number(state: State<'_, AppState>, team: u32) -> Result<(), String> {
    state
        .cmd_tx
        .send(DsCommand::SetTeamNumber(team))
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn set_alliance(state: State<'_, AppState>, alliance: String) -> Result<(), String> {
    let a = match alliance.as_str() {
        "Red1" => Alliance::Red1,
        "Red2" => Alliance::Red2,
        "Red3" => Alliance::Red3,
        "Blue1" => Alliance::Blue1,
        "Blue2" => Alliance::Blue2,
        "Blue3" => Alliance::Blue3,
        _ => return Err(format!("Unknown alliance: {alliance}")),
    };
    state
        .cmd_tx
        .send(DsCommand::SetAlliance(a))
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn set_target_ip(state: State<'_, AppState>, ip: String) -> Result<(), String> {
    state
        .cmd_tx
        .send(DsCommand::SetTargetIp(ip))
        .await
        .map_err(|e| e.to_string())
}
