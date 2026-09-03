# Tools 计时器能力合并方案

## 背景

当前 Tools 页面把 `定时提醒`、`计时器`、`番茄钟` 做成三个并列 section。用户心智上，`定时提醒` 和 `计时器` 都是在处理“未来某个时间点或一段时间”的轻量工具，放在两个入口里会显得信息多，也会让左侧工具栏继续膨胀。

合并目标不是把所有代码揉成一个“大计时系统”，而是把用户入口合并为一个更安静的 `计时器` 能力，同时保留提醒、正计时、倒计时各自清晰的 owner。

## 目标

- 左侧工具栏从 `定时提醒 / 计时器 / 番茄钟` 收敛为 `计时器 / 番茄钟`。
- `计时器` 面板内提供三个模式：`提醒`、`正计时`、`倒计时`。
- 状态 chip 点击后仍能打开正确上下文，例如提醒 chip 打开 `计时器 > 提醒`，倒计时 chip 打开 `计时器 > 倒计时`。
- 保持现有提醒、计时器、番茄钟数据安全，不做不必要的数据迁移。
- 后续功能扩展时按 owner 放置，避免形成“一个组件管所有事、一个命令做所有事”的结构。

## 非目标

- 不把 `番茄钟` 合进 `计时器`。番茄钟有独立的专注流程、阶段切换、统计语义，仍应是单独能力。
- 不把 Rust command 合并成 `cmd_run_tool_action` 或类似通用命令。
- 不把 `tool_reminders` 和 timer 相关表合成一张通用表。
- 不把本机接口、系统接口、自动化入口顺手塞进这次 `计时器` 合并。那是另一个 Tools 能力，应该单独定 owner。
- 不引入新的全局设计方向。UI 继续遵守 Quiet Pro：低装饰、清晰分组、轻量控件。

## Owner 决策

| 层级 | Owner | 计划 |
| --- | --- | --- |
| 页面编排 | `src/features/tools/components/Tools.tsx` | section 从 `reminders / timer / pomodoro` 改为 `timing / pomodoro`。 |
| 计时器能力 UI | `src/features/tools/components/TimingToolPanel.tsx` | 新增薄协调组件，负责模式切换和把状态分发给子面板。 |
| 提醒模式 UI | `src/features/tools/components/ReminderToolPanel.tsx` | 改名或收敛为 `ReminderModePanel`，只管提醒表单、下一个提醒、提醒列表。 |
| 正/倒计时模式 UI | `src/features/tools/components/TimerToolPanel.tsx` | 拆出或保留为 timer mode 内部组件，负责正计时、倒计时显示和操作。 |
| 前端状态 | `src/features/tools/hooks/useToolsPageState.ts` | 继续统一读取 snapshot 和暴露 action，不把 UI mode 状态塞进 runtime service。 |
| ViewModel | `src/features/tools/services/toolsViewModel.ts` | 增加 chip 目标模式，不把提醒和 timer view model 混成一个不透明对象。 |
| IPC gateway | `src/platform/runtime/toolsRuntimeGateway.ts` | 第一阶段不改命令名，只继续调用现有提醒和 timer 命令。 |
| Rust command | `src-tauri/src/commands/tools.rs` | 保持 thin command handler，不新增大而全 command。 |
| Rust engine/data/domain | `src-tauri/src/engine/tools/mod.rs`、`src-tauri/src/data/repositories/tools.rs`、`src-tauri/src/domain/tools.rs` | 第一阶段不做结构合并，只在发现真实重复逻辑时再提取小 helper。 |

## 目标信息架构

```text
工具
├─ 计时器
│  ├─ 提醒
│  │  ├─ 下一个提醒
│  │  ├─ 新建提醒
│  │  └─ 提醒列表
│  ├─ 正计时
│  │  ├─ 时间显示
│  │  ├─ 标签
│  │  ├─ 开始 / 暂停 / 继续 / 重置 / 分段
│  │  └─ 分段列表
│  └─ 倒计时
│     ├─ 时间显示
│     ├─ 时长
│     ├─ 标签
│     └─ 开始 / 暂停 / 继续 / 重置
└─ 番茄钟
   ├─ 专注 / 休息阶段
   ├─ 时间显示
   ├─ 阶段配置
   └─ 今日完成统计
```

