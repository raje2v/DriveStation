import { useCallback } from "react";
import { useWindowStore } from "../stores/windowStore";

function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

// Get the usable screen area (excludes macOS menu bar + Dock, Windows taskbar,
// Linux panels). Values are in CSS/logical pixels and work cross-platform.
function getWorkArea() {
  const s = window.screen;
  return {
    x: (s as any).availLeft ?? 0,
    y: (s as any).availTop ?? 0,
    width: s.availWidth,
    height: s.availHeight,
  };
}

const COMPACT_HEIGHT = 48;

export function useCompactMode() {
  const { compactMode, setCompactMode, setCompactPosition } = useWindowStore();

  const snapCompact = useCallback(
    async (position: "top" | "bottom") => {
      if (!isTauri() || compactMode) return;

      try {
        const { getCurrentWindow } = await import("@tauri-apps/api/window");
        const { LogicalSize, LogicalPosition } = await import(
          "@tauri-apps/api/dpi"
        );

        const win = getCurrentWindow();
        const work = getWorkArea();

        // Hide title bar for a clean compact look
        await win.setDecorations(false);
        await win.setMinSize(new LogicalSize(800, COMPACT_HEIGHT));
        await win.setSize(new LogicalSize(work.width, COMPACT_HEIGHT));

        if (position === "top") {
          await win.setPosition(new LogicalPosition(work.x, work.y));
        } else {
          await win.setPosition(
            new LogicalPosition(
              work.x,
              work.y + work.height - COMPACT_HEIGHT,
            ),
          );
        }

        await win.setAlwaysOnTop(true);
        await win.setResizable(false);

        setCompactPosition(position);
        setCompactMode(true);
      } catch (err) {
        console.error("Compact mode snap failed:", err);
      }
    },
    [compactMode, setCompactMode, setCompactPosition],
  );

  const restoreFromCompact = useCallback(async () => {
    if (!isTauri() || !compactMode) return;

    try {
      const { getCurrentWindow } = await import("@tauri-apps/api/window");
      const { LogicalSize, LogicalPosition } = await import(
        "@tauri-apps/api/dpi"
      );

      const win = getCurrentWindow();

      // Restore defaults
      await win.setAlwaysOnTop(false);
      await win.setResizable(true);
      await win.setDecorations(true);
      await win.setMinSize(new LogicalSize(800, 450));

      // Restore to default startup size (from tauri.conf.json)
      const defaultW = 900;
      const defaultH = 520;
      await win.setSize(new LogicalSize(defaultW, defaultH));

      // Center within the usable work area
      const work = getWorkArea();
      await win.setPosition(
        new LogicalPosition(
          work.x + (work.width - defaultW) / 2,
          work.y + (work.height - defaultH) / 2,
        ),
      );

      setCompactMode(false);
    } catch (err) {
      console.error("Compact mode restore failed:", err);
    }
  }, [compactMode, setCompactMode]);

  return { compactMode, snapCompact, restoreFromCompact };
}
