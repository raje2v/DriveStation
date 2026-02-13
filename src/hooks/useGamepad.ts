import { useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useGamepadStore, GamepadInfo } from "../stores/gamepadStore";

function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

export function useGamepadPolling() {
  const setGamepads = useGamepadStore((s) => s.setGamepads);

  useEffect(() => {
    if (!isTauri()) return;

    const interval = setInterval(async () => {
      try {
        const result = await invoke<{ gamepads: GamepadInfo[] }>("get_gamepads");
        setGamepads(result.gamepads);
      } catch {
        // Backend not ready yet
      }
    }, 200);

    return () => clearInterval(interval);
  }, [setGamepads]);
}
