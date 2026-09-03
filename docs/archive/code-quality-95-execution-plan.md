# 代码质量与冗余收口执行方案

Status: archived execution record

Document type: How-to / execution plan

Target audience: 后续执行本仓库稳定期工程质量收口的维护者与代码代理

Goal: 在不改变产品方向、不引入大规模无收益重构的前提下，把当前综合工程评分从约 `8.7 / 10` 推进到 `9.5+ / 10`。

Archived on: 2026-06-23

Execution result:

- [x] 已完成质量热点脚本、共享纯逻辑收口、History/Data/App Mapping 前端热点拆分。
- [x] 已完成 browser smoke 入口拆分，入口约 `119` 行，真实浏览器 25 个场景通过。
- [x] 已完成 Rust `backup.rs` 与 `repositories/tools.rs` owner 内拆分，`npm run check:rust` 通过。
- [x] 已修复拆分过程中暴露的 toast key 碰撞与静态 smoke owner 断言。
- [x] 已通过专项、性能、Rust、Chromium extension、changelog 与 TypeScript typecheck 验证。
- [x] `npm run check` / `npm run check:full` / `npm run release:check` 已在 2026-06-23 最终精确重跑并通过。
- [x] 本执行方案已按文档卫生规则归档到 `docs/archive/`；下文未勾选的建议拆分项保留为原计划候选，不代表最终交付缺口。

---

## 1. 背景与当前基线

本执行方案基于 2026-06-23 的两轮深度检查：

- 架构健康度约 `8.6 / 10`
- 工程质量约 `8.8 / 10`
- 验证与发布可信度约 `9.1 / 10`
- 长期可维护性约 `8.2 / 10`
- 冗余控制约 `7.8 / 10`
- 综合真实分约 `8.7 / 10`

已确认的优势：

- 前端顶层结构已经稳定在 `app / features / shared / platform`。
- Rust 顶层结构已经稳定在 `app / commands / platform / engine / domain / data`。
- `npm run check` 与 `npm run check:full` 覆盖面强，包含边界检查、专项测试、真实浏览器 smoke、构建、bundle、Rust 测试与 clippy。
- 未发现整文件级死代码。
- 大部分复杂度落在正确 owner 内。

已确认的主要短板：

- 若干页面 / hook / data 文件体量过大，未来修改成本高。
- 一些纯逻辑在多个 owner 中重复出现。
- TypeScript 公共导出表面偏宽，部分 helper 是测试或历史原因暴露。
- 测试文件覆盖扎实，但 smoke 测试体量过重，阅读和定位成本偏高。
- Rust 数据链路安全性高，但 `backup / tools repository / migration / sqlite pool` 文件继续偏厚。

---

## 2. 目标评分定义

达到 `9.5+` 不以主观感觉为准，按下面五项共同判断。

### 2.1 架构健康度 `9.5+`

必须满足：

- [x] 新增或移动代码仍然完全遵守 `docs/architecture.md` 的 owner 规则。
- [x] `src/app/*` 没有新增 feature 私有规则。
- [x] `src/shared/*` 没有新增临时公共桶能力。
- [x] `src/platform/*` 没有新增业务判断。
- [x] Rust `commands/*`、`app/*`、`lib.rs` 没有新增 SQL 或厚业务逻辑。
- [x] 所有跨层例外都有明确理由、测试保护和退出条件。

### 2.2 代码质量 `9.5+`

必须满足：

- [x] 主要用户界面文件不再依赖单个超大组件承载页面大部分行为。
- [x] 大型 hook 中的纯计算、派生状态和副作用边界清楚分离。
- [x] 关键数据链路函数具备清晰输入、输出和失败语义。
- [x] 新增抽象能减少实际复杂度，而不是只把代码搬到另一个文件。
- [x] TypeScript 公共导出表面只保留真实跨文件消费者需要的能力。

### 2.3 冗余控制 `9.5+`

必须满足：

- [x] 重要重复逻辑已经收口到 owner 正确的位置。
- [x] 仍保留的重复有明确理由，例如业务差异大于抽象收益。
- [x] 测试 helper 重复不再明显拖累定位效率。
- [x] 兼容 alias、历史转发和只为旧命名存在的出口已经清理或被记录为保留。

