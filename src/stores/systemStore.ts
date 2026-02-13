import { create } from "zustand";

export interface SystemInfo {
  pcBattery: number | null;
  pcCpu: number;
  pcCharging: boolean;
}

interface SystemStore {
  systemInfo: SystemInfo;
  setSystemInfo: (info: SystemInfo) => void;
}

export const useSystemStore = create<SystemStore>((set) => ({
  systemInfo: {
    pcBattery: null,
    pcCpu: 0,
    pcCharging: false,
  },
  setSystemInfo: (systemInfo) => set({ systemInfo }),
}));
