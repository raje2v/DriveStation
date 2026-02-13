import { useState, useEffect, useCallback, useRef } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { useRobotStore } from "../stores/robotStore";

interface DataPoint {
  time: number;
  battery: number;
  cpu: number;
}

const MAX_POINTS = 100;

export default function Charts() {
  const { state, diagnostics } = useRobotStore();
  const [data, setData] = useState<DataPoint[]>([]);
  const startTime = useRef(Date.now());

  const addPoint = useCallback(() => {
    const time = (Date.now() - startTime.current) / 1000;
    setData((prev) => {
      const next = [
        ...prev,
        {
          time,
          battery: state.battery_voltage,
          cpu: diagnostics.cpu_usage * 100,
        },
      ];
      return next.length > MAX_POINTS ? next.slice(-MAX_POINTS) : next;
    });
  }, [state.battery_voltage, diagnostics.cpu_usage]);

  useEffect(() => {
    const interval = setInterval(addPoint, 1000);
    return () => clearInterval(interval);
  }, [addPoint]);

  return (
    <div className="flex flex-col h-full">
      <div className="px-3 py-1.5 bg-ds-panel border-b border-ds-border">
        <span className="text-xs text-ds-text-dim uppercase tracking-wide">
          Charts
        </span>
      </div>
      <div className="flex-1 overflow-y-auto p-2 bg-ds-bg">
        {/* Battery Chart */}
        <div className="mb-3">
          <span className="text-xs text-ds-text-dim">Battery (V)</span>
          <ResponsiveContainer width="100%" height={80}>
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#4a4a4a" />
              <XAxis dataKey="time" hide />
              <YAxis domain={[0, 14]} tick={{ fontSize: 10, fill: "#888" }} width={30} />
              <Line
                type="monotone"
                dataKey="battery"
                stroke="#4caf50"
                strokeWidth={1.5}
                dot={false}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* CPU Chart */}
        <div>
          <span className="text-xs text-ds-text-dim">CPU (%)</span>
          <ResponsiveContainer width="100%" height={80}>
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#4a4a4a" />
              <XAxis dataKey="time" hide />
              <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: "#888" }} width={30} />
              <Line
                type="monotone"
                dataKey="cpu"
                stroke="#3a7bd5"
                strokeWidth={1.5}
                dot={false}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