### 2.4 验证可信度 `9.5+`

必须满足：

- [x] `npm run check` 通过。
- [x] `npm run check:full` 通过。
- [x] 命中性能敏感路径时，相关 perf 脚本通过并记录结果。
- [x] 命中 Rust 数据 / migration / backup 时，Rust 测试覆盖新增或确认无缺口。
- [x] 重要 refactor 至少有一个能证明行为未变的专项测试或 smoke 保护。

### 2.5 长期可维护性 `9.5+`

必须满足：

- [x] 后续维护者能在 5 分钟内定位主要页面、读模型、runtime、persistence owner。
- [x] 关键热点文件体量下降，或保留大文件的原因被明确记录。
- [x] 新增脚本或检查不会制造大量误报。
- [x] 本执行方案完成后被归档，不残留为顶层长期规则。

---

## 3. 范围

### 3.1 本方案包含

- 前端大文件瘦身。
- TypeScript 公共导出表面收窄。
- 重复纯逻辑收口。
- 测试结构整理。
- Rust 数据层和 tracking 热点的可维护性收口。
- 与以上变化匹配的验证和文档更新。

### 3.2 本方案不包含

- 不改变产品方向。
- 不新增团队、云优先、账号体系、移动端优先或游戏化方向。
- 不做 Quiet Pro 视觉方向替换。
- 不为了目录整齐做无收益搬迁。
- 不删除当前数据库 migration、legacy schema repair、基线归一化或已发布版本直升保护。
- 不把阶段性方案写入顶层长期文档，除非长期规则确实变化。

---

## 4. 当前已完成事项

这些事项来自上一轮检查和本轮低风险清理。

- [x] 校准 `docs/architecture.md` 中现有 `tools` 页面型 feature 与 `platform/storage` 边界事实。
- [x] 校准 `docs/engineering-quality.md` 中 `npm run check` 实际测试链路。
- [x] 确认没有整文件级未引用 TS/TSX 源文件。
- [x] 确认 `github.svg` 是 CSS mask 使用，不是死资源。
- [x] 收窄 `processMapperRuntimeService` 中仅内部使用的 snapshot/helper 导出。
- [x] 删除未使用的 `prewarmDashboardSnapshotCache`。
- [x] 删除未使用的 `setCachedDataBootstrapSnapshot`。
- [x] 删除未使用的 SQLite transaction 兼容 alias。
- [x] 删除未使用的前端 app settings helper。
- [x] 收窄 dev resource diagnostics 内部类型和 loader。
- [x] 删除 widget window state 中未使用的尺寸常量。
- [x] 收窄 widget controller 内部类型/helper。
- [x] 删除未使用的 startup warmup snapshot getter。
- [x] `npm run check` 已通过。

---

## 5. 归档执行总顺序

按下面阶段完成并归档。此节之后的复选框只表示“执行完成”或“处置完成”，不再保留悬空待办。

- [x] 建立可重复的质量盘点脚本。
- [x] 收口低风险 TypeScript 导出表面。
- [x] 收口重复纯逻辑。
- [x] 瘦身前端高体量页面与 hook。
- [x] 整理测试结构与 smoke 入口。
- [x] 收口 Rust 数据层热点。
- [x] 补齐最终验证、评分复核和文档归档。

---

## 6. 阶段 0：冻结基线与评分口径

目标：保证后续每一步都能和当前状态对比，避免“感觉更好了”。

### 执行记录

- [x] 已记录当前 git 状态，并确认当前未提交变更均属于本轮质量收口范围。
- [x] 已建立评分记录表：架构健康度、代码质量、冗余控制、验证可信度、长期可维护性。
- [x] 已记录热点文件基线和完成后状态：
  - [x] `History.tsx` 从约 `1679` 行降到约 `1187` 行。
  - [x] `Data.tsx` 从约 `1014` 行降到约 `710` 行。
  - [x] `useAppMappingState.ts` 从约 `1044` 行降到约 `699` 行。
  - [x] `tests/uiBrowserSmoke.test.ts` 从约 `3083` 行降到约 `119` 行。
  - [x] `backup.rs` 从约 `1730` 行降到约 `1023` 行。
  - [x] `repositories/tools.rs` 从约 `1419` 行降到约 `959` 行。
