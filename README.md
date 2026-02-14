# DriveStation

**Cross-platform FRC Driver Station for macOS, Windows, and Linux**

> **Beta** - Developed and used by [Team 245 - Adambots](https://www.adambots.com/)

DriveStation is an open-source alternative to the NI FRC Driver Station, built with [Tauri](https://tauri.app/) and React. It implements the FRC Driver Station protocol directly, communicating with the roboRIO over UDP (ports 1110/1150) and TCP (port 1740).

## Features

- **Robot Control** - Enable/disable, E-Stop, mode switching (Teleop/Auto/Test)
- **Gamepad Support** - Up to 6 gamepads with drag-to-reorder and slot locking
- **Live Console** - roboRIO stdout/stderr with pause/resume and log file saving
- **Real-time Charts** - Battery, CPU, RAM, CAN utilization with mode-colored background bands (Disable/Auto/Tele/Test) and selectable time ranges (12s, 1m, 5m)
- **Match Timer** - Auto (15s) and Teleop (135s) countdown timers
- **Diagnostics** - roboRIO resource usage, version info, CAN metrics, power rail faults
- **Connection Breakdown** - Ethernet, radio, robot, FMS, WiFi, USB status indicators
- **PC Status** - Local battery level and CPU usage
- **Dashboard Launching** - Auto-detect and launch Shuffleboard, Elastic, or AdvantageScope
- **mDNS Discovery** - Automatic roboRIO discovery with static IP fallback
- **Settings Persistence** - Team number, alliance, and dashboard choice saved across sessions
- **Game Data** - Send game-specific strings to the robot (TLV tag 0x0E)
- **Compact Mode** - Snap to top/bottom of screen for minimal footprint
- **Auto-Update** - Checks GitHub releases for updates with one-click install
- **Keyboard Shortcuts** - `[` + `]` + `\` to enable, `Enter` to disable, `Space` for E-Stop

## Download

Pre-built binaries for all platforms are available on the [Releases](https://github.com/raje2v/DriveStation/releases) page:

| Platform | Files |
|----------|-------|
| macOS (Apple Silicon) | `.dmg` |
| macOS (Intel) | `.dmg` |
| Windows | `.msi`, `.exe` |
| Linux | `.deb`, `.AppImage` |

> **macOS note:** Since the app is not signed with an Apple Developer certificate, macOS Gatekeeper may report "app is damaged." To fix this, run in Terminal after installing:
> ```bash
> xattr -cr /Applications/DriveStation.app
> ```

## Building from Source

### Prerequisites

- [Rust](https://rustup.rs/) (stable)
- [Node.js](https://nodejs.org/) 20+
- [pnpm](https://pnpm.io/)
- Platform-specific dependencies:
  - **macOS**: Xcode Command Line Tools
  - **Windows**: Visual Studio Build Tools, WebView2
  - **Linux**: `libwebkit2gtk-4.1-dev libappindicator3-dev librsvg2-dev patchelf libudev-dev`

### Development

```bash
pnpm install
npx tauri dev
```

### Production Build

```bash
pnpm install
npx tauri build
```

The built application will be in `src-tauri/target/release/bundle/`.

## Architecture

- **Frontend**: React + TypeScript + Tailwind CSS + Zustand (state management) + Recharts
- **Backend**: Rust + Tauri v2 + Tokio (async runtime)
- **Protocol**: Direct FRC DS protocol implementation (UDP control packets, TCP console/version/power data)
- **Gamepad**: gilrs crate for cross-platform gamepad input

## License

MIT License - see [LICENSE](LICENSE) for details.
