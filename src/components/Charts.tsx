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
  Disable: "rgba(76, 175, 80, 0.25)",
  Auto: "rgba(255, 235, 59, 0.30)",
  Tele: "rgba(33, 150, 243, 0.25)",
  Test: "rgba(171, 71, 188, 0.25)",
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

  const addPoint = useCallback(() => {
    const now = Date.now();
    const time = (now - startTime.current) / 1000;
    // Read directly from Zustand store to get the absolute latest values
    const store = useRobotStore.getState();
    const s = store.state;
    const d = store.diagnostics;
    const phase = getPhase(s.enabled, s.mode);

    setData((prev) => {
      const next = [
        ...prev,
        {
          time,
          battery: s.battery_voltage,
          cpu: d.cpu_usage * 100,
          ram: d.ram_free / (1024 * 1024),
          can: d.can_utilization * 100,
        },
      ];
      const cutoff = time - 320;
      return next.filter((p) => p.time > cutoff);
    });

    setSegments((prev) => {
      const updated = [...prev];
      // Derive last phase from the array itself (safe for React strict mode
      // double-invocation — no mutable refs inside state updaters)
      const lastPhase = updated.length > 0 ? updated[updated.length - 1].phase : null;
      if (lastPhase !== phase) {
        if (updated.length > 0) {
          updated[updated.length - 1].end = time;
        }
        updated.push({ start: time, end: time, phase });
      } else {
        updated[updated.length - 1].end = time;
      }
      const cutoff = time - 320;
      return updated.filter((s) => s.end > cutoff);
    });
  }, []);

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
        {/* Battery + CPU Chart */}
        <div className="mb-3">
          <div className="flex items-center gap-3 mb-0.5">
            <div className="flex items-center gap-1">
              <div className="w-3 h-0.5 rounded" style={{ backgroundColor: "#4caf50" }} />
              <span className="text-[10px] text-ds-text-dim">Battery (V)</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-0.5 rounded" style={{ backgroundColor: "#e91e63" }} />
              <span className="text-[10px] text-ds-text-dim">CPU (%)</span>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={100}>
            <LineChart data={visibleData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#4a4a4a" />
              {visibleSegments.map((seg, i) => (
                <ReferenceArea
                  key={`batt-${seg.phase}-${i}`}
                  yAxisId="volts"
                  x1={seg.start}
                  x2={seg.end}
                  fill={PHASE_COLORS[seg.phase]}
                  fillOpacity={1}
                  ifOverflow="hidden"
                />
              ))}
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
                tick={{ fontSize: 9, fill: "#e91e63" }}
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
                stroke="#e91e63"
                strokeWidth={1.5}
                dot={false}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* RAM Free + CAN Chart */}
        <div className="mb-3">
          <div className="flex items-center gap-3 mb-0.5">
            <div className="flex items-center gap-1">
              <div className="w-3 h-0.5 rounded" style={{ backgroundColor: "#ab47bc" }} />
              <span className="text-[10px] text-ds-text-dim">RAM Free (MB)</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-0.5 rounded" style={{ backgroundColor: "#ff9800" }} />
              <span className="text-[10px] text-ds-text-dim">CAN (%)</span>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={100}>
            <LineChart data={visibleData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#4a4a4a" />
              {visibleSegments.map((seg, i) => (
                <ReferenceArea
                  key={`ram-${seg.phase}-${i}`}
                  yAxisId="mb"
                  x1={seg.start}
                  x2={seg.end}
                  fill={PHASE_COLORS[seg.phase]}
                  fillOpacity={1}
                  ifOverflow="hidden"
                />
              ))}
              <XAxis
                dataKey="time"
                domain={[windowStart, now]}
                type="number"
                tickFormatter={formatTime}
                tick={{ fontSize: 9, fill: "#888" }}
                interval="preserveStartEnd"
              />
              <YAxis
                yAxisId="mb"
                domain={[0, "auto"]}
                tick={{ fontSize: 9, fill: "#ab47bc" }}
                width={28}
                orientation="left"
              />
              <YAxis
                yAxisId="pct"
                domain={[0, 100]}
                tick={{ fontSize: 9, fill: "#ff9800" }}
                width={28}
                orientation="right"
              />
              <Line
                yAxisId="mb"
                type="monotone"
                dataKey="ram"
                stroke="#ab47bc"
                strokeWidth={1.5}
                dot={false}
                isAnimationActive={false}
              />
              <Line
                yAxisId="pct"
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
          {(["Disable", "Auto", "Tele", "Test"] as const).map((phase) => {
            const currentPhase = getPhase(state.enabled, state.mode);
            return (
              <div key={phase} className="flex items-center gap-1">
                <div
                  className={`w-2 h-2 rounded-full ${currentPhase === phase ? "ring-1 ring-white" : ""}`}
                  style={{ backgroundColor: PHASE_DOT_COLORS[phase] }}
                />
                <span className={`text-[10px] ${currentPhase === phase ? "text-ds-text font-bold" : "text-ds-text-dim"}`}>{phase}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
