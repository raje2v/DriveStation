import { create } from "zustand";

export interface GamepadInfo {
  id: number;
  name: string;
  slot: number;
  axes: number[];
  buttons: boolean[];
  povs: number[];
  locked: boolean;
}

interface GamepadStore {
  gamepads: GamepadInfo[];
  /** Maps slot index → device name for locked-but-disconnected slots */
  lockedSlots: Record<number, string>;
  setGamepads: (gamepads: GamepadInfo[]) => void;
  lockSlot: (slot: number, name: string) => void;
  unlockSlot: (slot: number) => void;
}

export const useGamepadStore = create<GamepadStore>((set) => ({
  gamepads: [],
  lockedSlots: {},
  setGamepads: (gamepads) => set({ gamepads }),
  lockSlot: (slot, name) =>
    set((s) => ({ lockedSlots: { ...s.lockedSlots, [slot]: name } })),
  unlockSlot: (slot) =>
    set((s) => {
      const { [slot]: _, ...rest } = s.lockedSlots;
      return { lockedSlots: rest };
    }),
}));
