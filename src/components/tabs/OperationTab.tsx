import { invoke } from "@tauri-apps/api/core";
import { useRobotStore } from "../../stores/robotStore";
import ModeButton from "../common/ModeButton";

function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

function safeInvoke(cmd: string, args?: Record<string, unknown>) {
  if (isTauri()) invoke(cmd, args);
}

export default function OperationTab() {
  const { state, teamNumber, enabledTime } = useRobotStore();

  const handleSetMode = (mode: string) => {
    safeInvoke("set_mode", { mode });
  };

  const handleEnable = () => {
    safeInvoke("enable_robot");
  };

  const handleDisable = () => {
    safeInvoke("disable_robot");
  };

  const handleEStop = () => {
    safeInvoke("estop_robot");
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const canEnable = state.connected && !state.estopped;

  return (
    <div className="flex flex-col gap-4 p-4">
      {/* Mode Selection */}
      <div className="flex flex-col gap-2">
        <span className="text-xs text-ds-text-dim uppercase tracking-wide">Mode</span>
        <div className="flex flex-col gap-1">
          <ModeButton
            label="Teleoperated"
            selected={state.mode === "Teleoperated"}
            onClick={() => handleSetMode("Teleoperated")}
          />
          <ModeButton
            label="Autonomous"
            selected={state.mode === "Autonomous"}
            onClick={() => handleSetMode("Autonomous")}
          />
          <ModeButton
            label="Test"
            selected={state.mode === "Test"}
            onClick={() => handleSetMode("Test")}
          />
        </div>
      </div>

      {/* Enable / Disable — matching NI DS: one is highlighted, the other is dim */}
      <div className="flex flex-col gap-2">
        <button
          onClick={handleEnable}
          disabled={!canEnable}
          className={`w-full py-3 rounded font-bold text-sm uppercase tracking-wider transition-colors border-2 ${
            state.enabled
              ? "bg-ds-enable border-ds-enable text-white shadow-[0_0_8px_var(--color-ds-green)]"
              : canEnable
                ? "bg-transparent border-ds-enable text-ds-enable hover:bg-ds-enable/20"
                : "bg-transparent border-gray-600 text-gray-500 cursor-not-allowed"
          }`}
        >
          Enable
        </button>
        <button
          onClick={handleDisable}
          className={`w-full py-3 rounded font-bold text-sm uppercase tracking-wider transition-colors border-2 ${
            !state.enabled
              ? "bg-ds-disable border-ds-disable text-white shadow-[0_0_8px_var(--color-ds-red)]"
              : "bg-transparent border-ds-disable text-ds-disable hover:bg-ds-disable/20"
          }`}
        >
          Disable
        </button>
      </div>

      {/* E-Stop */}
      {state.estopped && (
        <div className="bg-ds-red/20 border border-ds-red rounded p-2 text-center text-ds-red font-bold text-sm">
          EMERGENCY STOPPED — Reboot RoboRIO to clear
        </div>
      )}

      {/* Info */}
      <div className="flex flex-col gap-1 text-sm mt-2">
        <div className="flex justify-between">
          <span className="text-ds-text-dim">Elapsed</span>
          <span>{formatTime(enabledTime)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-ds-text-dim">Team</span>
          <span>{teamNumber !== undefined ? teamNumber : "----"}</span>
        </div>
      </div>

      {/* E-Stop Button */}
      <button
        onClick={handleEStop}
        className="w-full py-2 mt-auto rounded bg-ds-red text-white font-bold text-xs uppercase tracking-wider hover:bg-red-700 active:shadow-[0_0_12px_var(--color-ds-red)] transition-colors"
      >
        Emergency Stop (Space)
      </button>
    </div>
  );
}
