<div align="center">

# TimekeepGUI

参考项目
https://github.com/jms-guy/timekeep
https://github.com/Ceceliaee/patina
将patina的GUI和timekeep的功能结合

Local-first time tracking for Windows desktop work.

English · [简体中文](README.zh-CN.md)

![Platform](https://img.shields.io/badge/platform-Windows-4f6f8f)
![Built with Tauri](https://img.shields.io/badge/built%20with-Tauri%20v2-4f7f8f)
![Local first](https://img.shields.io/badge/data-local--first-5f7f68)
[![License](https://img.shields.io/badge/license-MIT-6f647a)](LICENSE)

</div>


<p align="center">
TimekeepGUI combines local foreground activity tracking with a quiet, trustworthy desktop time-management interface.
</p>

## 项目定位

TimekeepGUI 是一个 Windows 桌面端时间管理项目，使用 Patina 的 Tauri/React 图形界面承载 Timekeep 的程序追踪、活动会话、历史记录和统计能力。

当前仓库的父级目录 `E:\Github\TimekeepGUI` 是实际 GUI 项目根目录。`sample/` 仅用于保存参考项目，不参与前端、Rust 或 Release 构建。

## 工作方式

GUI 通过 Rust/Tauri command 调用 Timekeep bridge，再通过 Windows named pipe 与 Timekeep service 通信：

```text
React/TypeScript GUI
        ↓
Tauri command: cmd_timekeep_request
        ↓
Windows named pipe: \\.\pipe\Timekeep
        ↓
Timekeep service
```

Timekeep service 未运行时，GUI 仍可以启动，但 Timekeep 页面会显示服务不可用。Windows 服务端需要监听 `\\.\pipe\Timekeep`，请求和响应使用逐行 JSON 格式。

## 目录结构

```text
TimekeepGUI/
├─ src/                 React、TypeScript 和页面功能
├─ src-tauri/           Rust/Tauri 桌面端、Windows 集成和 IPC bridge
├─ tests/               前端、集成和 UI 测试
├─ scripts/             检查、生成和 Release 脚本
├─ .vscode/             推荐插件、任务和调试配置
└─ sample/              Patina/Timekeep 参考代码，不参与本项目构建
```

<p align="center">
  <img src=".github/assets/readme/hero.png" alt="TimekeepGUI dashboard">
</p>

## Why TimekeepGUI

- Records foreground apps automatically, without manually starting or stopping timers.
- Handles idle, lock, sleep, and abnormal-exit boundaries to keep records more trustworthy.
- Keeps data local by default, with no account, cloud sync, or server dependency.
- Lets you manage app names, categories, colors, stats exclusions, and window title capture.
- Provides lightweight local tools such as reminders, timers, and Pomodoro.
- Keeps the interface restrained, clear, and low-interruption for long-term daily use.

## Download

TimekeepGUI 当前版本需要从源码构建，独立 Release 页面将在项目正式发布后补充。构建方法见下方 [Build From Source](#build-from-source)。

Patina 的公开版本和素材仅作为本项目的参考来源，不代表 TimekeepGUI 的发行包。

[Patina Web Sync](https://github.com/Ceceliaee/patina-web-sync) adds specific webpage details to browser activity. Install it as needed:

<p align="center">
  <a href="https://chromewebstore.google.com/detail/patina-web-sync/gimdckblhckibmeklhemgccabmbnoemd"><img src=".github/assets/store-badges/chrome-web-store.png" height="36" alt="Install Patina Web Sync from the Chrome Web Store"></a>
  <a href="https://addons.mozilla.org/firefox/addon/patina-web-sync/"><img src=".github/assets/store-badges/firefox-add-ons.svg" height="36" alt="Install Patina Web Sync from Firefox Add-ons"></a>
  <a href="https://microsoftedge.microsoft.com/addons/detail/gogmlpjhbfjghilmpcciedplifdiibai"><img src=".github/assets/store-badges/edge-add-ons.png" height="36" alt="Install Patina Web Sync from Microsoft Edge Add-ons"></a>
</p>

## Core Features

### Automatic Tracking

- Automatically records the current foreground app and turns activity into time records.
- Detects idle, lock, and sleep states to reduce invalid time in statistics.
- Handles record boundaries after long-away periods and abnormal exits, reducing accidentally merged time.
- Reduces missed effective activity in low-interaction scenarios such as videos, meetings, courses, and livestreams.

### Review And Analysis

- Review effective activity, app rankings, and category distribution in today's overview.
- Use the timeline to review activity by date and inspect app switches and window title details.
- Understand long-term time distribution through trends, heatmaps, and app curves.

### Management And Control

- Rename apps and adjust categories, colors, and statistics rules.
- Exclude apps you do not want in statistics, or disable window title capture for specific apps.
- Export local backups, restore backups, and clean up historical records.

### Lightweight Tools

- Create one-off reminders and app usage limit reminders.
- Use stopwatch, countdown, and Pomodoro for active focus tasks.
- Tool state stays local and does not replace automatic tracking records.

## Interface Preview

<table>
  <tr>
    <td width="50%" align="center"><strong>History</strong></td>
    <td width="50%" align="center"><strong>Data</strong></td>
  </tr>
  <tr>
    <td width="50%"><img src=".github/assets/readme/history.png" alt="History page"></td>
    <td width="50%"><img src=".github/assets/readme/data.png" alt="Data page"></td>
  </tr>
  <tr>
    <td width="50%" align="center"><strong>Classification</strong></td>
    <td width="50%" align="center"><strong>Tools</strong></td>
  </tr>
  <tr>
    <td width="50%"><img src=".github/assets/readme/classification.png" alt="Classification page"></td>
    <td width="50%"><img src=".github/assets/readme/tools.png" alt="Tools page"></td>
  </tr>
  <tr>
    <td width="50%" align="center"><strong>Settings</strong></td>
    <td width="50%" align="center"><strong>About</strong></td>
  </tr>
  <tr>
    <td width="50%"><img src=".github/assets/readme/settings.png" alt="Settings page"></td>
    <td width="50%"><img src=".github/assets/readme/about.png" alt="About page"></td>
  </tr>
</table>

## Reliability And Privacy

Time tracking has long-term value only when the records are trustworthy. TimekeepGUI focuses on these boundaries:

- **Foreground app recognition**: records the window and app that are actually in the foreground, reducing temporary-window and system noise.
- **Idle handling**: idle time does not continue counting as effective activity.
- **State boundaries**: handles record boundaries after lock, sleep, resume, long-away periods, and abnormal exits.
- **Effective-duration stats**: rankings, distributions, and totals use effective activity time, not just open spans.
- **Title capture control**: window title capture can be disabled per app to reduce unnecessary sensitive information retention.
- **Local data control**: core data stays local, and backups, restores, and history cleanup are initiated by the user.

## Current Scope

TimekeepGUI currently focuses on personal local time records:

- Windows 10/11 desktop use
- Personal local data storage and control
- Automatic tracking, review, classification, and backup or restore
- Lightweight local tools

It is not currently aimed at team collaboration, account systems, cloud sync, multi-platform sync, or heavy AI insights.

## Build From Source

### Requirements

- Windows 10/11 x64
- [Node.js](https://nodejs.org/) `25.8.0` and npm `11.11.0`
- [Rust](https://www.rust-lang.org/tools/install) `1.94.1` with the `x86_64-pc-windows-msvc` toolchain
- Visual Studio C++ Build Tools and Windows 10/11 SDK

The Node and Rust versions are pinned in [`.node-version`](.node-version) and [`rust-toolchain.toml`](rust-toolchain.toml).

### Install Dependencies

```powershell
cd E:\Github\TimekeepGUI
npm ci
```

### Run In Development

```powershell
npm run tauri dev
```

Start the Timekeep service separately before using the Timekeep page. The GUI connects to the Windows named pipe `\\.\pipe\Timekeep` and does not start the service automatically.

### Build Installer

```powershell
# Unsigned local installer
npm run tauri -- build --bundles nsis --no-sign

# Signed installer (requires TAURI_SIGNING_PRIVATE_KEY and
# TAURI_SIGNING_PRIVATE_KEY_PASSWORD in the environment)
npm run tauri -- build --bundles nsis
```

Installers are generated under:

```text
src-tauri/target/release/bundle/nsis/
```

The signed build also generates the updater signature file `*.exe.sig`. Keep the updater private key outside the repository and never commit it.

## Tech Stack

- Desktop shell: Tauri v2
- Native backend and Windows integration: Rust
- Time tracking service: Timekeep (Go), connected through local IPC
- Frontend: React + Vite + TypeScript
- Styling: Tailwind CSS
- Animation: Framer Motion
- Charts: Recharts
- Database: SQLite via `@tauri-apps/plugin-sql`
- Windows integration: `windows` crate

## Contributing

If you want to contribute, understand the product direction, or review architecture boundaries, start with [`CONTRIBUTING.md`](CONTRIBUTING.md#english).

## Feedback

Use GitHub Issues for bugs and feedback that needs follow-up, or scan the QR code to join the QQ channel for everyday conversation:

<div align="center">
  <a href="https://github.com/Ceceliaee/patina/issues/new/choose">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset=".github/assets/feedback/github-issues-button-dark.svg">
      <img src=".github/assets/feedback/github-issues-button-light.svg" height="36" alt="GitHub Issues">
    </picture>
  </a>
  <br><br>
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset=".github/assets/feedback/qq-channel-dark.jpg">
    <img src=".github/assets/feedback/qq-channel-light.jpg" width="200" alt="Patina QQ channel QR code">
  </picture>
</div>

## Support

TimekeepGUI is a personal, local-first open-source project. If it has been useful in your daily life or work, you can support ongoing maintenance in whichever way is convenient:

<div align="center">
  <a href="https://ko-fi.com/ceceliaee"><img src="https://storage.ko-fi.com/cdn/kofi2.png?v=3" height="36" alt="Buy me a coffee"></a>
  <br><br>
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset=".github/assets/support/wechat-reward-dark.png">
    <img src=".github/assets/support/wechat-reward-light.png" width="200" alt="WeChat reward code">
  </picture>
</div>

Sponsorship helps sustain maintenance, but it does not affect feature priority, issue handling, the roadmap, or the product direction.

## Star History

<a href="https://www.star-history.com/?repos=Ceceliaee%2Fpatina">
 <picture>
   <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/chart?repos=Ceceliaee/patina&type=date&theme=dark&legend=top-left&sealed_token=TkOqzStKb8XlqP6BGjPQemnL7ZceKzqtuxfJf7xf_DrzNfgZeW2TjJDSbHigf23UNcY-30x56ZaebW5RV1tbcW2Q_5UczdmmdB2ndfELHsoLcpYL5hIHvw" />
   <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/chart?repos=Ceceliaee/patina&type=date&legend=top-left&sealed_token=TkOqzStKb8XlqP6BGjPQemnL7ZceKzqtuxfJf7xf_DrzNfgZeW2TjJDSbHigf23UNcY-30x56ZaebW5RV1tbcW2Q_5UczdmmdB2ndfELHsoLcpYL5hIHvw" />
   <img alt="Star History Chart" src="https://api.star-history.com/chart?repos=Ceceliaee/patina&type=date&legend=top-left&sealed_token=TkOqzStKb8XlqP6BGjPQemnL7ZceKzqtuxfJf7xf_DrzNfgZeW2TjJDSbHigf23UNcY-30x56ZaebW5RV1tbcW2Q_5UczdmmdB2ndfELHsoLcpYL5hIHvw" />
 </picture>
</a>

## License

[MIT](LICENSE)
