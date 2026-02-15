import { create } from "zustand";

export interface LogEntry {
  timestamp: number;
  message: string;
  is_error: boolean;
  is_warning: boolean;
  sequence: number;
}

interface LogStore {
  entries: LogEntry[];
  addEntry: (entry: LogEntry) => void;
  clear: () => void;
}

const MAX_ENTRIES = 1000;

export const useLogStore = create<LogStore>((set) => ({
  entries: [],
  addEntry: (entry) =>
    set((state) => ({
      entries:
        state.entries.length >= MAX_ENTRIES
          ? [...state.entries.slice(1), entry]
          : [...state.entries, entry],
    })),
  clear: () => set({ entries: [] }),
}));
