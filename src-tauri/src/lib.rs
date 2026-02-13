mod commands;
mod discovery;
mod events;
mod gamepad;
mod log_writer;
mod logging;
mod network;
mod protocol;
mod system_info;

use std::sync::Arc;

use parking_lot::{Mutex, RwLock};
use tauri::Manager;
use tokio::sync::{mpsc, watch};

use gamepad::manager::GamepadManager;
use protocol::connection::{protocol_loop, DsCommand, DsEvent};
use protocol::types::{ConsoleMessage, JoystickState, PowerData, VersionInfo};

pub struct AppState {
    pub cmd_tx: mpsc::Sender<DsCommand>,
    pub target_ip_tx: watch::Sender<String>,
    pub gamepad_manager: Mutex<GamepadManager>,
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tracing_subscriber::fmt()
        .with_env_filter("drivestation=info,warn")
        .init();

    let joystick_state: Arc<RwLock<Vec<JoystickState>>> = Arc::new(RwLock::new(Vec::new()));

    let (cmd_tx, cmd_rx) = mpsc::channel::<DsCommand>(64);
    let (event_tx, event_rx) = mpsc::channel::<DsEvent>(256);

    let (target_ip_tx, target_ip_rx) = watch::channel("127.0.0.1".to_string());

    let gamepad_manager = GamepadManager::new(joystick_state.clone());

    let app_state = AppState {
        cmd_tx: cmd_tx.clone(),
        target_ip_tx: target_ip_tx.clone(),
        gamepad_manager: Mutex::new(gamepad_manager),
    };

    let event_tx_console = event_tx.clone();

    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            // Focus the existing window when a second instance is launched
            if let Some(w) = app.get_webview_window("main") {
                let _ = w.unminimize();
                let _ = w.set_focus();
            }
        }))
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .manage(app_state)
        .invoke_handler(tauri::generate_handler![
            commands::robot::enable_robot,
            commands::robot::disable_robot,
            commands::robot::estop_robot,
            commands::robot::set_mode,
            commands::robot::reboot_rio,
            commands::robot::restart_code,
            commands::config::set_team_number,
            commands::config::set_alliance,
            commands::config::set_target_ip,
            commands::config::set_game_data,
            commands::config::get_installed_dashboards,
            commands::config::launch_dashboard,
            commands::gamepad::get_gamepads,
            commands::gamepad::reorder_gamepads,
            commands::gamepad::lock_gamepad_slot,
            commands::gamepad::unlock_gamepad_slot,
        ])
        .setup(move |app| {
            let app_handle = app.handle().clone();
            let js_state = joystick_state.clone();

            // Spawn the protocol loop
            tauri::async_runtime::spawn(protocol_loop(cmd_rx, event_tx, js_state, target_ip_tx.clone()));

            // Spawn the event bridge to push events to the frontend
            tauri::async_runtime::spawn(events::event_bridge(app_handle, event_rx));

            // Spawn TCP console log listener (connects to localhost initially)
            let (log_tx, mut log_rx) = mpsc::channel::<ConsoleMessage>(256);
            let (power_tx, mut power_rx) = mpsc::channel::<PowerData>(64);
            let (version_tx, mut version_rx) = mpsc::channel::<VersionInfo>(16);
            let (shutdown_tx, shutdown_rx) = tokio::sync::watch::channel(false);
            let event_tx_log = event_tx_console.clone();
            let event_tx_power = event_tx_console.clone();
            let event_tx_version = event_tx_console.clone();

            tauri::async_runtime::spawn(logging::console_log_listener(
                target_ip_rx,
                log_tx,
                power_tx,
                shutdown_rx,
                version_tx,
            ));

            // Spawn log file writer
            let log_dir = app.path().app_data_dir().unwrap_or_default().join("logs");
            let (file_log_tx, file_log_rx) = mpsc::channel::<ConsoleMessage>(256);
            tauri::async_runtime::spawn(log_writer::log_file_writer(file_log_rx, log_dir));

            // Bridge console messages to event system + file writer
            tauri::async_runtime::spawn(async move {
                while let Some(msg) = log_rx.recv().await {
                    let _ = file_log_tx.send(msg.clone()).await;
                    let _ = event_tx_log.send(DsEvent::Console(msg)).await;
                }
            });

            // Bridge power data to the event system
            tauri::async_runtime::spawn(async move {
                while let Some(data) = power_rx.recv().await {
                    let _ = event_tx_power.send(DsEvent::PowerData(data)).await;
                }
            });

            // Bridge version info to the event system
            tauri::async_runtime::spawn(async move {
                while let Some(info) = version_rx.recv().await {
                    let _ = event_tx_version.send(DsEvent::VersionInfo(info)).await;
                }
            });

            // Store shutdown sender for cleanup (not strictly needed for now)
            std::mem::forget(shutdown_tx);

            // Spawn system info polling (1Hz — PC battery + CPU)
            let event_tx_sysinfo = event_tx_console.clone();
            tauri::async_runtime::spawn(system_info::system_info_loop(event_tx_sysinfo));

            // Spawn gamepad polling thread (~50Hz)
            // Uses a std::thread because gilrs needs a synchronous polling loop
            let app_handle_gamepad = app.handle().clone();
            let event_tx_gamepad = event_tx_console.clone();
            std::thread::spawn(move || {
                let mut last_ui_update = std::time::Instant::now();
                loop {
                    let state = app_handle_gamepad.state::<AppState>();
                    let mut mgr = state.gamepad_manager.lock();

                    if let Some(update) = mgr.poll() {
                        // Connection/disconnection — send immediately
                        let _ = event_tx_gamepad.blocking_send(DsEvent::GamepadUpdate(update));
                        last_ui_update = std::time::Instant::now();
                    } else if last_ui_update.elapsed() >= std::time::Duration::from_millis(100)
                        && mgr.gamepad_count() > 0
                    {
                        // Periodic update (~10Hz) for live axis/button display
                        let update = mgr.get_gamepad_update();
                        let _ = event_tx_gamepad.blocking_send(DsEvent::GamepadUpdate(update));
                        last_ui_update = std::time::Instant::now();
                    }

                    drop(mgr); // Release lock before sleeping
                    std::thread::sleep(std::time::Duration::from_millis(20));
                }
            });

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
