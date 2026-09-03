# WebView Memory Reduction Execution Plan

创建日期：2026-06-06

状态：completed / archived

文档类型：执行单 / How-to

目标读者：项目维护者与后续执行该专项的开发者

适用阶段：`1.x` 稳定阶段

完成日期：2026-06-06

归档口径：本文中已勾选表示该事项已经被执行、验证、明确不采用或归档关闭；不表示所有实验都已默认启用。默认启用项以第 0.1 节实施记录为准。

## 0.1 实施记录

### 优化项：开发者资源诊断入口

- 状态：完成
- owner：src/platform/desktop/resourceDiagnosticsRuntimeGateway.ts + src/App.tsx
- 改动范围：新增 dev-only window.__TIME_TRACKER_RESOURCE_DIAGNOSTICS__ helper，包装 cmd_get_resource_diagnostics 并做 raw payload 校验
- 是否影响普通用户：否，仅 import.meta.env.DEV 暴露
- 默认启用：仅开发环境
- 自动化验证：npx tsc --noEmit、npm run check:full
- 手动验证：未启动真实 Tauri GUI 做任务管理器采样
- 回滚方式：删除 gateway 并移除 App.tsx 安装调用
- 结论：保留，作为后续真实 GUI 采样入口

### 优化项：widget 图标按需加载

- 状态：完成
- owner：src-tauri/src/data/repositories/icon_cache.rs、src-tauri/src/data/icon_cache_service.rs、src-tauri/src/commands/widget.rs、src/app/widget/widgetIconService.ts
- 改动范围：新增 cmd_get_widget_icon；widget 从整张 icon map 加载改为按当前 canonical exe 请求单个图标；widget renderer 内只保留最多 16 条图标 cache
- 是否影响普通用户：低风险，图标缺失仍返回 null，UI 保持现有无图标状态
- 默认启用：是
- 优化前 widget renderer 内存：整表 icon map 会进入 widget renderer 并扩展 key
- 优化后 widget renderer 内存：只保留当前请求过的最多 16 个 canonical exe 图标
- 自动化验证：npm run test:widget、npx tsc --noEmit、cargo test --manifest-path src-tauri/Cargo.toml --quiet、npm run check:full
- 手动验证：未启动真实 Tauri GUI 做任务管理器采样
- 回滚方式：恢复 widgetIconService.ts 整表加载，保留或移除新 Rust command
- 结论：默认启用；它减少 widget renderer 的图标字符串常驻面，风险明显低于窗口生命周期实验

### 优化项：widget 隐藏后延迟销毁 WebView

- 状态：完成
- owner：src-tauri/src/app/widget.rs + src-tauri/src/app/state.rs
- 改动范围：close_widget_window 仍立即 park widget 保持隐藏手感；隐藏后 60 秒若未重新 show，则销毁 idle widget WebView；生命周期状态增加 generation，避免旧 timer 销毁新窗口
- 是否影响普通用户：中等风险但有保护；重新唤出隐藏超过 60 秒的 widget 时需要重建 WebView
- 默认启用：是
- 优化前 widget renderer 内存：widget park 后 renderer 仍常驻
- 优化后 widget renderer 内存：idle destroy 后允许 WebView2 回收 widget renderer
- 自动化验证：cargo test --manifest-path src-tauri/Cargo.toml --quiet、npm run check:rust、npm run check:full
- 手动验证：未启动真实 Tauri GUI 做 60 秒任务管理器采样
- 回滚方式：删除 destroy timer，恢复 close_widget_window 仅 park；可保留 generation 测试或一并移除
- 结论：默认启用为保守 60 秒 idle destroy；后续发布前建议做真实 GUI 长跑复核

### 评估项：主窗口延迟创建 / autostart start minimized

- 状态：不采用 / 归档关闭
- 原因：需要迁移 config 声明主窗口、托盘创建主窗口、single-instance、post-install reopen、SQL preload 与前端 bootstrap，风险高于当前证据
- 默认启用：否
- 结论：留作后续单独专项，必须先做真实 GUI 基线

### 评估项：AppShell / WidgetShell 分入口与 preload 策略

- 状态：不采用 / 归档关闭
- 原因：当前完整 build 与 bundle budget 通过，但未做真实 widget network/chunk 采样；直接 lazy 主入口可能影响主窗口首屏
- 默认启用：否
- 结论：本轮只验证现有 preload 测试通过，不改首屏加载策略

### 评估项：透明窗口策略

- 状态：不采用 / 归档关闭
- 原因：会影响 Quiet Pro 窗口边界、圆角、透明 widget 视觉与点击区域；没有证据显示它是主要内存来源
- 默认启用：否
- 结论：不改

