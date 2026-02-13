import { useRobotStore } from "../stores/robotStore";
import { useGamepadStore } from "../stores/gamepadStore";
import StatusLED from "./common/StatusLED";

/** StatusLED with a hover tooltip */
function StatusLEDWithTip({
  active,
  color,
  label,
  tip,
  tipAlign = "center",
}: {
  active: boolean;
  color?: "green" | "red" | "orange";
  label: string;
  tip?: string;
  tipAlign?: "left" | "center";
}) {
  const alignClass =
    tipAlign === "left"
      ? "left-0"
      : "left-1/2 -translate-x-1/2";

  return (
    <div className="relative group">
      <StatusLED active={active} color={color} label={label} />
      {tip && (
        <div className={`absolute bottom-full ${alignClass} mb-2 hidden group-hover:block z-50`}>
          <div className="bg-ds-panel border border-ds-border rounded shadow-lg px-2.5 py-1.5 whitespace-nowrap">
            <span className="text-[11px] font-mono text-ds-text">{tip}</span>
          </div>
        </div>
      )}
    </div>
  );
}

export default function StatusBar() {
  const { state, connectionStatus, teamNumber } = useRobotStore();
  const { gamepads } = useGamepadStore();

  const robotIp =
    teamNumber === 0
      ? "127.0.0.1"
      : `10.${Math.floor(teamNumber / 100)}.${teamNumber % 100}.2`;
  const radioIp =
    teamNumber === 0
      ? "127.0.0.1"
      : `10.${Math.floor(teamNumber / 100)}.${teamNumber % 100}.1`;

  return (
    <div className="flex items-center justify-between px-4 py-1.5 bg-ds-panel border-t border-ds-border">
      {/* Status LEDs */}
      <div className="flex items-center gap-4">
        <StatusLEDWithTip
          active={connectionStatus.enet_link}
          color="green"
          label="Enet"
          tip={connectionStatus.enet_ip ?? "No link"}
          tipAlign="left"
        />
        <StatusLEDWithTip
          active={connectionStatus.robot_radio}
          color="green"
          label="Radio"
          tip={radioIp}
        />
        <StatusLEDWithTip
          active={connectionStatus.robot}
          color="green"
          label="Robot"
          tip={connectionStatus.robot ? robotIp : "Not connected"}
        />
        <StatusLEDWithTip
          active={connectionStatus.fms}
          color="green"
          label="FMS"
          tip={connectionStatus.fms ? "Connected" : "Not connected"}
        />
        <StatusLEDWithTip
          active={connectionStatus.wifi}
          color="green"
          label="Wifi"
        />
        <StatusLEDWithTip
          active={connectionStatus.usb}
          color="green"
          label="USB"
          tip={connectionStatus.usb ? "172.22.11.2" : "Not connected"}
        />
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