## UI 方案

### 左侧工具栏

- `定时提醒` 和 `计时器` 合并为一个 `计时器` tab。
- 图标建议使用 `TimerReset` 或 `Clock3` 一类时间概念图标；提醒铃铛只在 `提醒` 模式内出现。
- 保留现有“显示/隐藏文字”按钮和持久化逻辑。
- 首装默认仍保持文字关闭，让工具栏宽度稳定。

### 计时器面板

`TimingToolPanel` 顶部使用一个 Quiet Pro segmented control：

```text
提醒 | 正计时 | 倒计时
```

- `提醒` 模式展示下一个提醒、新建提醒、提醒列表。
- `正计时` 模式展示当前 stopwatch、标签、分段操作和分段列表。
- `倒计时` 模式展示倒计时时长、标签和倒计时操作。
- 运行中 timer 锁定对应 timer mode，避免用户把一个运行中的倒计时切成正计时导致语义错乱。
- 切换 mode 不应清掉合法表单状态；只有 action 成功后才重置对应表单。

### Quiet Pro 约束

- `TimingToolPanel` 是一个主 panel，内部用 section/divider 分组，不做卡片套卡片。
- 模式切换是控件，不作为大标题或装饰块。
- 信息默认只显示当前模式需要的信息，减少同屏噪音。
- 图标只辅助识别，不给每一行都加视觉框。

## 类型与导航方案

新增显式子模式：

```ts
export type ToolsSection = "timing" | "pomodoro";
export type TimingMode = "reminder" | "stopwatch" | "countdown";

export interface ToolStatusChipViewModel {
  label: string;
  targetSection: ToolsSection;
  targetTimingMode?: TimingMode;
}
```

兼容策略：

- `AppShell` 的 `toolsInitialSection` 从 `"reminders"` 默认改为 `"timing"`，用户可见入口文案为 `计时器`。
- `ToolsSidebarStatusEntry` 点击 chip 时传入 `{ section, timingMode }`，而不是只传 section。
- 如果任何旧入口还传 `"reminders"` 或 `"timer"`，在 Tools 边界做一次兼容映射：
  - `"reminders"` -> `{ section: "timing", timingMode: "reminder" }`
  - `"timer"` -> 根据当前 `snapshot.currentTimer?.mode` 映射到 `"stopwatch"` 或 `"countdown"`，没有运行中 timer 时默认 `"stopwatch"`。
- 兼容映射只放在 `features/tools` 或 `app` 的导航边界，不扩散到 runtime gateway。

## Runtime 与数据方案

第一阶段只合并 UI，不合并 runtime。

保留现有命令：

- `cmd_create_reminder`
- `cmd_cancel_reminder`
- `cmd_start_timer`
- `cmd_pause_timer`
- `cmd_resume_timer`
- `cmd_reset_timer`
- `cmd_add_timer_lap`

保留现有 snapshot 结构：

- `reminders`
- `currentTimer`
- `timerLaps`
- `nextReminderAt`
- `currentPomodoro`

理由：

- 提醒是“一次性计划事件”，timer 是“可暂停、继续、分段的运行状态”，两者 domain 生命周期不同。
- 强行共表会把提醒、正计时、倒计时的空字段和状态转换混在一起，后面更难维护。
- Tauri command handler 当前足够薄，合并命令反而会制造参数分支和权限边界模糊。

只有在第二阶段发现真实重复时，才考虑提取小而明确的 helper，例如通知文案、时间格式、due 检测；不创建 `TimedThing`、`UnifiedToolRun` 这类过早抽象。

## 推荐实施步骤

1. 类型和导航准备
   - 新增 `TimingMode`。
   - 将 `ToolsSection` 调整为 `"timing" | "pomodoro"`。
   - 为旧入口增加一次性兼容映射。
   - 更新 status chip view model，使 timer/reminder chip 指向对应 timing mode。

2. 新增 `TimingToolPanel`
   - 作为薄协调层接收 `snapshot`、`timerViewModel`、`reminderRows` 和 action callbacks。
   - 持有 `activeTimingMode`。
   - 根据运行中 timer 或 chip 入口选择初始 mode。

