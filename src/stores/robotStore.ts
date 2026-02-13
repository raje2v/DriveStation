import { create } from "zustand";

export interface RobotState {
  connected: boolean;
  code_running: boolean;
  enabled: boolean;
  estopped: boolean;
  mode: "Teleoperated" | "Autonomous" | "Test";
  battery_voltage: number;
  brownout: boolean;
  sequence_number: number;
}

export interface ConnectionStatus {
  enet_link: boolean;
  enet_ip: string | null;
  robot_radio: boolean;
  robot: boolean;
  fms: boolean;
  wifi: boolean;
  usb: boolean;
}

export interface DiagnosticData {
  cpu_usage: number;
  ram_usage: number;
  disk_usage: number;
  can_utilization: number;
  can_bus_off: number;
  can_tx_full: number;
  can_rx_error: number;
  can_tx_error: number;
}

interface RobotStore {
  state: RobotState;
  diagnostics: DiagnosticData;
  connectionStatus: ConnectionStatus;
  teamNumber: number;
  alliance: string;
  enabledTime: number;
  setRobotState: (state: RobotState) => void;
  setDiagnostics: (diag: DiagnosticData) => void;
  setConnectionStatus: (status: ConnectionStatus) => void;
  setTeamNumber: (team: number) => void;
  setAlliance: (alliance: string) => void;
  setEnabledTime: (time: number) => void;
}

export const useRobotStore = create<RobotStore>((set) => ({
  state: {
    connected: false,
    code_running: false,
    enabled: false,
    estopped: false,
    mode: "Teleoperated",
    battery_voltage: 0,
    brownout: false,
    sequence_number: 0,
  },
  diagnostics: {
    cpu_usage: 0,
    ram_usage: 0,
    disk_usage: 0,
    can_utilization: 0,
    can_bus_off: 0,
    can_tx_full: 0,
    can_rx_error: 0,
    can_tx_error: 0,
  },
  connectionStatus: {
    enet_link: false,
    enet_ip: null,
    robot_radio: false,
    robot: false,
    fms: false,
    wifi: false,
    usb: false,
  },
  teamNumber: 0,
  alliance: "Red1",
  enabledTime: 0,
  setRobotState: (state) => set({ state }),
  setDiagnostics: (diagnostics) => set({ diagnostics }),
  setConnectionStatus: (connectionStatus) => set({ connectionStatus }),
  setTeamNumber: (teamNumber) => set({ teamNumber }),
  setAlliance: (alliance) => set({ alliance }),
  setEnabledTime: (enabledTime) => set({ enabledTime }),
}));
