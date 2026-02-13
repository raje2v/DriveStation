import { useRobotStore } from "../stores/robotStore";
import { useGamepadStore } from "../stores/gamepadStore";
import StatusLED from "./common/StatusLED";

export default function StatusBar() {
  const { state, teamNumber } = useRobotStore();
  const { gamepads } = useGamepadStore();

  return (
    <div className="flex items-center justify-between px-4 py-1.5 bg-ds-panel border-t border-ds-border">
      {/* Status LEDs */}
      <div className="flex items-center gap-4">
        <StatusLED active={state.connected} color="green" label="Comms" />
        <StatusLED active={state.code_running} color="green" label="Code" />
        <StatusLED
          active={gamepads.length > 0}
          color={gamepads.length > 0 ? "green" : "red"}
          label="Joysticks"
        />
      </div>

      {/* Battery */}
      <div className="flex items-center gap-3">
        <div
          className={`text-sm font-mono font-medium ${
            state.battery_voltage > 11
              ? "text-ds-green"
              : state.battery_voltage > 9
                ? "text-ds-orange"
                : "text-ds-red"
          }`}
        >
          {state.connected ? `${state.battery_voltage.toFixed(2)}V` : "-.--V"}
        </div>

        {/* Team number */}
        <div className="text-xs text-ds-text-dim font-mono">
          Team {teamNumber ?? "----"}
        </div>
      </div>
    </div>
  );
}
