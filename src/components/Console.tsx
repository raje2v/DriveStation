import { useEffect, useRef, useState, useMemo } from "react";
import { useLogStore, LogEntry } from "../stores/logStore";

function formatTimestamp(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${String(m).padStart(2, "0")}:${s.toFixed(3).padStart(6, "0")}`;
}

type Filter = "all" | "prints" | "warnings" | "errors";

export default function Console() {
  const { entries, clear } = useLogStore();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [paused, setPaused] = useState(false);
  const [snapshot, setSnapshot] = useState<LogEntry[] | null>(null);
  const [filter, setFilter] = useState<Filter>("all");

  const baseEntries = paused && snapshot ? snapshot : entries;

  const visibleEntries = useMemo(() => {
    if (filter === "all") return baseEntries;
    if (filter === "errors") return baseEntries.filter((e) => e.is_error);
    if (filter === "warnings") return baseEntries.filter((e) => e.is_warning);
    return baseEntries.filter((e) => !e.is_error && !e.is_warning);
  }, [baseEntries, filter]);

  useEffect(() => {
    if (!paused && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [entries, paused, filter]);

  const togglePause = () => {
    if (!paused) {
      setSnapshot([...entries]);
    } else {
      setSnapshot(null);
    }
    setPaused((p) => !p);
  };

  const newWhilePaused = paused && snapshot ? entries.length - snapshot.length : 0;

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-3 py-1.5 bg-ds-panel border-b border-ds-border">
        <div className="flex items-center gap-2">
          <span className="text-xs text-ds-text-dim uppercase tracking-wide">
            Console ({visibleEntries.length})
          </span>
          {paused && newWhilePaused > 0 && (
            <span className="text-xs text-ds-yellow">
              +{newWhilePaused} new
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {(["all", "prints", "warnings", "errors"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`text-[10px] px-1.5 py-0.5 rounded transition-colors ${
                filter === f
                  ? "bg-ds-accent text-white"
                  : "text-ds-text-dim hover:text-ds-text"
              }`}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
          <button
            onClick={togglePause}
            className={`text-xs transition-colors ${
              paused
                ? "text-ds-yellow hover:text-ds-text"
                : "text-ds-text-dim hover:text-ds-text"
            }`}
            title={paused ? "Resume auto-scroll" : "Pause auto-scroll"}
          >
            {paused ? "▶ Resume" : "⏸ Pause"}
          </button>
          <button
            onClick={() => { clear(); if (paused) setSnapshot([]); }}
            className="text-xs text-ds-text-dim hover:text-ds-text transition-colors"
          >
            Clear
          </button>
        </div>
      </div>
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-2 font-mono text-xs leading-5 bg-ds-bg"
      >
        {visibleEntries.length === 0 ? (
          <div className="text-ds-text-dim text-center py-4">
            No messages yet.
          </div>
        ) : (
          visibleEntries.map((entry, i) => (
            <div
              key={`${entry.sequence}-${i}`}
              className={`${entry.is_error ? "text-ds-red" : entry.is_warning ? "text-ds-orange" : "text-ds-text"} break-words`}
            >
              <span className="text-ds-text-dim mr-2">
                [{formatTimestamp(entry.timestamp)}]
              </span>
              {entry.message}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