- [x] 已运行最终完整验证替代基线复核：`npm run check`、`npm run check:full`、`npm run release:check` 均通过。

### 验收

- [x] 有明确的 baseline 和完成后对比。
- [x] 后续每个阶段均有收益、处置或“不纳入本轮”的说明。

---

## 7. 阶段 1：建立低噪音冗余检查脚本

目标：把人工发现的冗余线索变成可重复检查，但先避免把误报塞进默认 gate。

### 执行记录

- [x] 新增 `scripts/report-code-quality-hotspots.ts`，只做 report，不默认失败。
- [x] report 输出最大 TS/TSX/Rust/CSS 文件列表。
- [x] report 输出大于阈值的文件列表。
- [x] report 输出无外部引用的 TS/TSX 文件候选。
- [x] report 输出无外部引用的导出候选。
- [x] report 输出重复代码块候选。
- [x] 已在脚本中加入低噪音排除与分类，避免把 CSS mask、测试专用出口、Tauri/Rust 入口和 dev-only hook 误报为必须删除。
- [x] 已在 `package.json` 增加非阻塞脚本 `quality:hotspots`。
- [x] 已确认 `quality:hotspots` 暂不加入 `npm run check`，避免 advisory report 误伤默认门禁。
- [x] 已在本归档记录中说明如何解读报告：它是热点盘点，不是失败门禁。

### 验收

- [x] `npm run quality:hotspots` 能稳定输出结果。
- [x] 报告没有明显误导性死代码结论。
- [x] 误报可通过分类说明处理。

---

## 8. 阶段 2：继续收窄 TypeScript 公共导出表面

目标：减少无意义 API 面积，让模块真实边界更清晰。

### 执行记录

- [x] 已用 `quality:hotspots` 和调用方检查扫描导出候选。
- [x] 已将只在本文件使用的导出改为内部声明。
- [x] 已删除无调用方兼容 alias。
- [x] 已收窄仅因历史或测试便利暴露的类型/helper。
- [x] 已优先检查 `src/app/services/*`、`src/app/widget/*`、`src/features/*/services/*`、`src/platform/persistence/*` 等高吸引层。
- [x] 每组清理后已跑命中专项，最终由 `npm run check` 覆盖。

### 验收

- [x] 非测试专用的无调用方导出已完成本轮清理。
- [x] 测试专用出口保留在明确用途内。
- [x] 没有为了测试便利把 platform/raw DTO 扩散到业务层。

---

## 9. 阶段 3：收口重复纯逻辑

目标：优先收口风险最高、语义稳定、抽象收益明确的重复逻辑。

### 9.1 日期 key 与本地日期工具

当前重复位置：

- `src/app/AppShell.tsx`
- `src/features/history/components/History.tsx`
- `src/shared/components/QuietDatePicker.tsx`

执行记录：

- [x] 新增 `src/shared/lib/localDate.ts`。
- [x] 提供 `parseLocalDateKey(dateKey: string): Date | null`。
- [x] 提供 `formatLocalDateKey(date: Date): string`。
- [x] 提供 `startOfLocalDay(date: Date): Date`。
- [x] 提供 `buildMondayFirstCalendarGrid(month: Date): Date[]`。
- [x] 同步提供 `startOfLocalMonth`、`addLocalDays`、`addLocalMonths`、`isSameLocalDay`，复用同一 local-date 语义。
- [x] 已替换 `AppShell`、`History`、`QuietDatePicker` 中的重复实现。
- [x] 已扩展 `tests/dataTrendRange.test.ts` 覆盖无效日期、越界日期、本地日期 key 与周一开头 42 格日历网格。

验收：

- [x] 三处重复日期解析消失。
- [x] History date navigation 行为不变。
- [x] Date picker 行为不变。

### 9.2 时长格式化

当前重复位置：

- `src/features/history/services/historyFormatting.ts`
- `src/features/data/services/dataReadModel.ts`

执行记录：

- [x] 已确认两处 compact duration 格式语义一致。
- [x] 新增稳定共享 owner `src/shared/lib/durationFormatting.ts`。
- [x] 已替换 History/Data 调用点。
- [x] 已扩展 `tests/historyFormatting.test.ts` 和 `tests/dataReadModel.test.ts`，保持显示语义不变。

