import { create } from "zustand";

export interface PowerData {
  disable_count_comms: number;
  disable_count_12v: number;
  rail_faults_6v: number;
  rail_faults_5v: number;
  rail_faults_3v3: number;
}

interface PowerStore {
  powerData: PowerData;
  setPowerData: (data: PowerData) => void;
}

export const usePowerStore = create<PowerStore>((set) => ({
  powerData: {
    disable_count_comms: 0,
    disable_count_12v: 0,
    rail_faults_6v: 0,
    rail_faults_5v: 0,
    rail_faults_3v3: 0,
  },
  setPowerData: (powerData) => set({ powerData }),
}));
