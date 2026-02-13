import { useState, useEffect, useCallback, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useTauriEvents } from "./hooks/useTauriEvents";
import { useGamepadPolling } from "./hooks/useGamepad";
import { useRobotStore } from "./stores/robotStore";
import OperationTab from "./components/tabs/OperationTab";
import DiagnosticsTab from "./components/tabs/DiagnosticsTab";
import SetupTab from "./components/tabs/SetupTab";
import USBDevicesTab from "./components/tabs/USBDevicesTab";
import StatusBar from "./components/StatusBar";
import Console from "./components/Console";
import Charts from "./components/Charts";

type Tab = "operation" | "diagnostics" | "setup" | "usb";
type RightPanel = "console" | "charts" | "both";

const TABS: { id: Tab; label: string }[] = [
  { id: "operation", label: "Operation" },
  { id: "diagnostics", label: "Diagnostics" },
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
  const enabledStartRef = useRef<number | null>(null);
  // Track held keys for the three-key enable combo: [ ] backslash
  const heldKeys = useRef<Set<string>>(new Set());

  // Subscribe to Tauri events
  useTauriEvents();
  useGamepadPolling();

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

    heldKeys.current.add(e.key);

    // Enable: [ + ] + \ (all three held)
    if (
      heldKeys.current.has("[") &&
      heldKeys.current.has("]") &&
      heldKeys.current.has("\\")
    ) {
      e.preventDefault();
      safeInvoke("enable_robot");
      return;
    }

    switch (e.key) {
      case "Enter":
        e.preventDefault();
        safeInvoke("disable_robot");
        break;
      case " ":
        e.preventDefault();
        safeInvoke("estop_robot");
        break;
    }
  }, []);

  const handleKeyUp = useCallback((e: KeyboardEvent) => {
    heldKeys.current.delete(e.key);
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
      case "setup":
        return <SetupTab />;
      case "usb":
        return <USBDevicesTab />;
    }
  };

  return (
    <div className="h-screen flex flex-col bg-ds-bg">
      {/* Tab Bar */}
      <div className="flex bg-ds-panel border-b border-ds-border">
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