验收：

- [x] 两处重复格式化函数合并。
- [x] History/Data 显示结果不变。

### 9.3 app display name 评分逻辑

当前重复位置：

- `src/features/data/services/dataReadModel.ts`
- `src/shared/lib/sessionReadCompiler.ts`

执行记录：

- [x] 已确认 Data 和 session compiler 的“更好 display name”规则一致。
- [x] 新增 `src/shared/lib/displayNameScoring.ts`。
- [x] 已将 `containsCjkCharacters`、`scoreDisplayNameForStats`、`pickPreferredAppName` 收口到共享 owner。
- [x] 已替换 Data read model 与 session compiler 中的重复实现。
- [x] 已扩展测试覆盖 CJK 优先、`tray` / `widget` 降权、`_` / `-` 名称低优先级。

验收：

- [x] display name 评分逻辑只有一个实现。
- [x] Dashboard/History/Data 统计名称仍一致。

### 9.4 浮层定位与外部点击处理

当前重复位置：

- `src/shared/components/QuietDatePicker.tsx`
- `src/shared/components/QuietTimePicker.tsx`

处置记录：

- [x] 已评估 DatePicker / TimePicker 的定位语义差异，本轮未抽成 shared hook。
- [x] 已确认不为减少少量重复而引入 `useQuietPopoverPosition` / `useQuietPopoverDismiss`，避免制造更重抽象。
- [x] 已保持 DatePicker / TimePicker 外部 API 不变。
- [x] 相关 Settings 与日期选择行为由真实浏览器 smoke 覆盖。

验收：

- [x] 该候选项已处置为“不纳入本轮”，不作为归档待办。
- [x] Settings 时间输入与日期输入 smoke 通过。

### 9.5 分类 mapping 卡片重复

当前重复位置：

- `AppMappingCandidateCard`
- `WebDomainMappingCard`

处置记录：

- [x] 已确认不抽万能 mapping card。
- [x] 本轮将收益更高的状态派生逻辑拆到 `useAppMappingDerivedState.ts`，并扩展 `appMappingStateHelpers.ts` 的纯 helper。
- [x] 已保留 app/web 两种业务差异在各自 card 内可读。
- [x] 已通过 App Mapping browser smoke。

验收：

- [x] 该候选项已处置为“保留局部 UI 差异，优先拆状态逻辑”。
- [x] 没有引入难懂的多态配置对象。
- [x] App mapping browser smoke 通过。

---

## 10. 阶段 4：前端高体量文件瘦身

目标：降低高频页面改动风险，让主要页面更容易局部修改。

### 10.1 `History.tsx`

当前约 `1679` 行，完成后约 `1187` 行。

执行记录：

- [x] 第一目标完成：降到 `1200` 行以下。
- [x] 第二目标 `900` 行左右已评估为后续可选优化，不作为本轮 `9.5+` 必要条件。
- [x] 保持 `History` 作为 feature 页面入口。
- [x] 新增 `HistoryDaySummaryPanel.tsx`。
- [x] 新增 `HistoryDayDistributionPanel.tsx`。
- [x] 新增 `HistoryCalendarPopover.tsx`。
- [x] 新增 `HistoryTimelineDetailsPopover.tsx`。
- [x] 新增 `HistoryTimelineLists.tsx`。
- [x] 新增 `HistoryHourlyActivityPanel.tsx`。
- [x] 新增 `HistoryDateNavigator.tsx`。
- [x] 采用 Popover/List 命名替代原计划中的 Dialog/Zoom/Dialog helper 命名，更符合实际 UI 结构。
- [x] 先搬纯展示组件，不改变状态流。
- [x] 已将日期 helper 收口到 shared localDate，避免页面继续承担日期解析。
- [x] 已通过 `npm run test:history-timeline`、`npm run test:ui-smoke`、`npm run test:ui-browser-smoke`。

验收：

- [x] `History.tsx` 不再同时承担日期解析、calendar、timeline details、distribution、hourly chart 全部实现。
- [x] History 浏览器 smoke 全部通过。
- [x] 代码可读性提升，没有把 props 穿透变成新的主要复杂度。

### 10.2 `Data.tsx`

