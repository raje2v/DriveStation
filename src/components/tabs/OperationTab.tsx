import { invoke } from "@tauri-apps/api/core";
import { useRobotStore } from "../../stores/robotStore";
import { useSystemStore } from "../../stores/systemStore";
import { useMatchTimer } from "../../hooks/useMatchTimer";
import ModeButton from "../common/ModeButton";

function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

function safeInvoke(cmd: string, args?: Record<string, unknown>) {
  if (isTauri()) invoke(cmd, args);
}

export default function OperationTab() {
  const { state, teamNumber, enabledTime } = useRobotStore();
  const { systemInfo } = useSystemStore();
  const matchTimer = useMatchTimer();

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
    <div className="flex flex-col gap-3 p-4">
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
              ? "bg-ds-panel border-ds-border text-ds-text"
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

      {/* Match Timer */}
      {matchTimer.phase !== "Idle" && (
        <div
          className={`bg-ds-panel rounded p-2 text-center ${
            matchTimer.timeRemaining <= 10 && matchTimer.isRunning
              ? "animate-pulse border border-ds-red"
              : ""
          }`}
        >
          <div className="text-[10px] text-ds-text-dim uppercase tracking-wider">
            {matchTimer.phase}
          </div>
          <div
            className={`text-2xl font-mono font-bold ${
              matchTimer.timeRemaining <= 10 && matchTimer.isRunning
                ? "text-ds-red"
                : "text-ds-text"
            }`}
          >
            {formatTime(matchTimer.timeRemaining)}
          </div>
        </div>
      )}

      {/* Info */}
      <div className="flex flex-col gap-1 text-sm">
        <div className="flex justify-between">
          <span className="text-ds-text-dim">Elapsed</span>
          <span>{formatTime(enabledTime)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-ds-text-dim">Team</span>
          <span>{teamNumber !== undefined ? teamNumber : "----"}</span>
        </div>
      </div>

      {/* PC Status */}
      <div className="flex flex-col gap-1 text-sm">
        <span className="text-xs text-ds-text-dim uppercase tracking-wide">PC Status</span>
        <div className="flex justify-between">
          <span className="text-ds-text-dim">Battery</span>
          <span>
            {systemInfo.pcBattery !== null ? (
              <>
                {systemInfo.pcCharging ? "⚡ " : ""}
                {systemInfo.pcBattery.toFixed(0)}%
              </>
            ) : (
              "N/A"
            )}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-ds-text-dim text-sm">CPU</span>
          <div className="flex-1 h-2 bg-ds-bg rounded-full overflow-hidden">
            <div
              className={`h-full transition-all ${
                systemInfo.pcCpu > 80
                  ? "bg-ds-red"
                  : systemInfo.pcCpu > 60
                    ? "bg-ds-orange"
                    : "bg-ds-green"
              }`}
              style={{ width: `${Math.min(100, systemInfo.pcCpu)}%` }}
            />
          </div>
          <span className="text-xs w-10 text-right">{systemInfo.pcCpu.toFixed(0)}%</span>
        </div>
      </div>

      {/* E-Stop Button */}
      <button
        onClick={handleEStop}
        className="w-full py-2 mt-auto rounded bg-ds-red text-white font-bold text-xs uppercase tracking-wider hover:bg-red-700 active:shadow-[0_0_12px_var(--color-ds-red)] transition-colors"
      >
        Emergency Stop
      </button>
    </div>
  );
}