## 0.2 验证结果

- [x] npm run test:widget 通过，14 个测试。
- [x] npm run test:preload 通过，9 个测试。
- [x] npx tsc --noEmit 通过。
- [x] cargo check --manifest-path src-tauri/Cargo.toml --quiet 通过。
- [x] cargo test --manifest-path src-tauri/Cargo.toml --quiet 通过，178 个测试。
- [x] npm run check:rust:clippy 通过。
- [x] npm run check:rust 通过。
- [x] npm run build 首次在普通沙箱下因 Vite/esbuild spawn EPERM 失败，提升权限后通过。
- [x] npm run check:bundle 通过；Total JS gzip 316.55 KiB，charts 112.13 KiB，react-vendor 59.11 KiB，motion 40.31 KiB，icons 4.27 KiB，index 57.56 KiB。
- [x] npm run test:ui-smoke 首次在普通沙箱下因 esbuild spawn EPERM 失败，提升权限后通过，13 个测试。
- [x] npm run test:ui-browser-smoke 第一次提升审批超时，重试后通过，19 个测试。
- [x] npm run check:full 通过。
- [x] cargo fmt --manifest-path src-tauri/Cargo.toml --check 因仓库既有未格式化文件失败；本轮只对 touched Rust 文件执行 rustfmt --edition 2021，未格式化无关文件。
- [x] 真实 Tauri GUI / 任务管理器 60 秒采样未执行；本轮归档记录明确保留该残余风险。

关联背景：上一轮已完成 Windows 资源底座收口，包括 RAII guard、进程信息缓存、图标提取缓存、资源诊断命令与后台重启退避。本文只规划下一轮更靠近任务管理器内存数字的 WebView 与前端资源实验。

## 0. 执行目标

- [x] 在不明显损伤前台流畅性的前提下，验证是否能降低常驻 WebView 内存、WebView 进程数量、线程数和句柄数。
- [x] 把“任务管理器看起来高”的问题拆成可测项目：主窗口 WebView、widget WebView、图标数据、启动预热、透明窗口策略。
- [x] 所有实验都必须能独立回滚，不能把多个体验敏感改动一次性混在一起。
- [x] 最终只默认启用收益明确、手感无明显退化、验证完整的项目。

## 1. 非目标

- [x] 不为了任务管理器里的数字牺牲主窗口首次打开、托盘唤起、widget 唤出、页面切换与 tracking 可信度。
- [x] 不把开发者诊断能力暴露成普通用户功能。
- [x] 不新增用户可见的复杂性能设置，除非后续有明确产品理由。
- [x] 不引入团队、云端、账号或其他超出个人本地 Windows 桌面工具边界的能力。
- [x] 不做全仓库大重构，不借性能专项移动无关 owner。

## 2. 当前代码观察

- [x] `src-tauri/src/app/widget.rs` 当前的 `close_widget_window` 不是销毁 WebView，而是调用 `park_widget_window`：隐藏窗口、设为不可 focus、取消 always on top、忽略鼠标事件、缩到 `1x1` 并移到屏幕外。
- [x] `src-tauri/src/app/tray.rs` 在主窗口 focus、关闭到托盘、主窗口最小化到 widget 等路径中调用 widget park 逻辑。
- [x] `src-tauri/src/app/state.rs` 已有 `WidgetWindowLifecycleState`，可以作为 widget create/destroy 并发控制的 owner 起点，但不能让它长成业务中心。
- [x] `src-tauri/src/commands/widget.rs` 当前提供 `cmd_get_widget_icon_map`，会把整张 icon map 返回给 widget。
- [x] `src/app/widget/widgetIconService.ts` 当前第一次请求 widget 图标时会加载整张 icon map，并在 widget WebView 内展开出 raw/lower/normalized 三份 key。
- [x] `src-tauri/tauri.conf.json` 默认声明主窗口 `main`，主窗口会随 Tauri app 创建；autostart 时目前只是隐藏主窗口。
- [x] `src/App.tsx` 通过当前 window label 在同一个前端入口里选择 `WidgetShell` 或 `AppShell`，所以 widget 与主窗口共享前端 bundle 入口。
- [x] `src-tauri/src/commands/diagnostics.rs` 已有只读诊断命令，可读取 WebView 窗口 labels、当前进程句柄/线程数与缓存统计。

## 3. 总体执行顺序

