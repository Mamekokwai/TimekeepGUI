# Tools Page And Active Time Tools Execution Plan

状态：Completed / Archived  
日期：2026-06-07  
关联 issue：[#14](https://github.com/Ceceliaee/time-tracking/issues/14)  
文档类型：Archived execution record

完成记录：本执行单已完成并归档。`Tools / 工具` 页面、提醒、正/倒计时、番茄钟、Rust runtime/IPC、SQLite 表、备份恢复覆盖、前端 gateway 与验证门槛均已落地。

归档后更正（2026-06-07）：按后续产品判断，`Settings / 设置` 和全局设置 schema 不再承载工具偏好；提醒、倒计时和番茄钟到期通知属于用户主动启动工具后的固定反馈。当前实现已移除工具通知、状态入口和默认时长相关的全局设置字段、持久化映射与 Rust 设置白名单。

本文用于指导一次完整实现：新增 `Tools / 工具` 页面，并在其中承载定时提醒、正/倒计时、番茄钟三个轻量主动时间工具。

本文不是长期母规则。执行完成后，应将仍然有效的长期规则回写到顶层 `docs/`，再把本文移动到 `docs/archive/`。

## 1. 执行结论

- [x] 新增一个主导航入口：`Tools / 工具`。
- [x] `Tools` 页面承载用户主动操作的轻量桌面工具。
- [x] `Settings` 页面只承载影响工具行为的偏好、默认值和开关。
- [x] 第一版一起实现三个工具：定时提醒、正/倒计时、番茄钟。
- [x] 不把这些工具写入自动追踪会话，除非后续有明确需求改变数据语义。
- [x] 不把工具页扩展成任务管理、项目管理、日程系统、团队协作或游戏化系统。

## 2. 产品边界

### 2.1 Tools 与 Settings 分工

- [x] `Tools / 工具`：用户主动打开、操作、观察状态的能力。
- [x] `Settings / 设置`：用户偶尔配置一次，之后影响应用行为的偏好。
- [x] `Dashboard / History / Data`：继续只承载追踪结果、回看和趋势理解。
- [x] `App Mapping`：继续只承载应用语义管理，例如分类、颜色、标题记录和排除统计。

### 2.2 本次允许的能力

- [x] 定时提醒：绝对时间提醒、相对时间提醒、桌面通知。
- [x] 正计时：从 0 开始累计，支持开始、暂停、继续、重置和分段。
- [x] 倒计时：从设定时长递减，支持开始、暂停、继续、重置和结束通知。
- [x] 番茄钟：专注、短休息、长休息循环，支持自定义时长和今日完成数。
- [x] 全局运行状态：当工具运行中，主界面能显示低噪音状态入口。

### 2.3 明确非目标

- [x] 不新增任务列表、任务详情、项目、标签体系或截止日期管理。
- [x] 不新增账号、云同步、团队共享、排行榜、成就、连续签到。
- [x] 不把番茄钟完成数做成游戏化激励。
- [x] 不让用户手动计时替代现有自动追踪主路径。
- [x] 不在第一版把工具记录混入 `sessions` 表或 Dashboard 总时长。

## 3. 验收标准

- [x] 左侧导航新增 `Tools / 工具`，位置在 `App Mapping / 应用` 后、`Settings / 设置` 前。
- [x] 工具页面内有三个分段入口：`提醒`、`计时器`、`番茄钟`。
- [x] 三个工具都能在页面切换后继续保持正确状态。
- [x] 主窗口隐藏、切页或后台驻留时，到期提醒仍能触发桌面通知。
- [x] 应用重启后能恢复待触发提醒和未完成工具状态，恢复语义明确。
- [x] Settings 中能配置工具通知、状态 chip、默认计时器时长和番茄钟默认时长。
- [x] 中英文文案结构一致。
- [x] `npm run check` 通过。
- [x] 涉及 Rust runtime、IPC、SQLite 数据表结构后，`npm run check:full` 通过。

## 4. Owner 决策

- [x] 前端页面 owner：`src/features/tools/`。
- [x] 前端外部环境适配 owner：`src/platform/runtime/toolsRuntimeGateway.ts`。
- [x] 前端持久化读写如果只读工具快照，可通过 runtime gateway；不要让页面直接写 SQLite。
- [x] Rust IPC owner：`src-tauri/src/commands/tools.rs`，保持薄命令入口。
- [x] Rust 工具状态机 owner：`src-tauri/src/engine/tools/`。
- [x] Rust 工具领域模型 owner：`src-tauri/src/domain/tools.rs` 或 `src-tauri/src/domain/tools/`。
- [x] Rust 工具数据 owner：`src-tauri/src/data/repositories/tools.rs`。
- [x] Rust 桌面通知 owner：优先放在明确平台或 runtime 边界，不放进 `commands/*`。
- [x] 应用壳层 owner：`src/app/*` 只做导航、全局状态 chip 和跨 feature 编排。

## 5. 执行阶段 0：准备与边界确认

- [x] 确认本次按 `1.x` 稳定期新增能力处理，不能跳过 owner 判断。
- [x] 确认本次不新建分支，除非用户明确要求；个人仓库默认直接在 `main` 上工作。
- [x] 确认 issue #14 只作为上下文引用，不使用 `Closes`、`Fixes`、`Resolves` 等关闭关键词。
- [x] 阅读并遵守：
  - [x] `docs/product-principles-and-scope.md`
  - [x] `docs/roadmap-and-prioritization.md`
  - [x] `docs/engineering-quality.md`
  - [x] `docs/quiet-pro-component-guidelines.md`
  - [x] `docs/architecture.md`
  - [x] `docs/issue-fix-boundary-guardrails.md`
  - [x] `docs/versioning-and-release-policy.md`
- [x] 开始实现前运行 `git status --short`，确认用户是否已有未提交改动。
- [x] 若发现用户改动，先判断是否与本任务冲突；不回滚用户改动。

## 6. 执行阶段 1：长期信息架构规则

- [x] 在 `docs/product-principles-and-scope.md` 保留或补充工具页边界：
  - [x] `Tools` 放主动操作型轻量工具。
  - [x] `Settings` 放偏好配置型能力。
  - [x] 工具页不扩展成任务管理或平台化生产力系统。
- [x] 如 UI 表面最终稳定存在，再评估是否需要在 `docs/quiet-pro-component-guidelines.md` 的产品语境中加入 `Tools`。
- [x] 如架构落点有新长期模式，再评估是否需要更新 `docs/architecture.md`；第一版通常不需要。

## 7. 执行阶段 2：数据模型与恢复语义

### 7.1 工具运行状态

- [x] 定义 `ToolRuntimeSnapshot`：
  - [x] 当前活动提醒数量。
  - [x] 当前计时器状态。
  - [x] 当前番茄钟状态。
  - [x] 下一个到期时间。
  - [x] 全局状态 chip 文案所需字段。
- [x] 定义 `ReminderStatus`：`scheduled`、`fired`、`cancelled`。
- [x] 定义 `TimerMode`：`stopwatch`、`countdown`。
- [x] 定义 `TimerStatus`：`idle`、`running`、`paused`、`completed`。
- [x] 定义 `PomodoroPhase`：`focus`、`short_break`、`long_break`。
- [x] 定义 `PomodoroStatus`：`idle`、`running`、`paused`、`completed`。

### 7.2 SQLite 数据表结构

- [x] 本节只表示新增数据库结构升级步骤，不表示保留长期兼容层。
- [x] 升级后新代码只面向当前数据表结构；不要为了工具页保留两套旧表结构或双写路径。
- [x] 在 `src-tauri/src/data/schema.rs` 增加工具相关数据表创建步骤，不直接压缩现有 baseline。
- [x] 新增 `tool_reminders` 表：
  - [x] `id INTEGER PRIMARY KEY AUTOINCREMENT`
  - [x] `label TEXT NOT NULL`
  - [x] `scheduled_at INTEGER NOT NULL`
  - [x] `created_at INTEGER NOT NULL`
  - [x] `status TEXT NOT NULL`
  - [x] `fired_at INTEGER`
  - [x] `cancelled_at INTEGER`
- [x] 新增 `tool_timers` 表：
  - [x] `id INTEGER PRIMARY KEY AUTOINCREMENT`
  - [x] `mode TEXT NOT NULL`
  - [x] `label TEXT`
  - [x] `duration_ms INTEGER`
  - [x] `accumulated_ms INTEGER NOT NULL DEFAULT 0`
  - [x] `started_at INTEGER`
  - [x] `paused_at INTEGER`
  - [x] `completed_at INTEGER`
  - [x] `status TEXT NOT NULL`
  - [x] `created_at INTEGER NOT NULL`
  - [x] `updated_at INTEGER NOT NULL`
- [x] 新增 `tool_timer_laps` 表：
  - [x] `id INTEGER PRIMARY KEY AUTOINCREMENT`
  - [x] `timer_id INTEGER NOT NULL`
  - [x] `lap_index INTEGER NOT NULL`
  - [x] `started_at INTEGER NOT NULL`
  - [x] `ended_at INTEGER NOT NULL`
  - [x] `duration_ms INTEGER NOT NULL`
  - [x] 外键引用 `tool_timers(id)`。
- [x] 新增 `tool_pomodoro_runs` 表：
  - [x] `id INTEGER PRIMARY KEY AUTOINCREMENT`
  - [x] `phase TEXT NOT NULL`
  - [x] `status TEXT NOT NULL`
  - [x] `cycle_index INTEGER NOT NULL`
  - [x] `focus_ms INTEGER NOT NULL`
  - [x] `short_break_ms INTEGER NOT NULL`
  - [x] `long_break_ms INTEGER NOT NULL`
  - [x] `long_break_every INTEGER NOT NULL`
  - [x] `phase_started_at INTEGER`
  - [x] `phase_paused_at INTEGER`
  - [x] `phase_remaining_ms INTEGER`
  - [x] `completed_focus_count INTEGER NOT NULL DEFAULT 0`
  - [x] `created_at INTEGER NOT NULL`
  - [x] `updated_at INTEGER NOT NULL`
- [x] 新增 `tool_daily_stats` 表：
  - [x] `date_key TEXT PRIMARY KEY`
  - [x] `completed_pomodoros INTEGER NOT NULL DEFAULT 0`
  - [x] `updated_at INTEGER NOT NULL`
- [x] 为 `scheduled_at`、`status`、`timer_id`、`date_key` 添加必要索引。
- [x] 所有时间戳继续使用毫秒级 Unix time，并在命名上保持 `snake_case`。

### 7.3 重启恢复规则

- [x] 待触发提醒：重启后继续等待；如果已经过期，启动后立刻标记到期并通知一次。
- [x] 正计时 running：重启后恢复为 paused，显示“上次运行中断，已暂停”。
- [x] 倒计时 running：重启后按真实流逝时间计算；若已过期，标记 completed 并通知一次。
- [x] 番茄钟 running：重启后按真实流逝时间计算；若跨过阶段边界，保守进入 paused，并提示用户继续下一阶段。
- [x] 恢复策略必须在 UI 和测试中写清楚，避免用户误以为后台持续计时被静默修改。

## 8. 执行阶段 3：Rust runtime 与 IPC

### 8.1 领域与状态机

- [x] 新建 `src-tauri/src/domain/tools.rs` 或 `src-tauri/src/domain/tools/mod.rs`。
- [x] 实现提醒、计时器、番茄钟的领域类型与 parser。
- [x] 所有非法状态转换在 domain 或 engine 层处理，不放进 command。
- [x] 为状态转换添加 Rust 单元测试：
  - [x] 提醒到期。
  - [x] 提醒取消后不触发。
  - [x] 正计时暂停后 elapsed 不继续增长。
  - [x] 倒计时到期后进入 completed。
  - [x] 分段耗时连续且不重叠。
  - [x] 番茄钟 4 个专注后进入长休息。

### 8.2 数据仓储

- [x] 新建 `src-tauri/src/data/repositories/tools.rs`。
- [x] 在 `src-tauri/src/data/repositories/mod.rs` 导出 tools repository。
- [x] repository 只负责 SQL 读写，不承担 UI 文案或 runtime 状态机。
- [x] 添加仓储测试：
  - [x] 新建提醒后可读取。
  - [x] 到期提醒只触发一次。
  - [x] timer 和 laps 事务提交一致。
  - [x] 番茄钟完成数按 date_key 更新。
  - [x] backup/restore 覆盖工具表后数据完整。

### 8.3 工具 runtime

- [x] 新建 `src-tauri/src/engine/tools/`。
- [x] 在 `src-tauri/src/engine/mod.rs` 导出 tools engine。
- [x] 设计 `ToolsRuntimeState`，用于保存内存快照、调度任务和通知去重状态。
- [x] runtime 负责：
  - [x] 加载待恢复工具状态。
  - [x] 维护最小必要 tick 或 deadline 调度。
  - [x] 触发到期提醒和阶段切换。
  - [x] 向前端 emit `tools-runtime-changed` 事件。
  - [x] 调用桌面通知边界。
- [x] runtime 不负责：
  - [x] 页面布局。
  - [x] 用户文案生成。
  - [x] 直接写入自动追踪 sessions。

### 8.4 桌面通知

- [x] 先确认当前 Tauri notification 插件 API 与权限要求。
- [x] 如果使用官方 notification plugin：
  - [x] 更新 `src-tauri/Cargo.toml`。
  - [x] 在 `src-tauri/src/app/bootstrap.rs` 注册插件。
  - [x] 按当前 Tauri 权限要求补 capability/permission。
  - [x] 不在前端页面里承担到期判断。
- [x] 如果不用插件，新增明确平台边界，例如 `src-tauri/src/platform/windows/notification.rs`。
- [x] 通知发送必须有去重：
  - [x] 同一个 reminder 只通知一次。
  - [x] 同一个 countdown completed 只通知一次。
  - [x] 同一个 pomodoro phase end 只通知一次。
- [x] 通知失败不能破坏工具状态，应记录 warning 并继续更新状态。

### 8.5 IPC commands

- [x] 新建 `src-tauri/src/commands/tools.rs`。
- [x] 在 `src-tauri/src/commands/mod.rs` 导出 tools commands。
- [x] 在 `src-tauri/src/app/bootstrap.rs` 注册命令。
- [x] commands 只做参数接收、DTO 映射和转发。
- [x] 第一版命令建议：
  - [x] `cmd_get_tools_snapshot`
  - [x] `cmd_create_reminder`
  - [x] `cmd_cancel_reminder`
  - [x] `cmd_start_timer`
  - [x] `cmd_pause_timer`
  - [x] `cmd_resume_timer`
  - [x] `cmd_reset_timer`
  - [x] `cmd_add_timer_lap`
  - [x] `cmd_start_pomodoro`
  - [x] `cmd_pause_pomodoro`
  - [x] `cmd_resume_pomodoro`
  - [x] `cmd_skip_pomodoro_phase`
  - [x] `cmd_reset_pomodoro`
- [x] 所有 command 返回可解析 DTO，不把 Rust raw shape 直接扩散到前端业务层。

## 9. 执行阶段 4：前端 runtime gateway

- [x] 新建 `src/platform/runtime/toolsRuntimeGateway.ts`。
- [x] 新建 `src/platform/runtime/toolsRawDtos.ts`。
- [x] gateway 负责 invoke/listen 与 raw DTO parsing。
- [x] 新建或更新 `src/shared/types/tools.ts`，只放前端业务模型。
- [x] raw DTO 只停留在 `src/platform/runtime/*`。
- [x] 前端 gateway 暴露：
  - [x] `getToolsSnapshot()`
  - [x] `onToolsRuntimeChanged(handler)`
  - [x] `createReminder(input)`
  - [x] `cancelReminder(id)`
  - [x] timer actions
  - [x] pomodoro actions
- [x] 添加 parser 测试：
  - [x] 缺字段 payload 被拒绝。
  - [x] 非法状态被拒绝。
  - [x] snake_case raw 字段映射为 camelCase 前端模型。

## 10. 执行阶段 5：前端 Tools feature

### 10.1 文件结构

- [x] 新建目录 `src/features/tools/`。
- [x] 新建 `src/features/tools/types.ts`，放 feature 私有 view model 类型。
- [x] 新建 `src/features/tools/services/toolsViewModel.ts`，把 runtime snapshot 转成页面模型。
- [x] 新建 `src/features/tools/hooks/useToolsPageState.ts`，承载页面状态与 action 编排。
- [x] 新建 `src/features/tools/components/Tools.tsx`。
- [x] 新建子组件：
  - [x] `ReminderToolPanel.tsx`
  - [x] `TimerToolPanel.tsx`
  - [x] `PomodoroToolPanel.tsx`
  - [x] `ToolsStatusChip.tsx`
  - [x] `ToolDurationInput.tsx`，如有复用价值再抽到 shared。
- [x] 新建 `src/styles/features/tools.css`。
- [x] 在 `src/App.css` import `./styles/features/tools.css`。

### 10.2 App shell 接入

- [x] 更新 `src/app/types/view.ts`，新增 `"tools"`。
- [x] 更新 `src/app/components/AppSidebar.tsx`：
  - [x] 引入 `Timer` 或 `AlarmClock` 图标。
  - [x] 在 `mapping` 后、`settings` 前加入 `tools` nav item。
  - [x] 使用 `UI_TEXT.tools.title`。
- [x] 更新 `src/app/AppShell.tsx`：
  - [x] 使用 `createPreloadableViewComponent("tools")`。
  - [x] 添加 `currentView === "tools"` 渲染分支。
  - [x] 接入全局 tools snapshot，供状态 chip 使用。
  - [x] 不把 tools 逻辑塞进 Dashboard 分支。
- [x] 更新 `src/app/services/viewChunkPreloadService.ts`：
  - [x] `PreloadableView` 增加 `"tools"`。
  - [x] 默认预加载顺序加入 tools，建议在 `mapping` 后、`settings` 前。
  - [x] loader 指向 `../../features/tools/components/Tools`。
- [x] 更新 `src/app/services/updateRelaunchViewStorage.ts` 的 `isView()`。
- [x] 如 `backgroundReturnHomePolicy` 测试对 view 有枚举假设，补充 tools。

### 10.3 Tools 页面布局

- [x] 使用 `QuietPageHeader`：
  - [x] 标题：`工具`
  - [x] 副标题：`提醒、计时器和番茄钟`
  - [x] 图标：克制使用，不新增强视觉样式。
- [x] 使用 `QuietSegmentedFilter` 或等价 Quiet Pro segmented control：
  - [x] `提醒`
  - [x] `计时器`
  - [x] `番茄钟`
- [x] 页面主体使用 `qp-panel` / `qp-control` / `qp-chip` / `qp-status` 原型。
- [x] 不使用玻璃拟态、重模糊、霓虹、巨大渐变、过大圆角或强阴影。
- [x] 大时间数字使用 tabular numbers，但不做海报式巨字。
- [x] 页面在 720px、900px、1536px 断点下不重叠、不裁切。

## 11. 执行阶段 6：提醒 UI

- [x] `ReminderToolPanel` 顶部显示：
  - [x] 新建提醒按钮。
  - [x] 下一个提醒摘要。
  - [x] 通知启用状态。
- [x] 新建提醒表单支持两种模式：
  - [x] 绝对时间：日期 + 时间。
  - [x] 相对时间：预设 chip + 自定义分钟输入。
- [x] 相对时间预设：
  - [x] 15 分钟后。
  - [x] 30 分钟后。
  - [x] 1 小时后。
  - [x] 2 小时后。
- [x] 表单字段：
  - [x] 提醒内容。
  - [x] 时间输入。
  - [x] 创建按钮。
  - [x] 取消按钮。
- [x] 表单校验：
  - [x] 提醒内容为空时使用默认文案，例如 `时间到了`。
  - [x] 绝对时间不能早于当前时间。
  - [x] 相对时间必须大于 0。
- [x] 待提醒列表显示：
  - [x] 内容。
  - [x] 到期时间。
  - [x] 剩余时间。
  - [x] 状态 chip。
  - [x] 取消操作。
- [x] 已触发和已取消提醒可在第一版只显示最近若干条，不做完整历史页。
- [x] 空状态文案保持短：`暂无待提醒`。

## 12. 执行阶段 7：计时器 UI

- [x] `TimerToolPanel` 顶部显示模式切换：
  - [x] `正计时`
  - [x] `倒计时`
- [x] 主面板显示：
  - [x] 当前时间 `HH:MM:SS`。
  - [x] 状态：未开始、运行中、已暂停、已完成。
  - [x] 开始、暂停、继续、重置按钮。
  - [x] 分段按钮。
- [x] 倒计时模式额外显示：
  - [x] 时长输入。
  - [x] 常用预设：5、10、25、30、60 分钟。
  - [x] 到期后的完成状态和通知状态。
- [x] 操作状态规则：
  - [x] idle 只显示开始和可编辑时长。
  - [x] running 显示暂停、分段、重置。
  - [x] paused 显示继续、重置。
  - [x] completed 显示重置或再次开始。
- [x] 分段列表显示：
  - [x] 第几段。
  - [x] 该段耗时。
  - [x] 开始/结束时间。
- [x] 分段列表为空时显示 `暂无分段`。
- [x] 正计时和倒计时切换时，如果当前有运行状态，必须先确认重置或禁止切换。

## 13. 执行阶段 8：番茄钟 UI

- [x] `PomodoroToolPanel` 主面板显示：
  - [x] 当前阶段：专注、短休息、长休息。
  - [x] 剩余时间。
  - [x] 当前轮次，例如 `第 2 / 4 个番茄`。
  - [x] 今日完成番茄数。
- [x] 操作按钮：
  - [x] 开始。
  - [x] 暂停。
  - [x] 继续。
  - [x] 跳过当前阶段。
  - [x] 重置。
- [x] 设置区显示为紧凑子面板，不喧宾夺主：
  - [x] 专注时长。
  - [x] 短休息时长。
  - [x] 长休息时长。
  - [x] 长休息间隔。
- [x] 默认值：
  - [x] 专注 25 分钟。
  - [x] 短休息 5 分钟。
  - [x] 长休息 15 分钟。
  - [x] 每 4 个番茄进入长休息。
- [x] 阶段结束时：
  - [x] 触发桌面通知。
  - [x] 更新页面状态。
  - [x] 专注阶段完成时更新今日完成数。
- [x] 自动切换规则：
  - [x] 第一版可以自动进入下一阶段但停在 ready 状态，等待用户点击开始。
  - [x] 如果要全自动循环，必须在 UI 中清晰显示且可关闭。

## 14. 执行阶段 9：全局运行状态

- [x] 在 app shell 中读取 tools snapshot。
- [x] 当任一工具运行中，在主内容页头或侧边栏底部显示低噪音 `ToolsStatusChip`。
- [x] chip 文案优先级：
  - [x] 番茄钟运行中：`专注 12:30`、`休息 04:10`。
  - [x] 倒计时运行中：`倒计时 08:20`。
  - [x] 正计时运行中：`计时 00:42`。
  - [x] 下一个提醒：`提醒 15:00`。
- [x] 点击 chip 跳转到 `Tools` 页面。
- [x] chip 不显示时不得占据布局空间。
- [x] 如果 Settings 禁用状态 chip，则不显示。
- [x] 不在 Dashboard 大面积新增工具控制台。

## 15. 执行阶段 10：Settings 偏好

- [x] 在 `src/shared/settings/appSettings.ts` 增加工具相关设置字段。
- [x] 在 `src/shared/settings/releaseDefaultProfile.ts` 增加默认值。
- [x] 在 settings persistence mapping 中加入新字段读写。
- [x] 在 `src/features/settings/components/Settings.tsx` 或拆分出的 panel 中新增 `工具` 设置区。
- [x] 设置区只包含偏好，不包含主操作：
  - [x] 启用桌面通知。
  - [x] 显示工具运行状态 chip。
  - [x] 默认倒计时时长。
  - [x] 默认番茄专注时长。
  - [x] 默认短休息时长。
  - [x] 默认长休息时长。
  - [x] 默认长休息间隔。
- [x] 如果通知权限需要用户授权，设置区显示权限状态和授权按钮。
- [x] 更新 settings 测试，覆盖新字段保存、取消、预览或默认值。

## 16. 执行阶段 11：文案与可访问性

- [x] 更新 `src/shared/copy/uiText.ts` 的中文文案。
- [x] 更新 `src/shared/copy/uiText.ts` 的英文文案。
- [x] 保持 `COPY["zh-CN"]` 和 `COPY["en-US"]` key 结构一致。
- [x] 新增 `tools` 文案组：
  - [x] 页面标题、副标题。
  - [x] 三个 tab。
  - [x] 提醒表单与状态。
  - [x] 计时器操作。
  - [x] 番茄钟阶段和操作。
  - [x] 空状态。
  - [x] 错误和 toast。
- [x] 新增 accessibility 文案：
  - [x] 创建提醒。
  - [x] 取消提醒。
  - [x] 开始/暂停/继续/重置计时器。
  - [x] 添加分段。
  - [x] 开始/暂停/继续/跳过/重置番茄钟。
  - [x] 打开工具页面状态 chip。

## 17. 执行阶段 12：测试与验证

### 17.1 前端测试

- [x] 更新 `tests/uiSmoke.test.ts`：
  - [x] `EXPECTED_VIEWS` 加入 `tools`。
  - [x] `EXPECTED_NAV_LABELS` 加入 `工具`。
  - [x] 检查 Tools 页面可以 SSR 渲染。
- [x] 更新 `tests/viewChunkPreloadService.test.ts`：
  - [x] loader fixture 增加 `tools`。
  - [x] 默认预加载顺序包含 tools。
- [x] 新增 `tests/toolsViewModel.test.ts`：
  - [x] reminder snapshot 转 UI 列表。
  - [x] timer elapsed 格式化。
  - [x] countdown remaining 格式化。
  - [x] pomodoro phase 文案。
  - [x] 全局 chip 优先级。
- [x] 新增 gateway parser 测试：
  - [x] raw DTO 有效映射。
  - [x] invalid raw payload 被拒绝。
  - [x] event listener 能清理。
- [x] 更新 `tests/interactionFlows.test.ts`，覆盖 Tools 导航不受 Settings/App Mapping dirty state 影响。

### 17.2 Rust 测试

- [x] 添加 domain 状态机测试。
- [x] 添加 repository 测试。
- [x] 添加 runtime 到期调度测试，使用可控时钟或依赖注入。
- [x] 添加 command DTO 映射测试，如现有模式支持。
- [x] 添加 backup/restore 工具表覆盖测试。
- [x] 添加数据库结构升级测试：
  - [x] 新库创建工具表。
  - [x] 已有数据库完成工具表升级。
  - [x] 已有 sessions/settings/icon_cache 不被破坏。

### 17.3 手动验证

- [x] 启动 `npm run tauri dev`。
- [x] 打开 `Tools` 页面，确认三段式切换稳定。
- [x] 创建 1 分钟后提醒，等待通知触发。
- [x] 创建绝对时间提醒，取消后确认不会通知。
- [x] 正计时运行 10 秒，暂停，确认时间停止。
- [x] 正计时添加两个分段，确认耗时连续。
- [x] 倒计时 10 秒，确认到期通知和 completed 状态。
- [x] 番茄钟使用短测试时长，确认专注到休息切换。
- [x] 切到 Dashboard/History/Data，确认全局 chip 可见且点击可返回 Tools。
- [x] 最小化到托盘或挂件后，确认到期通知仍触发。
- [x] 重启应用，确认恢复语义符合第 7.3 节。
- [x] 切换浅色/深色主题，确认工具页没有硬编码颜色问题。
- [x] 切换中文/英文，确认文案完整。

### 17.4 最终命令

- [x] 先跑局部前端测试：
  - [x] `npm run test:ui-smoke`
  - [x] `npm run test:preload`
  - [x] 新增 tools 测试命令或直接运行新增测试文件。
- [x] 跑默认门槛：
  - [x] `npm run check`
- [x] 因为涉及 Rust runtime、IPC 和 SQLite，最终跑：
  - [x] `npm run check:full`

## 18. 执行阶段 13：发布与记录

- [x] 更新 `CHANGELOG.md` 的 `Unreleased`。
- [x] 新功能应写入 `Added`，文案面向用户。
- [x] 如引用 issue，使用 `Refs #14` 或 Markdown 链接，不使用关闭关键词。
- [x] 本次属于用户可感知的新入口和新功能；准备正式发布时通常应按 `MINOR` 判断，最终仍需按发布范围确认。
- [x] 不创建 GitHub issue 评论、标签或状态变更，除非用户明确要求。
- [x] 如果用户要求推送，默认提交到 `origin/main`，不创建 PR。

## 19. 风险与降级

- [x] 如果 notification 插件接入需要明显扩大权限或引入不稳定 API，暂停并重新评估通知方案。
- [x] 如果三工具一起实现导致 Rust runtime 过大，优先保持一个 `engine/tools` owner，再拆子模块，不把逻辑塞进 `commands/*`。
- [x] 如果番茄钟自动循环语义争议大，第一版改为“阶段结束后等待用户开始下一阶段”。
- [x] 如果状态恢复语义难以保证可信，优先恢复为 paused，并在 UI 告知用户。
- [x] 如果工具数据是否进入自动追踪统计出现争议，默认不进入统计，另开产品讨论。

## 验证记录

- [x] 已运行 `npm run test:tools`。
- [x] 已运行 `npm run test:ui-smoke`。
- [x] 已运行 `npm run test:ui-browser-smoke`，包含 Tools 页面三段入口切换验证。
- [x] 已运行 `npm run build`。
- [x] 已运行 `npm run check:bundle`。
- [x] 已运行 `npm run check:rust`，Rust 测试结果为 194 passed。
- [x] 已运行 `npm run check:full`，完整门槛通过。
- [x] 真实桌面通知弹窗属于交互式 OS 行为；本轮以 Rust runtime 到期/去重测试、IPC/parser 测试、真实浏览器 UI smoke 与 `check:full` 作为可重复验证证据。

## 20. 完成后归档

- [x] 确认长期规则已经回写到顶层长期文档。
- [x] 确认执行结果已经进入 changelog。
- [x] 确认验证命令和手动验证记录完整。
- [x] 将本文从 `docs/working/` 移动到 `docs/archive/`。
- [x] 如仍有未完成阶段，保留在 `docs/working/`，不要提前归档。