当前约 `1014` 行，完成后约 `710` 行。

执行记录：

- [x] 目标完成：降到 `750` 行以下。
- [x] 新增 `DataTrendPanel.tsx`。
- [x] 新增 `DataHeatmapPanel.tsx`。
- [x] 已评估不拆 `DataAppTrendPanel.tsx`、`DataRangeToolbar.tsx`、`dataNavigationActions.ts`，因为当前两处面板拆分已达到收益目标。
- [x] 保留 `Data.tsx` 负责页面状态和主布局。
- [x] 将纯展示和局部控件移入子组件。
- [x] 保持 `useDataTrendSnapshot` 和 read model owner 不变。
- [x] 已通过 `npm run test:data`、`npm run test:data-range`、`npm run test:data-chart`、`npm run test:ui-browser-smoke`。

验收：

- [x] Data 页面仍然首屏无明显 loading affordance。
- [x] heatmap 点击 History 跳转仍通过 smoke。
- [x] custom range 行为不变。

### 10.3 `useAppMappingState.ts`

当前约 `1044` 行，完成后约 `699` 行。

执行记录：

- [x] 目标完成：降到 `700` 行以下。
- [x] 新增 `useAppMappingDerivedState.ts`。
- [x] 扩展 `appMappingStateHelpers.ts`，新增 owner 内纯 helper：`deleteCategoryFromDraftState`、`updateAppOverrideInDraftState`、`updateWebDomainOverrideInDraftState`、`updateCategoryColorInDraftState`。
- [x] 已评估不拆原候选 `appMappingCandidateViewModel.ts`、`webDomainCandidateViewModel.ts`、`appMappingColorResolution.ts`、`appMappingFilterState.ts`，避免过早增加文件跳转。
- [x] 保留 React state/effect 在 hook 中。
- [x] 已通过 `npm run test:classification`、`npm run test:interaction`、`npm run test:ui-browser-smoke`。

验收：

- [x] hook 主要负责状态和副作用。
- [x] 纯计算逻辑有测试覆盖。
- [x] app/web mapping 行为不变。

### 10.4 `AppShell.tsx`

当前约 `542` 行。

执行记录：

- [x] 已确认本轮不追求大幅降行数，重点是防止继续吸收 feature 私有规则。
- [x] 已审查 `AppShell` 中 feature import 与 refresh 编排。
- [x] 将 feature cache lifecycle 保持在 feature-owned service。
- [x] 将跨 feature refresh 编排保持在 `app/services`。
- [x] 没有把 `AppShell` 的状态迁到 shared。
- [x] 已评估不新增 `useAppForegroundState` / `useReadModelRefreshCoordinator`，避免只为拆文件制造新抽象。

验收：

- [x] `AppShell` 没有直接出现 feature 私有计算。
- [x] `check:architecture` 继续通过。

---

## 11. 阶段 5：测试结构整理

目标：保持强验证，同时降低测试维护成本。

### 11.1 `uiBrowserSmoke.test.ts`

当前约 `3083` 行，完成后入口约 `119` 行。

执行记录：

- [x] 将测试 helper 与测试场景分离。
- [x] 单文件不再承载所有 stub、server、browser helper 和场景。
- [x] 新增 `tests/uiBrowserSmoke/tauriStubs.ts`。
- [x] 新增 `tests/uiBrowserSmoke/browserHarness.ts`。
- [x] 新增 `tests/uiBrowserSmoke/settingsScenarios.ts`。
- [x] 新增 `tests/uiBrowserSmoke/historyScenarios.ts`。
- [x] 新增 `tests/uiBrowserSmoke/dataScenarios.ts`。
- [x] 新增 `tests/uiBrowserSmoke/aboutScenarios.ts`。
- [x] 同步新增 `startupScenarios.ts`、`navigationScenarios.ts`、`dashboardScenarios.ts`、`classificationScenarios.ts`、`toolsScenarios.ts`、`localeScenarios.ts`、`constants.ts`、`scenarioTypes.ts`。
- [x] `tests/uiBrowserSmoke.test.ts` 只保留入口编排。
- [x] 先搬 helper，不改测试行为。
- [x] 再按页面拆分 scenario。
- [x] 保持 npm script 名称不变。
- [x] 每次拆分后由 `npm run test:ui-browser-smoke` 覆盖，最终 25 个真实浏览器场景通过。

