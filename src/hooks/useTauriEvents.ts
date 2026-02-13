import { useEffect } from "react";
import { listen } from "@tauri-apps/api/event";
import { useRobotStore, RobotState, DiagnosticData, ConnectionStatus, VersionInfo } from "../stores/robotStore";
import { useLogStore, LogEntry } from "../stores/logStore";
import { useGamepadStore, GamepadInfo } from "../stores/gamepadStore";
import { useSystemStore } from "../stores/systemStore";
import { usePowerStore, PowerData } from "../stores/powerStore";

function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

export function useTauriEvents() {
  const setRobotState = useRobotStore((s) => s.setRobotState);
  const setDiagnostics = useRobotStore((s) => s.setDiagnostics);
  const setConnectionStatus = useRobotStore((s) => s.setConnectionStatus);
  const setVersionInfo = useRobotStore((s) => s.setVersionInfo);
  const addEntry = useLogStore((s) => s.addEntry);
  const setGamepads = useGamepadStore((s) => s.setGamepads);
  const setSystemInfo = useSystemStore((s) => s.setSystemInfo);
  const setPowerData = usePowerStore((s) => s.setPowerData);

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

    listen<ConnectionStatus>("connection-status", (event) => {
      setConnectionStatus(event.payload);
    }).then((u) => unlisten.push(u));

    listen<{ gamepads: GamepadInfo[] }>("gamepad-update", (event) => {
      setGamepads(event.payload.gamepads);
    }).then((u) => unlisten.push(u));

    listen<{ pc_battery_percent: number | null; pc_cpu_usage: number; pc_charging: boolean }>(
      "system-info",
      (event) => {
        setSystemInfo({
          pcBattery: event.payload.pc_battery_percent,
          pcCpu: event.payload.pc_cpu_usage,
          pcCharging: event.payload.pc_charging,
        });
      }
    ).then((u) => unlisten.push(u));

    listen<PowerData>("power-data", (event) => {
      setPowerData(event.payload);
    }).then((u) => unlisten.push(u));

    listen<VersionInfo>("version-info", (event) => {
      setVersionInfo(event.payload);
    }).then((u) => unlisten.push(u));

    return () => {
      unlisten.forEach((u) => u());
    };
  }, [setRobotState, setDiagnostics, setConnectionStatus, addEntry, setGamepads, setSystemInfo, setPowerData, setVersionInfo]);
}
