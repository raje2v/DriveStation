use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum Mode {
    Teleoperated,
    Autonomous,
    Test,
}

impl Mode {
    pub fn to_bits(self) -> u8 {
        match self {
            Mode::Teleoperated => 0x00,
            Mode::Autonomous => 0x02,
            Mode::Test => 0x01,
        }
    }

    pub fn from_bits(bits: u8) -> Self {
        match bits & 0x03 {
            0x02 => Mode::Autonomous,
            0x01 => Mode::Test,
            _ => Mode::Teleoperated,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum Alliance {
    Red1,
    Red2,
    Red3,
    Blue1,
    Blue2,
    Blue3,
}

impl Alliance {
    pub fn to_byte(self) -> u8 {
        match self {
            Alliance::Red1 => 0,
            Alliance::Red2 => 1,
            Alliance::Red3 => 2,
            Alliance::Blue1 => 3,
            Alliance::Blue2 => 4,
            Alliance::Blue3 => 5,
        }
    }
}

impl Default for Alliance {
    fn default() -> Self {
        Alliance::Red1
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RobotState {
    pub connected: bool,
    pub code_running: bool,
    pub enabled: bool,
    pub estopped: bool,
    pub mode: Mode,
    pub battery_voltage: f32,
    pub brownout: bool,
    pub fms_connected: bool,
    pub sequence_number: u16,
}

impl Default for RobotState {
    fn default() -> Self {
        Self {
            connected: false,
            code_running: false,
            enabled: false,
            estopped: false,
            mode: Mode::Teleoperated,
            battery_voltage: 0.0,
            brownout: false,
            fms_connected: false,
            sequence_number: 0,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JoystickState {
    pub axes: Vec<f32>,
    pub buttons: Vec<bool>,
    pub povs: Vec<i16>,
}

impl Default for JoystickState {
    fn default() -> Self {
        Self {
            axes: vec![0.0; 6],
            buttons: vec![false; 16],
            povs: vec![-1],
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiagnosticData {
    pub cpu_usage: f32,
    /// RAM free space in bytes
    pub ram_free: u32,
    /// Disk free space in bytes
    pub disk_free: u32,
    pub can_utilization: f32,
    pub can_bus_off: u32,
    pub can_tx_full: u32,
    pub can_rx_error: u32,
    pub can_tx_error: u32,
}

impl Default for DiagnosticData {
    fn default() -> Self {
        Self {
            cpu_usage: 0.0,
            ram_free: 0,
            disk_free: 0,
            can_utilization: 0.0,
            can_bus_off: 0,
            can_tx_full: 0,
            can_rx_error: 0,
            can_tx_error: 0,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PowerData {
    pub disable_count_comms: u16,
    pub disable_count_12v: u16,
    pub rail_faults_6v: u16,
    pub rail_faults_5v: u16,
    pub rail_faults_3v3: u16,
}

impl Default for PowerData {
    fn default() -> Self {
        Self {
            disable_count_comms: 0,
            disable_count_12v: 0,
            rail_faults_6v: 0,
            rail_faults_5v: 0,
            rail_faults_3v3: 0,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConnectionStatus {
    pub enet_link: bool,
    pub enet_ip: Option<String>,
    pub robot_radio: bool,
    pub robot: bool,
    pub robot_ip: Option<String>,
    pub fms: bool,
    pub wifi: bool,
    pub usb: bool,
}

impl Default for ConnectionStatus {
    fn default() -> Self {
        Self {
            enet_link: false,
            enet_ip: None,
            robot_radio: false,
            robot: false,
            robot_ip: None,
            fms: false,
            wifi: false,
            usb: false,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConsoleMessage {
    pub timestamp: f64,
    pub message: String,
    pub is_error: bool,
    pub is_warning: bool,
    pub sequence: u16,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VersionInfo {
    pub image_version: String,
    pub wpilib_version: String,
    pub rio_version: String,
}
