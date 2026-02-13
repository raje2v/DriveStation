import { useState, useEffect } from "react";
import { check } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";

function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

type UpdateState =
  | { status: "idle" }
  | { status: "checking" }
  | { status: "available"; version: string; body: string }
  | { status: "downloading"; progress: number }
  | { status: "ready" }
  | { status: "up-to-date" }
  | { status: "error"; message: string };

export default function UpdateChecker() {
  const [state, setState] = useState<UpdateState>({ status: "idle" });

  // Check for updates on mount (with a short delay to not block startup)
  useEffect(() => {
    if (!isTauri()) return;
    const timer = setTimeout(() => checkForUpdate(), 3000);
    return () => clearTimeout(timer);
  }, []);

  const checkForUpdate = async () => {
    setState({ status: "checking" });
    try {
      const update = await check();
      if (update) {
        setState({
          status: "available",
          version: update.version,
          body: update.body || "",
        });
      } else {
        setState({ status: "up-to-date" });
        // Auto-dismiss after 3s
        setTimeout(() => setState({ status: "idle" }), 3000);
      }
    } catch (e) {
      setState({ status: "error", message: String(e) });
      setTimeout(() => setState({ status: "idle" }), 5000);
    }
  };

  const installUpdate = async () => {
    setState({ status: "downloading", progress: 0 });
    try {
      const update = await check();
      if (!update) return;

      let totalBytes = 0;
      let downloadedBytes = 0;

      await update.downloadAndInstall((event) => {
        if (event.event === "Started" && event.data.contentLength) {
          totalBytes = event.data.contentLength;
        } else if (event.event === "Progress") {
          downloadedBytes += event.data.chunkLength;
          const progress = totalBytes > 0 ? (downloadedBytes / totalBytes) * 100 : 0;
          setState({ status: "downloading", progress });
        } else if (event.event === "Finished") {
          setState({ status: "ready" });
        }
      });

      setState({ status: "ready" });
    } catch (e) {
      setState({ status: "error", message: String(e) });
    }
  };

  const handleRelaunch = async () => {
    await relaunch();
  };

  if (state.status === "idle" || state.status === "checking") {
    return null;
  }

  return (
    <div className="fixed top-12 right-3 z-50 w-72 bg-ds-panel border border-ds-border rounded-lg shadow-lg overflow-hidden">
      {state.status === "up-to-date" && (
        <div className="px-4 py-3 text-sm text-ds-green">
          You're on the latest version.
        </div>
      )}

      {state.status === "available" && (
        <div className="flex flex-col">
          <div className="px-4 py-3">
            <div className="text-sm font-medium text-ds-text">
              Update Available: v{state.version}
            </div>
            {state.body && (
              <p className="text-xs text-ds-text-dim mt-1 line-clamp-3">
                {state.body}
              </p>
            )}
          </div>
          <div className="flex border-t border-ds-border">
            <button
              onClick={() => setState({ status: "idle" })}
              className="flex-1 px-3 py-2 text-xs text-ds-text-dim hover:bg-ds-border transition-colors"
            >
              Later
            </button>
            <button
              onClick={installUpdate}
              className="flex-1 px-3 py-2 text-xs font-medium text-white bg-ds-accent hover:bg-ds-accent/80 transition-colors"
            >
              Install & Restart
            </button>
          </div>
        </div>
      )}

      {state.status === "downloading" && (
        <div className="px-4 py-3">
          <div className="text-sm text-ds-text mb-2">Downloading update...</div>
          <div className="h-1.5 bg-ds-bg rounded-full overflow-hidden">
            <div
              className="h-full bg-ds-accent transition-all"
              style={{ width: `${state.progress}%` }}
            />
          </div>
          <div className="text-xs text-ds-text-dim mt-1 text-right">
            {state.progress.toFixed(0)}%
          </div>
        </div>
      )}

      {state.status === "ready" && (
        <div className="flex flex-col">
          <div className="px-4 py-3 text-sm text-ds-green">
            Update installed. Restart to apply.
          </div>
          <div className="border-t border-ds-border">
            <button
              onClick={handleRelaunch}
              className="w-full px-3 py-2 text-xs font-medium text-white bg-ds-accent hover:bg-ds-accent/80 transition-colors"
            >
              Restart Now
            </button>
          </div>
        </div>
      )}

      {state.status === "error" && (
        <div className="px-4 py-3">
          <div className="text-sm text-ds-red">Update check failed</div>
          <p className="text-xs text-ds-text-dim mt-1">{state.message}</p>
        </div>
      )}
    </div>
  );
}
