import { useRobotStore } from "../../stores/robotStore";
import { usePowerStore } from "../../stores/powerStore";

export default function PowerTab() {
  const { state, diagnostics } = useRobotStore();
  const { powerData } = usePowerStore();

  return (
    <div className="flex flex-col gap-4 p-4">
      {/* Disable Faults */}
      <section>
        <h3 className="text-xs text-ds-text-dim uppercase tracking-wide mb-2">
          Disable Faults
        </h3>
        <div className="bg-ds-panel rounded p-3 flex flex-col gap-1 text-sm">
          <FaultRow label="Comms Loss" value={powerData.disable_count_comms} />
          <FaultRow label="12V Brownout" value={powerData.disable_count_12v} />
        </div>
      </section>

      {/* Rail Faults */}
      <section>
        <h3 className="text-xs text-ds-text-dim uppercase tracking-wide mb-2">
          Rail Faults
        </h3>
        <div className="bg-ds-panel rounded p-3 flex flex-col gap-1 text-sm">
          <FaultRow label="6V" value={powerData.rail_faults_6v} />
          <FaultRow label="5V" value={powerData.rail_faults_5v} />
          <FaultRow label="3.3V" value={powerData.rail_faults_3v3} />
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
          <div className="flex justify-between">
            <span className="text-ds-text-dim">RX Error</span>
            <span>{diagnostics.can_rx_error}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-ds-text-dim">TX Error</span>
            <span>{diagnostics.can_tx_error}</span>
          </div>
        </div>
      </section>

      {/* Brownout Status */}
      <section>
        <h3 className="text-xs text-ds-text-dim uppercase tracking-wide mb-2">
          Brownout
        </h3>
        <div className="bg-ds-panel rounded p-3 text-sm">
          <div className="flex justify-between">
            <span className="text-ds-text-dim">Status</span>
            <span className={state.brownout ? "text-ds-orange" : "text-ds-green"}>
              {state.brownout ? "Active" : "Normal"}
            </span>
          </div>
        </div>
      </section>
    </div>
  );
}

function FaultRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex justify-between">
      <span className="text-ds-text-dim">{label}</span>
      <span className={value > 0 ? "text-ds-orange" : ""}>{value}</span>
    </div>
  );
}