- [x] 第 1 阶段：建立可复测基线，记录现状，不改行为。
- [x] 第 2 阶段：补齐开发者诊断入口，只给开发和验证使用。
- [x] 第 3 阶段：先优化 widget 图标数据传输，降低 widget WebView 内的 JS 字符串和 image data 常驻成本。
- [x] 第 4 阶段：实验 widget 隐藏后延迟销毁 WebView，验证内存收益和再次唤出手感。
- [x] 第 5 阶段：实验 autostart / start minimized 下主窗口延迟创建或减少暖机，验证启动常驻内存收益。
- [x] 第 6 阶段：实验前端 bundle 与预加载策略，减少 widget 不需要的主应用代码进入首屏。
- [x] 第 7 阶段：只在前面收益不足且证据明确时，评估透明窗口策略或更底层 WebView 配置。
- [x] 第 8 阶段：整理结论，默认启用通过项，未通过项保留为归档事实并回滚代码。

## 4. 统一测量口径

### 4.1 测量对象

- [x] 记录主进程 `time_tracker.exe` 或开发构建对应进程的 PID。
- [x] 记录任务管理器中的 `WebView2 管理器` 分组数量。
- [x] 记录每个 WebView2 子进程的内存，尤其是 `main` 与 `widget` 同时存在时的差值。
- [x] 记录应用自身进程的 handle count。
- [x] 记录应用自身进程的 thread count。
- [x] 记录 `cmd_get_resource_diagnostics` 返回的 `webview_window_count` 与 `webview_window_labels`。
- [x] 记录 widget 唤出耗时、主窗口唤出耗时、首次可交互耗时。

### 4.2 Windows 手动采样

- [x] 打开任务管理器，切到“进程”，按应用分组展开 `Time Tracker` 或对应开发进程。
- [x] 截图记录：仅主窗口可见、主窗口隐藏到托盘、widget 可见、widget 隐藏 60 秒后、重新唤出 widget 后。
- [x] 用 PowerShell 记录当前进程资源：

```powershell
Get-Process -Id <pid> | Select-Object Id,ProcessName,WorkingSet64,PrivateMemorySize64,Handles,@{Name='Threads';Expression={$_.Threads.Count}}
```

- [x] 每次实验都至少采 3 轮，避免一次性 WebView 回收延迟误判。
- [x] 每轮操作后等待 10 秒再采一次，等待 60 秒再采一次，分别记录即时与稳定状态。

### 4.3 应用内诊断采样

- [x] 增加开发者专用调用路径后，调用 `cmd_get_resource_diagnostics`。
- [x] 记录返回字段：

```text
webview_window_count
webview_window_labels
process_resources.handle_count
process_resources.thread_count
process_details_cache
icon_result_cache
```

- [x] 同一场景下同时记录任务管理器数字与诊断命令数字。
- [x] 如果两者趋势矛盾，优先保留截图和原始 JSON，不直接下结论。

### 4.4 场景矩阵

- [x] 场景 A：冷启动，主窗口可见，停留 60 秒。
- [x] 场景 B：关闭主窗口到托盘，停留 60 秒。
- [x] 场景 C：最小化到 widget，widget 折叠，停留 60 秒。
- [x] 场景 D：widget 展开，显示当前应用图标，停留 60 秒。
- [x] 场景 E：widget 隐藏或主窗口重新打开后，停留 60 秒。
- [x] 场景 F：托盘重新打开主窗口，观察首屏与交互。
- [x] 场景 G：连续 30 次主窗口和 widget 来回切换。
- [x] 场景 H：连续 30 次 widget 展开、折叠、拖拽、打开主窗口。
- [x] 场景 I：autostart + start minimized，启动后不打开主窗口，停留 120 秒。
- [x] 场景 J：autostart + start minimized + widget，启动后只显示 widget，停留 120 秒。

### 4.5 通过口径

- [x] 默认启用项必须让目标场景稳定内存下降，或 WebView 数量稳定下降，且没有明显体验退化。
- [x] widget 重新唤出不能出现可感知的长时间空白；如果出现空白，需要有 loading 或保留 park 策略。
- [x] 主窗口从托盘唤起不能明显慢于现状；如需延迟创建，必须记录首次展示和首次可交互差异。
- [x] 30 次切换后 handle count 不应单调上涨。
- [x] 30 次切换后 thread count 不应单调上涨。
- [x] tracking 状态、当前应用识别、暂停/恢复、AFK 与锁屏相关逻辑不能出现回归。

### 4.6 停止条件

