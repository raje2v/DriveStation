import { useEffect } from "react";
import { listen } from "@tauri-apps/api/event";
import { useRobotStore, RobotState, DiagnosticData } from "../stores/robotStore";
import { useLogStore, LogEntry } from "../stores/logStore";
import { useGamepadStore, GamepadInfo } from "../stores/gamepadStore";

function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

export function useTauriEvents() {
  const setRobotState = useRobotStore((s) => s.setRobotState);
  const setDiagnostics = useRobotStore((s) => s.setDiagnostics);
  const addEntry = useLogStore((s) => s.addEntry);
  const setGamepads = useGamepadStore((s) => s.setGamepads);

  useEffect(() => {
    if (!isTauri()) return;

    const unlisten: Array<() => void> = [];

    listen<RobotState>("robot-state", (event) => {
      setRobotState(event.payload);
    }).then((u) => unlisten.push(u));

    listen<DiagnosticData>("diagnostics", (event) => {
      setDiagnostics(event.payload);
    }).then((u) => unlisten.push(u));

    listen<LogEntry>("console-message", (event) => {
      addEntry(event.payload);
    }).then((u) => unlisten.push(u));

    listen<{ gamepads: GamepadInfo[] }>("gamepad-update", (event) => {
      setGamepads(event.payload.gamepads);
    }).then((u) => unlisten.push(u));

    return () => {
      unlisten.forEach((u) => u());
    };
  }, [setRobotState, setDiagnostics, addEntry, setGamepads]);
}
