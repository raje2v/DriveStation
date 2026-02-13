import { create } from "zustand";

export interface GamepadInfo {
  id: number;
  name: string;
  slot: number;
  axes: number[];
  buttons: boolean[];
  povs: number[];
}

interface GamepadStore {
  gamepads: GamepadInfo[];
  setGamepads: (gamepads: GamepadInfo[]) => void;
}

export const useGamepadStore = create<GamepadStore>((set) => ({
  gamepads: [],
  setGamepads: (gamepads) => set({ gamepads }),
}));
