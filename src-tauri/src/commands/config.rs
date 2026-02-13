use tauri::State;

use crate::protocol::connection::{team_to_ip, DsCommand};
use crate::protocol::types::Alliance;
use crate::AppState;

#[tauri::command]
pub async fn set_team_number(state: State<'_, AppState>, team: u32) -> Result<(), String> {
    // Update target IP via watch channel so TCP console reconnects
    let ip = team_to_ip(team);
    let _ = state.target_ip_tx.send(ip);
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
    // Update watch channel so TCP console reconnects
    let _ = state.target_ip_tx.send(ip.clone());
    state
        .cmd_tx
        .send(DsCommand::SetTargetIp(ip))
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn set_game_data(state: State<'_, AppState>, data: String) -> Result<(), String> {
    state
        .cmd_tx
        .send(DsCommand::SetGameData(data))
        .await
        .map_err(|e| e.to_string())
}

// ---------------------------------------------------------------------------
// Dashboard detection & launching (Shuffleboard, Elastic, AdvantageScope)
// ---------------------------------------------------------------------------

const ALL_DASHBOARDS: &[&str] = &["Shuffleboard", "Elastic", "AdvantageScope"];

fn home_dir() -> String {
    std::env::var("HOME")
        .or_else(|_| std::env::var("USERPROFILE"))
        .unwrap_or_default()
}

/// Find the latest WPILib year directory under a base path (e.g. ~/wpilib/).
/// Returns directories whose names are numeric, sorted descending so the
/// newest year comes first.
fn latest_wpilib_year(base: &std::path::Path) -> Option<std::path::PathBuf> {
    let mut years: Vec<std::path::PathBuf> = std::fs::read_dir(base)
        .ok()?
        .filter_map(|e| e.ok())
        .filter(|e| {
            e.file_type().map(|t| t.is_dir()).unwrap_or(false)
                && e.file_name().to_string_lossy().chars().all(|c| c.is_ascii_digit())
        })
        .map(|e| e.path())
        .collect();
    years.sort();
    years.pop() // highest year
}

/// Return all WPILib year directories to search (user home + Windows Public).
fn wpilib_roots() -> Vec<std::path::PathBuf> {
    let mut roots = Vec::new();
    let home = home_dir();

    // ~/wpilib/{year}  (macOS / Linux / Windows user-profile)
    let home_base = std::path::PathBuf::from(format!("{home}/wpilib"));
    if let Some(p) = latest_wpilib_year(&home_base) {
        roots.push(p);
    }

    // C:\Users\Public\wpilib\{year}  (Windows shared install)
    let public_base = std::path::PathBuf::from("C:\\Users\\Public\\wpilib");
    if let Some(p) = latest_wpilib_year(&public_base) {
        roots.push(p);
    }

    roots
}

/// Check if a command is reachable on PATH.
fn command_on_path(cmd: &str) -> bool {
    let check = if cfg!(target_os = "windows") {
        std::process::Command::new("where")
            .arg(cmd)
            .stdout(std::process::Stdio::null())
            .stderr(std::process::Stdio::null())
            .status()
    } else {
        std::process::Command::new("which")
            .arg(cmd)
            .stdout(std::process::Stdio::null())
            .stderr(std::process::Stdio::null())
            .status()
    };
    check.map(|s| s.success()).unwrap_or(false)
}

/// Scan a directory for the first entry matching a predicate.
fn find_entry(
    dir: &std::path::Path,
    pred: impl Fn(&str) -> bool,
) -> Option<std::path::PathBuf> {
    std::fs::read_dir(dir)
        .ok()?
        .filter_map(|e| e.ok())
        .find(|e| pred(&e.file_name().to_string_lossy()))
        .map(|e| e.path())
}

enum Launch {
    Direct(std::path::PathBuf),       // run the binary directly
    JavaJar(std::path::PathBuf),      // java -jar <path>
    MacOpen(std::path::PathBuf),      // open <path.app>
    #[allow(dead_code)]
    WinBatch(std::path::PathBuf),     // cmd /C <path.bat>
    PathCmd(String),                  // command on PATH
}

/// Return the first launch candidate for a given dashboard, or None.
fn find_dashboard(name: &str) -> Option<Launch> {
    let roots = wpilib_roots();

    match name {
        "Shuffleboard" => {
            for root in &roots {
                let tools = root.join("tools");
                // Native binary (WPILib 2026+): tools/Shuffleboard
                let native = tools.join("Shuffleboard");
                if native.exists() && !native.is_dir() {
                    return Some(Launch::Direct(native));
                }
                // Windows batch: tools/Shuffleboard.bat or tools/shuffleboard.bat
                if let Some(bat) = find_entry(&tools, |n| {
                    n.eq_ignore_ascii_case("shuffleboard.bat")
                }) {
                    return Some(Launch::WinBatch(bat));
                }
                // Legacy .py launcher
                let py = tools.join("shuffleboard.py");
                if py.exists() {
                    let python = if cfg!(target_os = "windows") { "python" } else { "python3" };
                    return Some(Launch::Direct(std::path::PathBuf::from(python)));
                }
                // .jar fallback
                let jar = tools.join("Shuffleboard.jar");
                if jar.exists() {
                    return Some(Launch::JavaJar(jar));
                }
            }
            // PATH fallback
            if command_on_path("shuffleboard") {
                return Some(Launch::PathCmd("shuffleboard".into()));
            }
        }

        "Elastic" => {
            for root in &roots {
                let elastic_dir = root.join("elastic");
                // WPILib-bundled .app (macOS): elastic/elastic_dashboard.app or similar
                if let Some(app) = find_entry(&elastic_dir, |n| {
                    n.to_lowercase().contains("elastic") && n.ends_with(".app")
                }) {
                    return Some(Launch::MacOpen(app));
                }
                // WPILib-bundled executable (Linux): elastic/Elastic or elastic/elastic
                if let Some(exe) = find_entry(&elastic_dir, |n| {
                    n.to_lowercase() == "elastic"
                        || n.to_lowercase() == "elastic_dashboard"
                }) {
                    if !exe.is_dir() {
                        return Some(Launch::Direct(exe));
                    }
                }
                // WPILib-bundled .exe (Windows)
                if let Some(exe) = find_entry(&elastic_dir, |n| {
                    n.to_lowercase().contains("elastic") && n.ends_with(".exe")
                }) {
                    return Some(Launch::Direct(exe));
                }
            }
            // Standalone macOS /Applications
            let mac_app = std::path::PathBuf::from("/Applications/Elastic.app");
            if mac_app.exists() {
                return Some(Launch::MacOpen(mac_app));
            }
            // Windows standalone install
            if let Ok(local) = std::env::var("LOCALAPPDATA") {
                for sub in &["Programs\\Elastic", "Elastic"] {
                    let exe = std::path::PathBuf::from(format!("{local}\\{sub}\\Elastic.exe"));
                    if exe.exists() {
                        return Some(Launch::Direct(exe));
                    }
                }
            }
            // PATH fallback
            for cmd in &["elastic", "Elastic", "elastic_dashboard"] {
                if command_on_path(cmd) {
                    return Some(Launch::PathCmd(cmd.to_string()));
                }
            }
        }

        "AdvantageScope" => {
            for root in &roots {
                let as_dir = root.join("advantagescope");
                // WPILib-bundled .app (macOS): may have parens/spaces in name
                if let Some(app) = find_entry(&as_dir, |n| {
                    n.to_lowercase().contains("advantagescope") && n.ends_with(".app")
                }) {
                    return Some(Launch::MacOpen(app));
                }
                // WPILib-bundled executable (Linux)
                if let Some(exe) = find_entry(&as_dir, |n| {
                    n.to_lowercase() == "advantagescope"
                }) {
                    if !exe.is_dir() {
                        return Some(Launch::Direct(exe));
                    }
                }
                // WPILib-bundled .exe (Windows)
                if let Some(exe) = find_entry(&as_dir, |n| {
                    n.to_lowercase().contains("advantagescope") && n.ends_with(".exe")
                }) {
                    return Some(Launch::Direct(exe));
                }
                // Also check tools/ directory
                let tools = root.join("tools");
                if let Some(app) = find_entry(&tools, |n| {
                    n.to_lowercase().contains("advantagescope") && n.ends_with(".app")
                }) {
                    return Some(Launch::MacOpen(app));
                }
                let native = tools.join("AdvantageScope");
                if native.exists() && !native.is_dir() {
                    return Some(Launch::Direct(native));
                }
            }
            // Standalone macOS /Applications
            let mac_app = std::path::PathBuf::from("/Applications/AdvantageScope.app");
            if mac_app.exists() {
                return Some(Launch::MacOpen(mac_app));
            }
            // Windows standalone install
            if let Ok(local) = std::env::var("LOCALAPPDATA") {
                for sub in &[
                    "Programs\\advantagescope",
                    "Programs\\AdvantageScope",
                    "advantagescope",
                    "AdvantageScope",
                ] {
                    let exe = std::path::PathBuf::from(format!(
                        "{local}\\{sub}\\AdvantageScope.exe"
                    ));
                    if exe.exists() {
                        return Some(Launch::Direct(exe));
                    }
                }
            }
            // PATH fallback
            for cmd in &["advantagescope", "AdvantageScope"] {
                if command_on_path(cmd) {
                    return Some(Launch::PathCmd(cmd.to_string()));
                }
            }
        }

        _ => {}
    }

    None
}

fn do_launch(launch: Launch) -> Result<(), String> {
    use std::process::{Command, Stdio};

    // Detach child stdout/stderr so dashboard logs don't pollute DS console
    let result = match launch {
        Launch::Direct(path) => Command::new(&path)
            .stdout(Stdio::null()).stderr(Stdio::null()).spawn(),
        Launch::JavaJar(path) => Command::new("java").arg("-jar").arg(&path)
            .stdout(Stdio::null()).stderr(Stdio::null()).spawn(),
        Launch::MacOpen(path) => Command::new("open").arg(&path)
            .stdout(Stdio::null()).stderr(Stdio::null()).spawn(),
        Launch::WinBatch(path) => {
            if cfg!(target_os = "windows") {
                Command::new("cmd")
                    .args(["/C", &path.to_string_lossy()])
                    .stdout(Stdio::null()).stderr(Stdio::null()).spawn()
            } else {
                return Err("Batch files only supported on Windows".into());
            }
        }
        Launch::PathCmd(cmd) => Command::new(&cmd)
            .stdout(Stdio::null()).stderr(Stdio::null()).spawn(),
    };

    result.map(|_| ()).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_installed_dashboards() -> Vec<String> {
    ALL_DASHBOARDS
        .iter()
        .filter(|name| find_dashboard(name).is_some())
        .map(|s| s.to_string())
        .collect()
}

#[tauri::command]
pub async fn launch_dashboard(name: String) -> Result<(), String> {
    match find_dashboard(&name) {
        Some(launch) => do_launch(launch),
        None => Err(format!("{name} is not installed")),
    }
}
