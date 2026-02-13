import { useState, useEffect, useRef } from "react";
import { useRobotStore } from "../stores/robotStore";

const AUTO_DURATION = 15;
const TELEOP_DURATION = 135;

export interface MatchTimerState {
  phase: "Auto" | "Teleop" | "Idle";
  timeRemaining: number;
  isRunning: boolean;
}

export function useMatchTimer(): MatchTimerState {
  const { state } = useRobotStore();
  const [timer, setTimer] = useState<MatchTimerState>({
    phase: "Idle",
    timeRemaining: 0,
    isRunning: false,
  });
  const startTimeRef = useRef<number | null>(null);
  const durationRef = useRef(0);

  useEffect(() => {
    if (!state.enabled) {
      startTimeRef.current = null;
      setTimer({ phase: "Idle", timeRemaining: 0, isRunning: false });
      return;
    }

    const phase = state.mode === "Autonomous" ? "Auto" : "Teleop";
    const duration = state.mode === "Autonomous" ? AUTO_DURATION : TELEOP_DURATION;

    startTimeRef.current = Date.now();
    durationRef.current = duration;
    setTimer({ phase, timeRemaining: duration, isRunning: true });

    const interval = setInterval(() => {
      if (startTimeRef.current === null) return;
      const elapsed = (Date.now() - startTimeRef.current) / 1000;
      const remaining = Math.max(0, durationRef.current - elapsed);
      setTimer({ phase, timeRemaining: remaining, isRunning: remaining > 0 });
    }, 100);

    return () => clearInterval(interval);
  }, [state.enabled, state.mode]);

  return timer;
}
