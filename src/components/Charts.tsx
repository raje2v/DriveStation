import { useState, useEffect, useCallback, useRef } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  ResponsiveContainer,
  CartesianGrid,
  ReferenceArea,
} from "recharts";
import { useRobotStore } from "../stores/robotStore";

interface DataPoint {
  time: number;
  battery: number;
  cpu: number;
  ram: number;
  can: number;
}

type RobotPhase = "Disable" | "Auto" | "Tele" | "Test";

interface ModeSegment {
  start: number;
  end: number;
  phase: RobotPhase;
}

const PHASE_COLORS: Record<RobotPhase, string> = {
  Disable: "rgba(76, 175, 80, 0.15)",
  Auto: "rgba(255, 235, 59, 0.18)",
  Tele: "rgba(33, 150, 243, 0.15)",
  Test: "rgba(171, 71, 188, 0.15)",
};

const PHASE_DOT_COLORS: Record<RobotPhase, string> = {
  Disable: "#4caf50",
  Auto: "#ffeb3b",
  Tele: "#2196f3",
  Test: "#ab47bc",
};

type TimeRange = 12 | 60 | 300;

function getPhase(enabled: boolean, mode: string): RobotPhase {
  if (!enabled) return "Disable";
  if (mode === "Autonomous") return "Auto";
  if (mode === "Test") return "Test";
  return "Tele";
}

function formatTime(secs: number): string {
  const d = new Date(secs * 1000);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export default function Charts() {
  const { state, diagnostics } = useRobotStore();
  const [data, setData] = useState<DataPoint[]>([]);
  const [segments, setSegments] = useState<ModeSegment[]>([]);
  const [timeRange, setTimeRange] = useState<TimeRange>(60);
  const startTime = useRef(Date.now());
  const lastPhaseRef = useRef<RobotPhase>("Disable");

  const addPoint = useCallback(() => {
    const now = Date.now();
    const time = (now - startTime.current) / 1000;
    const phase = getPhase(state.enabled, state.mode);

    setData((prev) => {
      const next = [
        ...prev,
        {
          time,
          battery: state.battery_voltage,
          cpu: diagnostics.cpu_usage * 100,
          ram: diagnostics.ram_usage * 100,
          can: diagnostics.can_utilization * 100,
        },
      ];
      // Keep enough data for the max time range (5min) plus buffer
      const cutoff = time - 320;
      return next.filter((p) => p.time > cutoff);
    });

    setSegments((prev) => {
      const updated = [...prev];
      if (updated.length === 0 || lastPhaseRef.current !== phase) {
        // Close the previous segment
        if (updated.length > 0) {
          updated[updated.length - 1].end = time;
        }
        // Start a new segment
        updated.push({ start: time, end: time, phase });
        lastPhaseRef.current = phase;
      } else {
        // Extend the current segment
        updated[updated.length - 1].end = time;
      }
      // Trim old segments
      const cutoff = time - 320;
      return updated.filter((s) => s.end > cutoff);
    });
  }, [state.battery_voltage, state.enabled, state.mode, diagnostics.cpu_usage, diagnostics.ram_usage, diagnostics.can_utilization]);

  useEffect(() => {
    const interval = setInterval(addPoint, 1000);
    return () => clearInterval(interval);
  }, [addPoint]);

  // Compute visible window
  const now = data.length > 0 ? data[data.length - 1].time : 0;
  const windowStart = Math.max(0, now - timeRange);
  const visibleData = data.filter((p) => p.time >= windowStart);
  const visibleSegments = segments
    .filter((s) => s.end >= windowStart && s.start <= now)
    .map((s) => ({
      ...s,
      start: Math.max(s.start, windowStart),
      end: Math.min(s.end, now),
    }));

  const modeAreas = (
    <>
      {visibleSegments.map((seg, i) => (
        <ReferenceArea
          key={`${seg.phase}-${i}`}
          x1={seg.start}
          x2={seg.end}
          fill={PHASE_COLORS[seg.phase]}
          fillOpacity={1}
          ifOverflow="hidden"
        />
      ))}
    </>
  );

  return (
    <div className="flex flex-col h-full">
      {/* Header with time range selector */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-ds-panel border-b border-ds-border">
        <span className="text-xs text-ds-text-dim uppercase tracking-wide">
          Charts
        </span>
        <div className="flex items-center gap-1">
          {([12, 60, 300] as const).map((range) => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              className={`px-1.5 py-0.5 text-[10px] rounded transition-colors ${
                timeRange === range
                  ? "bg-ds-accent text-white"
                  : "text-ds-text-dim hover:text-ds-text"
              }`}
            >
              {range < 60 ? `${range}s` : `${range / 60}m`}
            </button>
          ))}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-2 bg-ds-bg">
        {/* Battery + CPU Chart (matches NI DS bottom chart) */}
        <div className="mb-3">
          <div className="flex items-center gap-3 mb-0.5">
            <span className="text-xs text-ds-text-dim">Battery (V)</span>
            <span className="text-xs text-ds-text-dim">+ CPU (%)</span>
          </div>
          <ResponsiveContainer width="100%" height={100}>
            <LineChart data={visibleData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#4a4a4a" />
              {modeAreas}
              <XAxis
                dataKey="time"
                domain={[windowStart, now]}
                type="number"
                tickFormatter={formatTime}
                tick={{ fontSize: 9, fill: "#888" }}
                interval="preserveStartEnd"
              />
              <YAxis
                yAxisId="volts"
                domain={[0, 14]}
                tick={{ fontSize: 9, fill: "#4caf50" }}
                width={28}
                orientation="left"
              />
              <YAxis
                yAxisId="pct"
                domain={[0, 100]}
                tick={{ fontSize: 9, fill: "#3a7bd5" }}
                width={28}
                orientation="right"
              />
              <Line
                yAxisId="volts"
                type="monotone"
                dataKey="battery"
                stroke="#4caf50"
                strokeWidth={1.5}
                dot={false}
                isAnimationActive={false}
              />
              <Line
                yAxisId="pct"
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

        {/* RAM + CAN Chart */}
        <div className="mb-3">
          <div className="flex items-center gap-3 mb-0.5">
            <span className="text-xs text-ds-text-dim">RAM (%)</span>
            <span className="text-xs text-ds-text-dim">+ CAN (%)</span>
          </div>
          <ResponsiveContainer width="100%" height={100}>
            <LineChart data={visibleData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#4a4a4a" />
              {modeAreas}
              <XAxis
                dataKey="time"
                domain={[windowStart, now]}
                type="number"
                tickFormatter={formatTime}
                tick={{ fontSize: 9, fill: "#888" }}
                interval="preserveStartEnd"
              />
              <YAxis
                domain={[0, 100]}
                tick={{ fontSize: 9, fill: "#888" }}
                width={28}
              />
              <Line
                type="monotone"
                dataKey="ram"
                stroke="#ab47bc"
                strokeWidth={1.5}
                dot={false}
                isAnimationActive={false}
              />
              <Line
                type="monotone"
                dataKey="can"
                stroke="#ff9800"
                strokeWidth={1.5}
                dot={false}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Mode Legend */}
        <div className="flex items-center justify-center gap-3 py-1">
          {(["Disable", "Auto", "Tele", "Test"] as const).map((phase) => (
            <div key={phase} className="flex items-center gap-1">
              <div
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: PHASE_DOT_COLORS[phase] }}
              />
              <span className="text-[10px] text-ds-text-dim">{phase}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