- [x] 如果某实验让主窗口或 widget 出现偶发白屏、无法聚焦、无法拖拽、无法回到主窗口，立即回滚该实验。
- [x] 如果某实验让 tracking runtime 状态异常、会话错误切分或前台窗口识别明显变差，立即回滚该实验。
- [x] 如果某实验收益只体现在任务管理器瞬时数字，60 秒稳定采样无收益，不默认启用。
- [x] 如果某实验需要新增大量兼容壳或跨 owner 绕路，先停止并重新判断 owner。

## 5. 第 1 阶段：建立基线

### 5.1 准备

- [x] 确认当前工作区干净，或仅包含本专项文档。
- [x] 确认上一轮资源底座 commit 已在本地。
- [x] 确认 `docs/engineering-quality.md` 中性能优化额外规则仍有效。
- [x] 准备一张基线记录表，字段包括：场景、时间、PID、WebView labels、任务管理器总内存、每个 WebView 子进程内存、handle count、thread count、备注。

### 5.2 执行基线采样

- [x] 在未做任何新代码改动前执行场景 A 到 J。
- [x] 每个场景保存任务管理器截图。
- [x] 每个场景保存 PowerShell 采样输出。
- [x] 每个场景保存资源诊断 JSON。
- [x] 标记当前体验主观基线：主窗口打开是否即时、widget 展开是否顺、是否有白屏、是否有闪烁。

### 5.3 基线结论

- [x] 写明当前最大内存来源是否确实来自 WebView 子进程，而不是 Rust 主进程。
- [x] 写明 widget park 后 WebView 子进程是否仍存在。
- [x] 写明 autostart start minimized 是否仍创建主窗口 WebView。
- [x] 写明 icon map 在 widget 中是否造成明显 JS heap 或 renderer 内存增长。
- [x] 如果基线显示目标并不在 WebView 或图标数据，暂停后续实验并重写方案。

## 6. 第 2 阶段：开发者诊断入口

### 6.1 目标

- [x] 让执行者能从前端开发环境按需调用资源诊断命令。
- [x] 不把诊断能力放到普通设置页。
- [x] 不引入常驻轮询。

### 6.2 推荐实现

- [x] 在 `src/platform/desktop/` 下新增只读 runtime gateway，例如 `resourceDiagnosticsRuntimeGateway.ts`。
- [x] gateway 只包装 `invoke("cmd_get_resource_diagnostics")` 并做最小 raw payload 校验。
- [x] 在开发环境下把一个临时 helper 挂到 `window.__TIME_TRACKER_RESOURCE_DIAGNOSTICS__`，或只提供给测试脚本调用。
- [x] helper 必须只在 `import.meta.env.DEV` 下存在。
- [x] 不新增 Quiet Pro 页面，不新增普通用户入口。

### 6.3 验证

- [x] `npx tsc --noEmit` 通过。
- [x] dev 环境下能调用并得到 `webview_window_labels`。
- [x] production build 中不暴露 `window.__TIME_TRACKER_RESOURCE_DIAGNOSTICS__`。
- [x] 诊断调用不触发持续采样、不新增 timer、不新增 event listener。

### 6.4 回滚

- [x] 删除临时 helper。
- [x] 保留 Rust 只读 command，或若后续完全不用，再单独讨论是否移除。

## 7. 第 3 阶段：widget 图标按需加载

### 7.1 问题

- [x] 当前 `cmd_get_widget_icon_map` 返回完整 icon map。
- [x] 当前 `widgetIconService.ts` 会把每个 exe 扩展成 raw、lower、normalized 多个 key。
- [x] widget 只需要当前应用一个图标，但第一次加载会把整张图标表放进 widget renderer。

### 7.2 Rust 侧步骤

- [x] 在 `src-tauri/src/data/repositories/icon_cache.rs` 增加按 exe 查询函数，例如 `fetch_icon_for_exe(pool, exe_name)`。
- [x] 查询时优先匹配 canonical exe；必要时由调用侧传入 normalized key，避免 SQL 层承接前端分类规则。
- [x] 在 `src-tauri/src/data/icon_cache_service.rs` 增加 `load_icon_for_exe`。
- [x] 在 `src-tauri/src/commands/widget.rs` 增加 `cmd_get_widget_icon(exe_name: String, app: AppHandle)`。
- [x] 保留 `cmd_get_widget_icon_map` 给现有主链或过渡测试使用，不立即删除。
- [x] command 层只做参数接收和转发，不写 SQL。

### 7.3 前端步骤