3. 收敛现有子面板
   - `ReminderToolPanel` 改成只渲染提醒 mode 内容，不再自带外层 `tools-panel`。
   - `TimerToolPanel` 拆出正计时/倒计时 mode，或保留一个 timer 内容组件但由 `TimingToolPanel` 控制 mode。
   - 去掉旧的 `reminders` 和 `timer` section pane。

4. 更新 copy 与样式
   - `uiText.ts` 增加 `timingTitle`、`timingHint`、`timingModeReminder`、`timingModeStopwatch`、`timingModeCountdown`。
   - `tools.css` 删除旧 section 宽度假设，保留 Quiet Pro 面板、控件、列表样式。
   - 确保收起文字时左栏宽度继续稳定。

5. 清理测试
   - 更新 `toolsRuntime.test.ts` 中 status chip target 断言。
   - 更新 UI smoke 和 browser smoke，使其断言 `计时器` tab 与三个 mode。
   - 保留 reset 后可切换倒计时的回归覆盖。

## 风险与防护

| 风险 | 防护 |
| --- | --- |
| `TimingToolPanel` 变成大组件 | 只让它做 mode 协调，具体表单和列表留在子组件。 |
| 点击状态 chip 后不知道打开哪个 mode | chip view model 显式携带 `targetTimingMode`。 |
| 运行中 timer 切 mode 造成状态错乱 | 运行中或暂停中 timer 锁定正计时/倒计时模式。 |
| 为了“合并”误改 Rust 数据模型 | 第一阶段禁止 schema 和 command 合并。 |
| 旧导航入口失效 | 在 app/features 边界做兼容映射，测试覆盖。 |
| 同屏信息仍然太多 | 只显示当前 mode 内容，其他 mode 内容不渲染或隐藏为 inactive pane。 |

## 验收标准

- Tools 左侧工具栏只显示 `计时器` 和 `番茄钟` 两个功能入口。
- `计时器` 面板内可以在 `提醒 / 正计时 / 倒计时` 之间切换。
- 创建提醒、取消提醒、开始正计时、开始倒计时、暂停、继续、重置、分段都保持可用。
- 计时器 `开始 -> 重置 -> 切换倒计时` 的回归场景仍可用。
- Sidebar status chip 点击后打开正确模式。
- 无数据库迁移，无现有提醒和 timer 数据丢失。
- `commands/tools.rs` 仍保持 thin handler，没有新增大而全 command。
- `platform/runtime/toolsRuntimeGateway.ts` 不承载 UI mode 决策。

## 建议验证

实现后运行：

```powershell
npm run test:tools
npm run test:ui-smoke
npm run test:ui-browser-smoke
npm run check:architecture
npm run check:rust
npm run build
```

如果实际改动只停留在前端 UI 和 copy，`check:rust` 可以作为最终保险；如果触碰 Rust runtime、repository、domain，则必须运行。

## 推荐落地顺序

先做“UI 合并 + 导航兼容”，不要同时做 Rust 重构。等合并后的页面跑稳定，再观察是否有真实重复逻辑值得提取。这样用户界面会先变安静，代码边界也不会为了追求表面统一而被打散。

## 执行归档状态

归档日期：2026-06-07

- [x] 类型和导航准备完成：`ToolsSection` 收敛为 `timing / pomodoro`，新增 `TimingMode` 和显式打开目标。
- [x] 新增 `TimingToolPanel`，将提醒、正计时、倒计时收进一个计时器主面板。
- [x] 旧提醒和计时器面板收敛为模式内容组件，不再各自持有外层大 panel。
- [x] Sidebar status chip 可打开 `计时器 > 提醒 / 正计时 / 倒计时` 的正确上下文。
- [x] copy、CSS、runtime smoke、browser smoke 断言已更新。
- [x] Rust command、engine、data、domain 未做合并，保持原 owner 边界。

验证记录：

- [x] `npm run test:tools`
- [x] `npm run test:ui-smoke`
- [x] `npm run test:ui-browser-smoke`
- [x] `npm run build`
- [x] `npm run check:bundle`
- [x] `npm run check:frontend`
- [x] `npm run check:architecture`
- [x] `npm run check:rust`

备注：未提权的 `test:ui-browser-smoke` 和 `build` 曾因 Vite/esbuild 子进程 `spawn EPERM` 被 Windows sandbox 拦截；按权限规则提权后均通过。最终 `check:frontend` 也已提权整链通过。
