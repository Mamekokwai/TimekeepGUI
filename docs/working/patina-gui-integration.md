# TimekeepGUI / Patina 联调说明

## 运行前提

- Windows：安装 Go、Rust、Cargo 和 Node.js 25.8.0；npm 使用 11.11.0。
- 启动 Timekeep Service 后，Patina 通过 `\\.\pipe\Timekeep` 访问服务。
- Linux 使用 `/var/run/timekeep/timekeep.sock`。
- Windows Service 配置文件位置为 `C:\ProgramData\Timekeep\config\config.json`。

## VS Code

在项目根目录运行任务：

- `Patina: Install dependencies`
- `Patina: Tauri Dev + Timekeep Service`
- `Patina: Browser Smoke`

后一个任务会并行启动 `go run ./cmd/service --debug` 和 `npm run tauri -- dev`。

## GUI 入口

侧栏的 `Timekeep` 页面提供：

- 追踪程序的添加、编辑、移除、单个/全部统计重置和累计时长查看；
- 活跃会话与历史记录查询，支持程序、日期、数量筛选；
- WakaTime/Wakapi、轮询间隔和轮询宽限设置；
- 服务刷新和全部统计重置（重置前确认）。

主 Dashboard 只读展示 Timekeep Service 状态，不复制 Patina 自己的统计业务逻辑。

## 验证命令

在 `sample/patina` 目录执行：

```powershell
npm run check:i18n
npm run check:types
npm run check:lint
npm run check:architecture
npm run check:ipc-contracts
npm run test:ui-browser-smoke
npm test
npm run build
npm run check:rust
```

在项目根目录执行：

```powershell
go test ./...
```

当前 Windows 环境的 Go 位于 `C:\Program Files\Go`，VS Code 已配置 `go.goroot`；如果 Go 依赖尚未缓存，需要先恢复网络后执行完整测试。Cargo/Rust 仍需安装后才能进行 Tauri 原生验证。GUI 不直接读取 SQLite 或配置文件，所有 Timekeep 数据由 Go Service 返回。

`test:ui-browser-smoke` 使用 Vite 与 Tauri stub 验证 GUI 页面和 IPC gateway 的交互；它不替代真实 Tauri/Windows named pipe 联调。
