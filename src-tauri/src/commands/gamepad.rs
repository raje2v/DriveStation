use tauri::State;

use crate::protocol::connection::GamepadUpdate;
use crate::AppState;

#[tauri::command]
pub fn get_gamepads(state: State<'_, AppState>) -> Result<GamepadUpdate, String> {
    let mgr = state.gamepad_manager.lock();
    Ok(mgr.get_gamepad_update())
}

#[tauri::command]
pub fn reorder_gamepads(
    state: State<'_, AppState>,
    from: usize,
    to: usize,
) -> Result<(), String> {
    let mut mgr = state.gamepad_manager.lock();
    mgr.move_to_slot(from, to);
    Ok(())
}
