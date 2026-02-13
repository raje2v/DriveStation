import { useState, useEffect, useCallback, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useTauriEvents } from "./hooks/useTauriEvents";
import { useGamepadPolling } from "./hooks/useGamepad";
import { useCompactMode } from "./hooks/useCompactMode";
import { useRobotStore } from "./stores/robotStore";
import OperationTab from "./components/tabs/OperationTab";
import DiagnosticsTab from "./components/tabs/DiagnosticsTab";
import SetupTab from "./components/tabs/SetupTab";
import USBDevicesTab from "./components/tabs/USBDevicesTab";
import PowerTab from "./components/tabs/PowerTab";
import StatusBar from "./components/StatusBar";
import CompactBar from "./components/CompactBar";
import Console from "./components/Console";
import Charts from "./components/Charts";

type Tab = "operation" | "diagnostics" | "power" | "setup" | "usb";
type RightPanel = "console" | "charts" | "both";

const TABS: { id: Tab; label: string }[] = [
  { id: "operation", label: "Operation" },
  { id: "diagnostics", label: "Diagnostics" },
  { id: "power", label: "Power" },
  { id: "setup", label: "Setup" },
  { id: "usb", label: "USB Devices" },
];

function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

function safeInvoke(cmd: string) {
  if (isTauri()) invoke(cmd);
}

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>("operation");
  const [rightPanel, setRightPanel] = useState<RightPanel>("console");
  const { state, setEnabledTime } = useRobotStore();
  const { compactMode, snapCompact, restoreFromCompact } = useCompactMode();
  const enabledStartRef = useRef<number | null>(null);
  const dashboardLaunched = useRef(false);
  // Track held keys for the three-key enable combo: [ ] backslash
  const heldKeys = useRef<Set<string>>(new Set());

  // Subscribe to Tauri events
  useTauriEvents();
  useGamepadPolling();

  // On mount, send persisted settings to backend + auto-launch dashboard
  useEffect(() => {
    if (!isTauri()) return;
    const { teamNumber, alliance, autoDashboard } = useRobotStore.getState();
    if (teamNumber !== 0) {
      invoke("set_team_number", { team: teamNumber });
    }
    invoke("set_alliance", { alliance });
    if (autoDashboard && !dashboardLaunched.current) {
      dashboardLaunched.current = true;
      invoke("launch_dashboard", { name: autoDashboard });
    }
  }, []);

  // Track enabled time
  useEffect(() => {
    if (state.enabled) {
      if (!enabledStartRef.current) {
        enabledStartRef.current = Date.now();
      }
      const interval = setInterval(() => {
        if (enabledStartRef.current) {
          setEnabledTime((Date.now() - enabledStartRef.current) / 1000);
        }
      }, 100);
      return () => clearInterval(interval);
    } else {
      enabledStartRef.current = null;
      setEnabledTime(0);
    }
  }, [state.enabled, setEnabledTime]);

  // Keyboard shortcuts matching official NI FRC Driver Station:
  //   Enable:  [ + ] + \ (three keys held simultaneously)
  //   Disable: Enter
  //   E-Stop:  Space
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // Don't trigger when typing in input fields
    if (
      e.target instanceof HTMLInputElement ||
      e.target instanceof HTMLTextAreaElement
    ) {
      return;
    }

    // Use e.code (physical key) for the three-key combo — more reliable
    // across keyboard layouts and avoids macOS WKWebView e.key quirks
    heldKeys.current.add(e.code);

    // Compact mode toggle: Cmd+Shift+M (Mac) / Ctrl+Shift+M (Win/Linux)
    if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.code === "KeyM") {
      e.preventDefault();
      if (compactMode) {
        restoreFromCompact();
      } else {
        snapCompact("top");
      }
      return;
    }

    // Enable: [ + ] + \ (all three held simultaneously)
    if (
      heldKeys.current.has("BracketLeft") &&
      heldKeys.current.has("BracketRight") &&
      heldKeys.current.has("Backslash")
    ) {
      e.preventDefault();
      safeInvoke("enable_robot");
      return;
    }

    switch (e.code) {
      case "Enter":
      case "NumpadEnter":
        e.preventDefault();
        safeInvoke("disable_robot");
        break;
      case "Space":
        e.preventDefault();
        safeInvoke("estop_robot");
        break;
    }
  }, [compactMode, snapCompact, restoreFromCompact]);

  const handleKeyUp = useCallback((e: KeyboardEvent) => {
    heldKeys.current.delete(e.code);
  }, []);

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [handleKeyDown, handleKeyUp]);

  const renderTab = () => {
    switch (activeTab) {
      case "operation":
        return <OperationTab />;
      case "diagnostics":
        return <DiagnosticsTab />;
      case "power":
        return <PowerTab />;
      case "setup":
        return <SetupTab />;
      case "usb":
        return <USBDevicesTab />;
    }
  };

  if (compactMode) {
    return <CompactBar onExpand={restoreFromCompact} />;
  }

  return (
    <div className="h-screen flex flex-col bg-ds-bg">
      {/* Tab Bar */}
      <div className="flex items-center bg-ds-panel border-b border-ds-border">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? "text-ds-text border-b-2 border-ds-accent bg-ds-bg"
                : "text-ds-text-dim hover:text-ds-text hover:bg-ds-bg/50"
            }`}
          >
            {tab.label}
          </button>
        ))}
        <div className="flex-1" />
        <div className="flex items-center gap-1 mr-2">
          <button
            onClick={() => snapCompact("top")}
            className="px-2 py-1 rounded text-[11px] text-ds-text-dim hover:text-ds-text hover:bg-ds-border transition-colors"
            title="Snap to top (Cmd+Shift+M)"
          >
            Snap Top
          </button>
          <button
            onClick={() => snapCompact("bottom")}
            className="px-2 py-1 rounded text-[11px] text-ds-text-dim hover:text-ds-text hover:bg-ds-border transition-colors"
            title="Snap to bottom"
          >
            Snap Bottom
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex min-h-0">
        {activeTab === "usb" ? (
          /* USB Devices tab uses full width */
          <div className="flex-1 overflow-y-auto">
            <USBDevicesTab />
          </div>
        ) : (
          <>
            {/* Left Panel - Tab content */}
            <div className="w-[280px] flex-shrink-0 border-r border-ds-border overflow-y-auto">
              {renderTab()}
            </div>

            {/* Right Panel - Console / Charts */}
            <div className="flex-1 flex flex-col min-w-0">
              {/* Panel toggle */}
              <div className="flex bg-ds-panel border-b border-ds-border">
                {(["console", "charts", "both"] as const).map((panel) => (
                  <button
                    key={panel}
                    onClick={() => setRightPanel(panel)}
                    className={`px-3 py-1 text-xs font-medium capitalize transition-colors ${
                      rightPanel === panel
                        ? "text-ds-text border-b border-ds-accent"
                        : "text-ds-text-dim hover:text-ds-text"
                    }`}
                  >
                    {panel}
                  </button>
                ))}
              </div>

              {/* Panel content */}
              <div className="flex-1 min-h-0">
                {rightPanel === "console" && <Console />}
                {rightPanel === "charts" && <Charts />}
                {rightPanel === "both" && (
                  <div className="flex flex-col h-full">
                    <div className="flex-1 min-h-0 border-b border-ds-border">
                      <Console />
                    </div>
                    <div className="h-[200px] flex-shrink-0">
                      <Charts />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Status Bar */}
      <StatusBar />
    </div>
  );
}
