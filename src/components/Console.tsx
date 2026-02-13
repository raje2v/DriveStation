import { useEffect, useRef, useState } from "react";
import { useLogStore } from "../stores/logStore";

export default function Console() {
  const { entries, clear } = useLogStore();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [paused, setPaused] = useState(false);
  const pausedAtRef = useRef<number>(0);

  useEffect(() => {
    if (!paused && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [entries, paused]);

  const togglePause = () => {
    if (!paused) {
      pausedAtRef.current = entries.length;
    }
    setPaused((p) => !p);
  };

  const newWhilePaused = paused ? entries.length - pausedAtRef.current : 0;

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-3 py-1.5 bg-ds-panel border-b border-ds-border">
        <div className="flex items-center gap-2">
          <span className="text-xs text-ds-text-dim uppercase tracking-wide">
            Console ({entries.length})
          </span>
          {paused && newWhilePaused > 0 && (
            <span className="text-xs text-ds-yellow">
              +{newWhilePaused} new
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
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
            onClick={clear}
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
        {entries.length === 0 ? (
          <div className="text-ds-text-dim text-center py-4">
            No messages yet.
          </div>
        ) : (
          entries.map((entry, i) => (
            <div
              key={`${entry.sequence}-${i}`}
              className={`${entry.is_error ? "text-ds-red" : "text-ds-text"} break-words`}
            >
              <span className="text-ds-text-dim mr-2">
                [{entry.timestamp.toFixed(3)}]
              </span>
              {entry.message}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
