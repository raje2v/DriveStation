import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useRobotStore } from "../../stores/robotStore";

const ALLIANCES = [
  "Red1", "Red2", "Red3",
  "Blue1", "Blue2", "Blue3",
] as const;

function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

export default function SetupTab() {
  const { teamNumber, alliance, autoDashboard, setTeamNumber, setAlliance, setAutoDashboard } =
    useRobotStore();
  const [teamInput, setTeamInput] = useState(teamNumber.toString());
  const [gameData, setGameData] = useState("");
  const [installedDashboards, setInstalledDashboards] = useState<string[]>([]);
  const [dashboardError, setDashboardError] = useState<string | null>(null);

  // Query which dashboards are installed
  useEffect(() => {
    if (!isTauri()) return;
    invoke<string[]>("get_installed_dashboards").then(setInstalledDashboards);
  }, []);

  const handleTeamSubmit = () => {
    const team = parseInt(teamInput, 10);
    if (!isNaN(team) && team >= 0 && team <= 99999) {
      setTeamNumber(team);
      invoke("set_team_number", { team });
    }
  };

  const handleAllianceChange = (a: string) => {
    setAlliance(a);
    invoke("set_alliance", { alliance: a });
  };

  const handleGameDataSubmit = () => {
    if (isTauri()) {
      invoke("set_game_data", { data: gameData });
    }
  };

  const handleDashboardChange = async (value: string) => {
    setAutoDashboard(value);
    setDashboardError(null);
    if (value && isTauri()) {
      try {
        await invoke("launch_dashboard", { name: value });
      } catch (e) {
        setDashboardError(String(e));
      }
    }
  };

  return (
    <div className="flex flex-col gap-4 p-4">
      {/* Team Number */}
      <section>
        <h3 className="text-xs text-ds-text-dim uppercase tracking-wide mb-2">
          Team Number
        </h3>
        <div className="flex gap-2">
          <input
            type="number"
            value={teamInput}
            onChange={(e) => setTeamInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleTeamSubmit()}
            min={0}
            max={99999}
            className="flex-1 bg-ds-panel border border-ds-border rounded px-3 py-2 text-sm text-ds-text outline-none focus:border-ds-accent"
            placeholder="Team #"
          />
          <button
            onClick={handleTeamSubmit}
            className="px-4 py-2 rounded text-sm font-medium bg-ds-accent text-white hover:bg-ds-accent/80 transition-colors"
          >
            Set
          </button>
        </div>
        {teamNumber === 0 && (
          <p className="text-xs text-ds-text-dim mt-1">
            Team 0 = simulation mode (connects to localhost)
          </p>
        )}
      </section>

      {/* Alliance Station */}
      <section>
        <h3 className="text-xs text-ds-text-dim uppercase tracking-wide mb-2">
          Alliance Station
        </h3>
        <div className="grid grid-cols-3 gap-1">
          {ALLIANCES.map((a) => (
            <button
              key={a}
              onClick={() => handleAllianceChange(a)}
              className={`py-2 rounded text-xs font-medium transition-colors ${
                alliance === a
                  ? a.startsWith("Red")
                    ? "bg-ds-red text-white"
                    : "bg-ds-accent text-white"
                  : "bg-ds-panel text-ds-text-dim hover:bg-ds-border"
              }`}
            >
              {a.replace(/(\d)/, " $1")}
            </button>
          ))}
        </div>
      </section>

      {/* Network Info */}
      <section>
        <h3 className="text-xs text-ds-text-dim uppercase tracking-wide mb-2">
          Network
        </h3>
        <div className="bg-ds-panel rounded p-3 text-sm">
          <div className="flex justify-between">
            <span className="text-ds-text-dim">Target IP</span>
            <span className="font-mono">
              {teamNumber === 0
                ? "127.0.0.1"
                : `10.${Math.floor(teamNumber / 100)}.${teamNumber % 100}.2`}
            </span>
          </div>
          <div className="flex justify-between mt-1">
            <span className="text-ds-text-dim">DS Port (send)</span>
            <span className="font-mono">1110</span>
          </div>
          <div className="flex justify-between mt-1">
            <span className="text-ds-text-dim">DS Port (recv)</span>
            <span className="font-mono">1150</span>
          </div>
        </div>
      </section>

      {/* Game Data */}
      <section>
        <h3 className="text-xs text-ds-text-dim uppercase tracking-wide mb-2">
          Game Data
        </h3>
        <div className="flex gap-2">
          <input
            type="text"
            value={gameData}
            onChange={(e) => setGameData(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleGameDataSubmit()}
            maxLength={64}
            className="flex-1 min-w-0 bg-ds-panel border border-ds-border rounded px-3 py-2 text-sm text-ds-text font-mono outline-none focus:border-ds-accent"
            placeholder="e.g. LRL"
          />
          <button
            onClick={handleGameDataSubmit}
            className="px-3 py-2 rounded text-sm font-medium bg-ds-accent text-white hover:bg-ds-accent/80 transition-colors flex-shrink-0"
          >
            Set
          </button>
        </div>
      </section>

      {/* Dashboard */}
      <section>
        <h3 className="text-xs text-ds-text-dim uppercase tracking-wide mb-2">
          Dashboard (auto-launch)
        </h3>
        <select
          value={autoDashboard}
          onChange={(e) => handleDashboardChange(e.target.value)}
          className="w-full bg-ds-panel border border-ds-border rounded px-3 py-2 text-sm text-ds-text outline-none focus:border-ds-accent"
        >
          <option value="">None</option>
          {installedDashboards.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
        {installedDashboards.length === 0 && (
          <p className="text-xs text-ds-text-dim mt-1">
            No dashboards detected
          </p>
        )}
        {dashboardError && (
          <p className="text-xs text-ds-red mt-1">{dashboardError}</p>
        )}
      </section>

      {/* Keyboard Shortcuts */}
      <section>
        <h3 className="text-xs text-ds-text-dim uppercase tracking-wide mb-2">
          Keyboard Shortcuts
        </h3>
        <div className="bg-ds-panel rounded p-3 text-xs flex flex-col gap-1">
          <div className="flex justify-between">
            <span className="text-ds-text-dim">Enable</span>
            <div className="flex items-center gap-0.5">
              <kbd className="bg-ds-bg px-1.5 py-0.5 rounded font-mono">[</kbd>
              <span className="text-ds-text-dim">+</span>
              <kbd className="bg-ds-bg px-1.5 py-0.5 rounded font-mono">]</kbd>
              <span className="text-ds-text-dim">+</span>
              <kbd className="bg-ds-bg px-1.5 py-0.5 rounded font-mono">\</kbd>
              <span className="text-ds-text-dim ml-1">(hold together)</span>
            </div>
          </div>
          <div className="flex justify-between">
            <span className="text-ds-text-dim">Disable</span>
            <kbd className="bg-ds-bg px-2 py-0.5 rounded font-mono">Enter</kbd>
          </div>
          <div className="flex justify-between">
            <span className="text-ds-text-dim">E-Stop</span>
            <kbd className="bg-ds-bg px-2 py-0.5 rounded font-mono">Space</kbd>
          </div>
          <div className="flex justify-between">
            <span className="text-ds-text-dim">Compact Mode</span>
            <div className="flex gap-0.5">
              <kbd className="bg-ds-bg px-1.5 py-0.5 rounded font-mono">&#8984;</kbd>
              <kbd className="bg-ds-bg px-1.5 py-0.5 rounded font-mono">&#8679;</kbd>
              <kbd className="bg-ds-bg px-1.5 py-0.5 rounded font-mono">M</kbd>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
