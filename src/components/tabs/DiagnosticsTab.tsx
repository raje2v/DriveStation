import { invoke } from "@tauri-apps/api/core";
import { useRobotStore } from "../../stores/robotStore";

export default function DiagnosticsTab() {
  const { state, diagnostics } = useRobotStore();

  const handleReboot = () => invoke("reboot_rio");
  const handleRestart = () => invoke("restart_code");

  return (
    <div className="flex flex-col gap-4 p-4">
      {/* Connection Status */}
      <section>
        <h3 className="text-xs text-ds-text-dim uppercase tracking-wide mb-2">
          Connection
        </h3>
        <div className="bg-ds-panel rounded p-3 flex flex-col gap-1 text-sm">
          <div className="flex justify-between">
            <span className="text-ds-text-dim">Status</span>
            <span className={state.connected ? "text-ds-green" : "text-ds-red"}>
              {state.connected ? "Connected" : "Disconnected"}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-ds-text-dim">Robot Code</span>
            <span className={state.code_running ? "text-ds-green" : "text-ds-red"}>
              {state.code_running ? "Running" : "Not Running"}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-ds-text-dim">Battery</span>
            <span
              className={
                state.battery_voltage > 11
                  ? "text-ds-green"
                  : state.battery_voltage > 9
                    ? "text-ds-orange"
                    : "text-ds-red"
              }
            >
              {state.battery_voltage.toFixed(2)}V
            </span>
          </div>
          {state.brownout && (
            <div className="text-ds-orange text-xs mt-1">Brownout detected</div>
          )}
        </div>
      </section>

      {/* System Resources */}
      <section>
        <h3 className="text-xs text-ds-text-dim uppercase tracking-wide mb-2">
          RoboRIO Resources
        </h3>
        <div className="bg-ds-panel rounded p-3 flex flex-col gap-1 text-sm">
          <ResourceBar label="CPU" value={diagnostics.cpu_usage} />
          <ResourceBar label="RAM" value={diagnostics.ram_usage} />
          <ResourceBar label="Disk" value={diagnostics.disk_usage / 100} />
        </div>
      </section>

      {/* CAN Bus */}
      <section>
        <h3 className="text-xs text-ds-text-dim uppercase tracking-wide mb-2">
          CAN Bus
        </h3>
        <div className="bg-ds-panel rounded p-3 flex flex-col gap-1 text-sm">
          <div className="flex justify-between">
            <span className="text-ds-text-dim">Utilization</span>
            <span>{(diagnostics.can_utilization * 100).toFixed(1)}%</span>
          </div>
          <div className="flex justify-between">
            <span className="text-ds-text-dim">Bus Off</span>
            <span>{diagnostics.can_bus_off}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-ds-text-dim">TX Full</span>
            <span>{diagnostics.can_tx_full}</span>
          </div>
        </div>
      </section>

      {/* Actions */}
      <div className="flex gap-2">
        <button
          onClick={handleRestart}
          disabled={!state.connected}
          className="flex-1 py-2 rounded text-xs font-medium bg-ds-panel text-ds-text hover:bg-ds-border disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          Restart Code
        </button>
        <button
          onClick={handleReboot}
          disabled={!state.connected}
          className="flex-1 py-2 rounded text-xs font-medium bg-ds-panel text-ds-text hover:bg-ds-border disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          Reboot RIO
        </button>
      </div>
    </div>
  );
}

function ResourceBar({ label, value }: { label: string; value: number }) {
  const pct = Math.min(100, Math.max(0, value * 100));
  const color = pct > 80 ? "bg-ds-red" : pct > 60 ? "bg-ds-orange" : "bg-ds-green";

  return (
    <div className="flex items-center gap-2">
      <span className="text-ds-text-dim w-10 text-xs">{label}</span>
      <div className="flex-1 h-2 bg-ds-bg rounded-full overflow-hidden">
        <div className={`h-full ${color} transition-all`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs w-10 text-right">{pct.toFixed(0)}%</span>
    </div>
  );
}