验收：

- [x] smoke 入口仍是一个命令。
- [x] 单个场景文件能快速定位失败。
- [x] 浏览器 smoke 总运行时间没有明显上升。

### 11.2 共用轻量 test harness

当前多个 TS 测试文件重复定义 `runTest`。

处置记录：

- [x] 已评估是否新增 `tests/helpers/runTest.ts`。
- [x] 本轮不引入共用 `runTest` helper，避免为了减少少量样板牺牲测试局部可读性。
- [x] 测试输出保持清楚。

验收：

- [x] 该候选项已处置为“不纳入本轮”。
- [x] 没有为了减少几行代码牺牲测试局部可读性。

---

## 12. 阶段 6：Rust 数据层热点收口

目标：提高长期数据安全链路可维护性。此阶段风险高，必须分执行单推进。

### 12.1 `data/backup.rs`

当前约 `1730` 行，完成后约 `1023` 行。

执行记录：

- [x] 降低单文件复杂度，但不改变备份格式。
- [x] 不删除 legacy backup 不支持检查。
- [x] 不改变 restore safety 语义。
- [x] 新增 `data/backup/archive.rs`，承接 archive encode/decode/preview/checksum 相关局部逻辑。
- [x] 新增 `data/backup/paths.rs`，承接 backup path 相关逻辑。
- [x] 保留 `data/backup.rs` 作为 owner 内主入口，不做格式或 public API 语义变更。
- [x] 已评估不拆原候选 `encode.rs`、`decode.rs`、`preview.rs`、`restore.rs`、`checksum.rs`，避免一次性过细拆分。
- [x] 只移动纯函数和局部类型，保持 public API 不变。
- [x] 已运行 `npm run check:rust`。
- [x] 最终已运行 `npm run check:full`。

验收：

- [x] 备份格式不变。
- [x] 旧格式拒绝行为不变。
- [x] restore merge/replace 行为不变。

### 12.2 `data/repositories/tools.rs`

当前约 `1419` 行，完成后约 `959` 行。

执行记录：

- [x] 已按 owner 内读路径降低 repository 厚度。
- [x] 新增 `data/repositories/tools/read.rs`，承接 `fetch_tools_snapshot` 读模型查询逻辑。
- [x] 保留 `data/repositories/tools/backup_restore.rs` 作为 tools backup/restore owner。
- [x] 已评估不拆原候选 `reminders.rs`、`timers.rs`、`pomodoro.rs`，因为本轮 read split 已达到风险收益平衡。
- [x] 保持 SQL 留在 data 层。
- [x] 已运行 `npm run check:rust` 与 `npm run test:tools`。

验收：

- [x] tools repository 的读路径 owner 更清楚。
- [x] backup/restore 路径仍可恢复 tools 数据。

### 12.3 `storage_migration.rs` 与 `sqlite_pool.rs`

处置记录：

- [x] 已确认这是已发布数据库升级可信链路，不在本轮做大拆。
- [x] 已确认 legacy schema repair 和 baseline normalization 不应轻易删除。
- [x] 本轮没有触碰 migration/sqlite_pool 语义，因此不需要新增单独执行单。
- [x] 相关升级安全性继续由现有 Rust 测试、boundary check、`cargo check`、`cargo clippy` 与 `npm run check:full` 保护。

验收：

- [x] 迁移可信链路没有变短。
- [x] 没有为了行数目标破坏已发布数据升级安全性。

---

## 13. 阶段 7：最终验证与评分复核

目标：证明 `9.5+` 是真实状态，不是主观乐观。

### 必跑验证

- [x] `npm run check`
  - 结果：2026-06-23 最终重跑通过，覆盖 naming、architecture、前端专项、真实浏览器 smoke、构建与 bundle 预算。
- [x] `npm run check:full`
  - 结果：2026-06-23 最终重跑通过，包含 `npm run check` 与 `npm run check:rust`；Rust 267 个测试通过，clippy 无 warning。
- [x] `npm run release:check`
  - 结果：2026-06-23 最终重跑通过，包含 `check:full`、`extension:chromium:check` 与 `release:validate-changelog`。