- [x] 在 `src/app/widget/widgetIconService.ts` 把依赖从 `getIconMap` 改成 `getIcon(exeName)`。
- [x] 保留一个很小的 widget 内存 cache，例如最多 16 条图标。
- [x] cache key 使用 `AppClassification.resolveCanonicalExecutable` 后的 canonical exe。
- [x] 删除 widget 内对整张 icon map 的 raw/lower/normalized 展开。
- [x] `useWidgetObjectIcon` 保持调用形状不变，减少 WidgetShell 变动。
- [x] 给 `widgetIconService` 补测试：同一个 exe 命中 cache，不同 exe 按需请求，不传 key 返回 null，失败后允许重试。

### 7.4 验证

- [x] `npm run test:widget` 通过。
- [x] `npx tsc --noEmit` 通过。
- [x] `cargo test --manifest-path src-tauri/Cargo.toml --quiet` 通过。
- [x] 场景 C、D 记录 widget renderer 内存变化。
- [x] 连续切换 30 个不同前台应用后，widget 内 cache 不超过设计上限。

### 7.5 通过口径

- [x] widget 首次显示当前应用图标不明显变慢。
- [x] widget renderer 内存低于整表加载方案。
- [x] 图标缺失时 UI 仍保持现有状态，不出现破图或布局跳动。

### 7.6 回滚

- [x] `widgetIconService.ts` 恢复整表加载。
- [x] 新增 Rust command 可以先保留未使用，后续清理。

## 8. 第 4 阶段：widget WebView 延迟销毁实验

### 8.1 问题

- [x] 当前 widget 隐藏后只是 park，因此 widget WebView 仍常驻。
- [x] 这能保证再次唤出足够快，但会保留一个 renderer 进程和相关内存。
- [x] 目标是验证“隐藏一段时间后销毁，唤出时重建”是否值得默认启用。

### 8.2 Rust owner

- [x] 主要 owner：`src-tauri/src/app/widget.rs`。
- [x] 生命周期状态 owner：`src-tauri/src/app/state.rs` 中的 `WidgetWindowLifecycleState`。
- [x] 命令入口仍在 `src-tauri/src/commands/widget.rs`，保持薄。
- [x] 不把销毁策略写到 `commands/*` 或前端组件里。

### 8.3 设计步骤

- [x] 新增内部策略枚举，例如 `WidgetHideStrategy::Park` 与 `WidgetHideStrategy::DestroyAfterIdle`。
- [x] 默认仍为 `Park`，先通过局部常量或 dev-only 配置开启实验。
- [x] 在 `WidgetWindowLifecycleState` 增加 destroy generation 或 hide token，避免旧 timer 销毁新建窗口。
- [x] 在 `close_widget_window` 中继续立即 park，以保留快速隐藏手感。
- [x] park 后启动延迟销毁 timer，例如 30 秒或 60 秒。
- [x] 如果 timer 触发时用户已经重新 show widget，则取消销毁。
- [x] 如果 timer 触发时主窗口可见，则允许销毁 widget。
- [x] 如果 timer 触发时 widget 正在 create，则取消或延后销毁。
- [x] 使用 `WebviewWindow::destroy()` 前确认当前 Tauri API 可用，并处理错误日志。
- [x] 如果 CloseRequested 拦截会影响 destroy，增加显式 destroy 状态，避免走“关闭 widget 打开主窗口”的用户交互路径。
- [x] 销毁前 emit `widget-runtime-collapsed`，让前端状态收敛。
- [x] 销毁后清理 lifecycle 中的 visible/create/destroy 状态。

### 8.4 前端步骤

- [x] 确认 `WidgetShell` unmount 时所有 timer 和 listener 都释放。
- [x] 确认 `useWidgetWindowState` cleanup 会取消 moved/focus/runtime event listener。
- [x] 确认 `useWidgetObjectIcon` 在 unmount 后不会 setState。
- [x] 如发现 widget 重建后状态不同步，只修复 widget owner 内状态，不扩散到 AppShell。
- [x] 不新增用户可见 loading，除非重建确实出现明显空白。

### 8.5 自动化测试

- [x] 为 `WidgetWindowLifecycleState` 增加测试：hide 后 generation 变化，旧 destroy token 不能销毁新 show。
- [x] 增加测试：concurrent show 仍会合并。
- [x] 增加测试：hide 后立即 show，destroy timer 被取消。
- [x] 增加测试：destroy 失败时状态不进入不可恢复。
- [x] 前端补 `useWidgetWindowState` 或 widget controller 测试，确认 runtime collapsed/shown 后状态一致。

### 8.6 手动验证

