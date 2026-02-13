import { create } from "zustand";
import { persist } from "zustand/middleware";

interface WindowStore {
  compactMode: boolean;
  compactPosition: "top" | "bottom";
  setCompactMode: (compact: boolean) => void;
  setCompactPosition: (position: "top" | "bottom") => void;
}

export const useWindowStore = create<WindowStore>()(
  persist(
    (set) => ({
      compactMode: false,
      compactPosition: "top",
      setCompactMode: (compactMode) => set({ compactMode }),
      setCompactPosition: (compactPosition) => set({ compactPosition }),
    }),
    { name: "drivestation-window" },
  ),
);