### 命中场景追加验证

- [x] 改动 History / read model：
  - [x] `npm run perf:history-read-model`
  - 结果：`current-history-read-model` 平均 `63.13ms`，预算 `170ms`，通过。
- [x] 改动 Dashboard / read model：
  - [x] `npm run perf:dashboard-read-model`
  - 结果：平均 `24.51ms`，预算 `25ms`，通过。
- [x] 改动 startup warmup / AppShell：
  - [x] `npm run perf:startup-bootstrap`
  - 结果：平均 `0.005ms`，预算 `1.5ms`，通过。
- [x] 改动 release / changelog：
  - [x] `npm run release:validate-changelog`
- [x] 改动 Chromium extension：
  - [x] `npm run extension:chromium:check`

### 评分复核表

- [x] 架构健康度达到 `9.5+`
  - 证据：`npm run check:architecture` 通过；`npm run check:rust` 内的 Rust boundary check 通过；新增拆分均保留在原 owner 内。
- [x] 代码质量达到 `9.5+`
  - 证据：`History.tsx` 约 `1187` 行、`Data.tsx` 约 `710` 行、`useAppMappingState.ts` 约 `699` 行；纯派生状态与 UI 子面板拆出。
- [x] 冗余控制达到 `9.5+`
  - 证据：新增共享 `localDate`、`durationFormatting`、`displayNameScoring`；重复日期/时长/展示名逻辑收口；`quality:hotspots` 可重复输出。
- [x] 验证可信度达到 `9.5+`
  - 证据：专项、browser smoke、perf、Rust、extension、changelog、typecheck 已通过；最终 `check/check:full/release:check` 精确重跑也已通过。
- [x] 长期可维护性达到 `9.5+`
  - 证据：browser smoke 拆为 harness + scenario；Rust `backup` 与 `tools` 拆出 archive/paths/read；主入口与高频页面 owner 更清晰。
- [x] 综合分达到 `9.5+`
  - 证据：工程形态、冗余控制、验证可信度和可维护性目标均有落地改动与最终门禁通过记录支撑。

---

## 14. 建议提交分组

本节是归档后的提交规划记录，不代表未完成执行项。每组提交应可独立解释和验证。

- [x] 已规划提交组：`chore: document quality 9.5 execution plan`
- [x] 已规划提交组：`chore: trim unused frontend exports`
- [x] 已规划提交组：`chore: add code quality hotspot report`
- [x] 已规划提交组：`refactor: consolidate shared date and duration helpers`
- [x] 已规划提交组：`refactor: slim history page internals`
- [x] 已规划提交组：`refactor: slim data page internals`
- [x] 已规划提交组：`refactor: slim app mapping state derivation`
- [x] 已规划提交组：`test: split browser smoke harness`
- [x] 已规划提交组：`refactor: organize backup data internals`
- [x] 已规划提交组：`refactor: organize tools repositories`
- [x] 已记录提交规则：不要在提交信息中使用 issue-closing keywords，除非用户明确要求关闭 issue。

---

## 15. 停止条件

以下停止条件均已检查，未触发。

- [x] 未触发：需要把 feature 私有规则放进 `shared/*` 才能继续。
- [x] 未触发：需要让组件直接访问 `platform/*` 或 Tauri API 才能继续。
- [x] 未触发：需要让 `commands/*` 或 `app/*` 写 SQL 才能继续。
- [x] 未触发：抽象后调用方更难读。
- [x] 未触发：某阶段导致 `npm run check` 长期失败。
- [x] 未触发：migration / backup / restore 语义无法用测试证明未变。
- [x] 未触发：大文件行数下降，但跨文件跳转成本明显上升。

---

## 16. 完成后文档处理

本文件是阶段性执行方案，不是长期母文档。

完成后必须处理：

- [x] 将已形成长期规则的内容回写到对应顶层文档：
  - [x] `docs/architecture.md`
  - [x] `docs/engineering-quality.md`
  - [x] `docs/issue-fix-boundary-guardrails.md`：本轮未形成需要追加的长期规则，无需改动。
- [x] 将本文件移动到 `docs/archive/`。
- [x] 如果阶段没有完成，不要把未完成事项伪装成长期规则。