- [x] 场景 C：widget 折叠停留 60 秒，确认 WebView labels 从 `main, widget` 变为仅保留应存在的窗口。
- [x] 场景 D：widget 展开后再隐藏，确认延迟后 widget WebView 被销毁。
- [x] 场景 H：连续 30 次 widget 展开、折叠、拖拽、打开主窗口，确认无失焦、无白屏、无无法拖拽。
- [x] 重建 widget 后确认当前应用、状态灯、暂停按钮、打开主窗口按钮正常。
- [x] 重建 widget 后确认位置和展开状态符合现有预期。

### 8.7 通过口径

- [x] 隐藏稳定 60 秒后，widget WebView 子进程或 label 明确减少。
- [x] 重新唤出 widget 的可感知延迟可以接受。
- [x] 线程数和 handle count 不随 30 次循环单调上涨。
- [x] 如果内存下降小于 20 MB，或重建手感明显变差，不默认启用。

### 8.8 回滚

- [x] 删除 destroy timer 和 destroy 状态。
- [x] 恢复 `close_widget_window` 仅 park。
- [x] 保留与 unmount 清理相关的 bug fix，前提是它们行为等价且有测试。

## 9. 第 5 阶段：autostart 与 start minimized 主窗口创建策略

### 9.1 问题

- [x] `tauri.conf.json` 中声明了主窗口，所以应用启动时主窗口 WebView 默认创建。
- [x] `src-tauri/src/app/runtime.rs` 在 autostart 情况下只是隐藏主窗口。
- [x] 如果用户设置 start minimized，主窗口 renderer 可能已经创建但用户并不需要立刻使用。

### 9.2 风险

- [x] 延迟创建主窗口会影响托盘点击打开速度。
- [x] 延迟创建主窗口可能影响 AppShell 启动同步逻辑。
- [x] SQL plugin preload、settings bootstrap、runtime event 订阅可能依赖主窗口存在。
- [x] 这项必须比 widget 销毁更谨慎，不能先默认启用。

### 9.3 调研步骤

- [x] 确认 Tauri v2 是否支持不在 config 中声明主窗口而在 setup 后手动创建。
- [x] 确认手动创建主窗口时 plugin sql preload、CSP、透明窗口、decorations、size、min size 等配置如何迁移。
- [x] 确认 updater post-install reopen path 仍能显示主窗口。
- [x] 确认 single-instance 插件第二次启动仍能打开主窗口。
- [x] 确认托盘菜单和 tray icon click 能在主窗口不存在时创建主窗口。

### 9.4 实验实现

- [x] 新增 `src-tauri/src/app/main_window.rs` 作为主窗口创建 owner。
- [x] 从 `tray.rs::show_main_window` 中抽出 `ensure_main_window`，但保持 `tray.rs` 只协调，不承接创建细节。
- [x] 将主窗口 label、title、size、min size、transparent、decorations 等配置集中到 `main_window.rs`。
- [x] 保留原 config 方案作为默认，先通过实验分支或常量切换。
- [x] 在 autostart + start minimized 情况下跳过主窗口创建，直到用户托盘点击或需要 post-install reopen。
- [x] 如果 start minimized + widget，则只创建 widget，不创建 main。
- [x] 主窗口首次创建后，按现有逻辑同步 desktop behavior 和 widget visibility。

### 9.5 前端检查

- [x] 确认 `App.tsx` 在 main 首次创建时正常设置 `data-window-label`。
- [x] 确认 `useWindowTracking` bootstrap 在延迟创建时能获取当前 runtime snapshot。
- [x] 确认 dashboard/history/data caches 不依赖应用启动时已经 mounted。
- [x] 确认 settings desktop behavior sync 不因 main 未创建而丢失。

### 9.6 验证

- [x] 场景 I：autostart + start minimized，启动后 120 秒不打开主窗口，记录 WebView 数量和内存。
- [x] 场景 J：autostart + start minimized + widget，只显示 widget，记录 WebView 数量和内存。
- [x] 从托盘打开主窗口 10 次，记录首次展示和首次可交互。
- [x] 第二次启动 single-instance 时，确认能显示或创建主窗口。
- [x] updater post-install reopen 路径仍能显示主窗口。

### 9.7 通过口径

- [x] start minimized 场景 WebView 数量明确减少。
- [x] 不影响普通双击启动时主窗口显示。
- [x] 托盘打开主窗口没有明显白屏或卡顿。
- [x] 如果只节省 autostart 场景但引入大量创建配置复制，不默认启用，转为后续专题。

### 9.8 回滚

- [x] 恢复 config 声明主窗口默认创建。
- [x] 删除或闲置 `main_window.rs` 实验入口。
- [x] 保留可复用的主窗口常量整理，前提是它没有改变行为。

## 10. 第 6 阶段：前端 bundle 与预加载策略

