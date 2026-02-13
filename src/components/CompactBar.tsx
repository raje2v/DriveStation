import { invoke } from "@tauri-apps/api/core";
import { useRobotStore } from "../stores/robotStore";
import { useGamepadStore } from "../stores/gamepadStore";
import StatusLED from "./common/StatusLED";

function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

function safeInvoke(cmd: string, args?: Record<string, unknown>) {
  if (isTauri()) invoke(cmd, args);
}

interface CompactBarProps {
  onExpand: () => void;
}

export default function CompactBar({ onExpand }: CompactBarProps) {
  const { state, connectionStatus, teamNumber, enabledTime } = useRobotStore();
  const { gamepads } = useGamepadStore();

  const canEnable = state.connected && !state.estopped;

  const modes = ["Teleoperated", "Autonomous", "Test"] as const;
  const modeLabels = { Teleoperated: "TeleOp", Autonomous: "Auto", Test: "Test" };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div
      data-tauri-drag-region
      className="h-[48px] flex items-center gap-3 px-3 bg-ds-panel select-none"
    >
      {/* Mode selector */}
      <div className="flex rounded overflow-hidden border border-ds-border">
        {modes.map((mode) => (
          <button
            key={mode}
            onClick={() => safeInvoke("set_mode", { mode })}
            className={`px-2 py-1 text-[11px] font-medium transition-colors ${
              state.mode === mode
                ? "bg-ds-accent text-white"
                : "bg-ds-bg text-ds-text-dim hover:bg-ds-border"
            }`}
          >
            {modeLabels[mode]}
          </button>
        ))}
      </div>

      {/* Separator */}
      <div className="w-px h-5 bg-ds-border" />

      {/* Enable / Disable */}
      <div className="flex gap-1">
        <button
          onClick={() => safeInvoke("enable_robot")}
          disabled={!canEnable}
          className={`px-3 py-1 rounded text-[11px] font-bold uppercase transition-colors ${
            state.enabled
              ? "bg-ds-enable text-white shadow-[0_0_6px_var(--color-ds-green)]"
              : canEnable
                ? "bg-transparent border border-ds-enable text-ds-enable hover:bg-ds-enable/20"
                : "bg-transparent border border-gray-600 text-gray-500 cursor-not-allowed"
          }`}
        >
          Enable
        </button>
        <button
          onClick={() => safeInvoke("disable_robot")}
          className={`px-3 py-1 rounded text-[11px] font-bold uppercase transition-colors ${
            !state.enabled
              ? "bg-ds-disable text-white shadow-[0_0_6px_var(--color-ds-red)]"
              : "bg-transparent border border-ds-disable text-ds-disable hover:bg-ds-disable/20"
          }`}
        >
          Disable
        </button>
      </div>

      {/* Separator */}
      <div className="w-px h-5 bg-ds-border" />

      {/* Status LEDs */}
      <div className="flex items-center gap-3">
        <StatusLED active={connectionStatus.enet_link} color="green" label="Enet" />
        <StatusLED active={connectionStatus.robot_radio} color="green" label="Radio" />
        <StatusLED active={connectionStatus.robot} color="green" label="Robot" />
        <StatusLED active={connectionStatus.fms} color="green" label="FMS" />
        <StatusLED active={connectionStatus.wifi} color="green" label="Wifi" />
        <StatusLED active={connectionStatus.usb} color="green" label="USB" />
        <StatusLED active={state.code_running} color="green" label="Code" />
        <StatusLED
          active={gamepads.length > 0}
          color={gamepads.length > 0 ? "green" : "red"}
          label="Joy"
        />
      </div>

      {/* Separator */}
      <div className="w-px h-5 bg-ds-border" />

      {/* Battery */}
      <div
        className={`text-xs font-mono font-medium ${
          state.battery_voltage > 11
            ? "text-ds-green"
            : state.battery_voltage > 9
              ? "text-ds-orange"
              : "text-ds-red"
        }`}
      >
        {state.connected ? `${state.battery_voltage.toFixed(2)}V` : "-.--V"}
      </div>

      {/* Team */}
      <div className="text-[11px] text-ds-text-dim font-mono">
        Team {teamNumber ?? "----"}
      </div>

      {/* Elapsed time */}
      <div className="text-[11px] font-mono text-ds-text">
        {formatTime(enabledTime)}
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* E-Stop */}
      <button
        onClick={() => safeInvoke("estop_robot")}
        className="px-3 py-1 rounded bg-ds-red text-white text-[11px] font-bold uppercase hover:bg-red-700 active:shadow-[0_0_10px_var(--color-ds-red)] transition-colors"
      >
        E-Stop
      </button>

      {/* Restore button */}
      <button
        onClick={onExpand}
        className="px-2 py-1 rounded text-[11px] text-ds-text-dim hover:text-ds-text hover:bg-ds-border transition-colors"
        title="Restore full window (Cmd+Shift+M)"
      >
        Restore
      </button>
    </div>
  );
}