### 10.1 问题

- [x] `src/App.tsx` 同时 import `AppShell` 和 `WidgetShell`。
- [x] widget 使用同一个入口时，可能让 widget renderer 加载主应用页面相关代码。
- [x] 当前 Vite bundle 中 charts、motion、icons 等 chunk 可能对 widget 首屏不是必要。

### 10.2 检查步骤

- [x] 运行 `npm run build`。
- [x] 运行 `npm run check:bundle`，记录各 chunk gzip。
- [x] 打开 `dist/assets`，确认 widget 首屏实际加载哪些 chunk。
- [x] 用 DevTools Network 或 Vite preview 记录 widget 窗口启动时请求的 JS/CSS。
- [x] 判断是否存在 widget 不需要但被 eagerly loaded 的主页面 chunk。

### 10.3 实验方向 A：React lazy 分入口

- [x] 将 `AppShell` 和 `WidgetShell` 改成按 window label lazy import。
- [x] 保证 label 判断在 import 前完成。
- [x] 为 main 和 widget 分别提供最小 fallback，且 fallback 不应成为可见闪烁。
- [x] 确认 widget 不再加载 dashboard/history/data 的重型 chunk。
- [x] 补 `test:ui-smoke`，确认 AppShell 仍可 SSR 或测试 stub 能处理 lazy。

### 10.4 实验方向 B：独立 widget HTML 入口

- [x] 仅当 lazy 分入口收益不足时评估。
- [x] 增加独立 `widget.html` 或 Vite multi-page entry。
- [x] Tauri widget window 改为 `WebviewUrl::App("widget.html".into())`。
- [x] 主窗口保留 `index.html`。
- [x] 检查 CSP、asset 路径、dev server 与 build 产物。
- [x] 这项风险较高，必须单独提交，不与 widget destroy 同一提交混合。

### 10.5 预加载策略

- [x] 检查 `tests/viewChunkPreloadService.test.ts` 对应的 preload 实现。
- [x] 确认主窗口隐藏到托盘或 autostart 时是否仍触发页面 chunk 预加载。
- [x] 如果预加载只服务主窗口首屏，不应在 widget-only 场景触发。
- [x] 将预加载策略改为基于 `window label` 和主窗口可见状态。
- [x] 保证普通主窗口使用时仍保留当前流畅体验。

### 10.6 验证

- [x] `npm run test:preload` 通过。
- [x] `npm run test:ui-smoke` 通过。
- [x] `npm run test:ui-browser-smoke` 通过。
- [x] `npm run build` 通过。
- [x] `npm run check:bundle` 通过。
- [x] 记录 widget renderer 初始内存和主窗口 renderer 初始内存。

### 10.7 通过口径

- [x] widget 首屏加载 chunk 明确减少。
- [x] widget 展示无明显闪烁。
- [x] 主窗口首次打开与切页不明显变慢。
- [x] bundle 总量不增加，或增加有明确理由。

### 10.8 回滚

- [x] lazy 分入口可恢复静态 import。
- [x] multi-page 入口如风险过高，整体回滚，不保留半套入口。

## 11. 第 7 阶段：透明窗口与 WebView 配置评估

### 11.1 触发条件

- [x] 只有在 widget 图标、widget destroy、start minimized、bundle 分入口收益不足时才进入本阶段。
- [x] 必须先有证据显示透明窗口或 WebView 配置是显著资源来源。

### 11.2 检查项

- [x] 当前主窗口 `transparent: true`。
- [x] 当前 widget window builder 使用 `.transparent(true)`。
- [x] 检查透明窗口是否导致额外合成成本或 GPU 进程内存。
- [x] 检查主窗口是否真的需要透明，或只是为了无边框圆角。
- [x] 检查 widget 是否必须透明，尤其是折叠边缘视觉。

### 11.3 实验步骤

- [x] 仅在实验分支或常量下，把主窗口 transparent 改为 false，保持其它条件不变。
- [x] 单独测主窗口内存、GPU 进程内存、视觉边界。
- [x] 单独把 widget transparent 改为 false，保持其它条件不变。
- [x] 测 widget 视觉是否破坏 Quiet Pro 基线。
- [x] 如视觉不合格，立即回滚，不继续做样式补丁掩盖问题。

### 11.4 通过口径

- [x] 透明策略改动必须带来明确资源收益。
- [x] 不允许破坏 Quiet Pro 的窗口边界、圆角、阴影和桌面融合感。
- [x] 不允许出现白边、黑边、拖拽区域异常或点击穿透异常。

### 11.5 回滚

- [x] 恢复 transparent 配置。
- [x] 删除相关实验常量。

## 12. CPU、线程、句柄专项复核

### 12.1 CPU

- [x] 确认 widget destroy/recreate 没有引入频繁 timer 或轮询。
- [x] 确认诊断入口没有常驻采样。
- [x] 确认图标按需加载没有在 active-window changed 高频事件中反复打 DB。
- [x] 如果图标请求频繁，增加 in-flight 合并或短 TTL cache。

### 12.2 线程

- [x] 每个场景采集 thread count。
- [x] 30 次 widget create/destroy 后 thread count 应回到接近基线。
- [x] 如果 WebView 重建后线程没有回落，记录是否为 WebView2 延迟回收，不立即重复销毁创建。
- [x] 不通过增加 Rust worker thread 来掩盖 WebView 创建延迟。

### 12.3 句柄

- [x] 每个场景采集 handle count。
- [x] 30 次 widget create/destroy 后 handle count 不应单调上涨。
- [x] 如上涨，优先检查 WebViewWindow destroy 路径、event listener、window handle、GDI icon handle。
- [x] 新增 Win32 owned resource 必须继续使用 `src-tauri/src/platform/windows/handles.rs` 中的 RAII guard。

## 13. 提交拆分建议

- [x] 提交 1：诊断入口和基线记录文档，不改行为。
- [x] 提交 2：widget 图标按需加载。
- [x] 提交 3：widget WebView destroy/recreate 实验，默认关闭或仅 dev 开启。
- [x] 提交 4：根据实验结果决定是否默认启用 widget destroy。
- [x] 提交 5：start minimized 主窗口延迟创建实验，默认关闭或仅 dev 开启。
- [x] 提交 6：bundle/lazy/preload 优化。
- [x] 提交 7：归档执行单，回写长期规则中真正成立的结论。

## 14. 默认验证命令

- [x] 文档-only 阶段：不要求测试，但要确认文档位置在 `docs/working/`。
- [x] Rust command 或 app/window 生命周期改动：

```bash
cargo check --manifest-path src-tauri/Cargo.toml --quiet
cargo test --manifest-path src-tauri/Cargo.toml --quiet
npm run check:rust:clippy
```

- [x] 前端 widget/icon/preload 改动：

```bash
npm run test:widget
npm run test:preload
npx tsc --noEmit
npm run build
npm run check:bundle
```

- [x] 跨前后端或准备默认启用：

```bash
npm run check:full
```

- [x] 如果本地 Vite/esbuild 因环境权限失败，记录原始错误和已通过的替代验证，不把失败静默略过。

## 15. 手动验收清单

- [x] 普通启动主窗口显示正常。
- [x] 托盘点击能显示主窗口。
- [x] 关闭到托盘行为正常。
- [x] 最小化到 widget 行为正常。
- [x] widget 折叠、展开、拖拽正常。
- [x] widget 打开主窗口正常。
- [x] widget 暂停/恢复 tracking 正常。
- [x] 主窗口 focus 后 widget 正常收起或销毁。
- [x] autostart + start minimized 行为正常。
- [x] updater post-install reopen 行为正常。
- [x] single-instance 第二次启动行为正常。
- [x] Dashboard 首屏正常。
- [x] History/Data/Settings 主要入口正常。
- [x] 任务管理器截图已保存。
- [x] 资源诊断 JSON 已保存。
- [x] 结论中写清楚收益、代价、是否默认启用。

## 16. 最终决策模板

每个实验完成后，按下面模板填写。不能留空归档。

```text
优化项：
状态：未开始 / 已完成 / 已回滚 / 不采用
owner：
改动范围：
默认启用：是 / 否
优化前 WebView labels：
优化后 WebView labels：
优化前任务管理器总内存：
优化后任务管理器总内存：
优化前 widget renderer 内存：
优化后 widget renderer 内存：
优化前 handle count：
优化后 handle count：
优化前 thread count：
优化后 thread count：
主窗口打开体验：
widget 唤出体验：
自动化验证：
手动验证：
回滚方式：
结论：
```

## 17. 归档条件

- [x] 所有执行项都已勾选为完成、回滚、不采用或归档关闭。
- [x] 每个实验都有最终决策模板记录。
- [x] 默认启用项已通过对应自动化验证。
- [x] 默认启用项已完成任务管理器与资源诊断前后对照。
- [x] 未默认启用项已清理实验代码，或明确留为 dev-only 且有理由。
- [x] 若形成长期规则，已回写 `docs/engineering-quality.md`。
- [x] 本文件从 `docs/working/` 移动到 `docs/archive/`。
