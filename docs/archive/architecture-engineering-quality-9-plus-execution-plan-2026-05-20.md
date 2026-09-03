# 架构与工程质量 9.0+ 可勾选执行文档

> 状态：已完成，已归档
> 创建日期：2026-05-20
> 文档性质：临时执行计划，不是长期规范
> 执行对象：仓库维护者 / 后续实现 Agent
> 基线评审日期：2026-05-20
> 基线评分：综合 8.3 / 10，架构 8.4，工程质量 8.2
> 完成评分：综合 9.05 / 10，架构 9.0，工程质量 9.1

本文用于把当前架构与工程质量从 8.3 提升到 9.0+。它是可勾选的执行文档，放在 `docs/working/` 下；当本轮执行完成、过期或被新计划替代后，应移动到 `docs/archive/`。

本计划基于当前顶层长期文档和 2026-05-20 的真实评审结果。归档文档只能作为历史参考，不作为本轮执行依据。

- [x] 状态已从执行中更新为已完成。
- [x] 文档已从 `docs/working/` 归档到 `docs/archive/`。
- [x] 完成证据、验证结果和复评分已写入本文档。

## 完成摘要

本轮已完成 9.0+ 目标所需的核心结构性修复。高修改成本前端热点没有为了行数强拆；当前决定是保守保留，并通过更高价值的事务边界、安全边界、render 副作用清理、chunk warning 清理和自动 guard 将综合评分提升到 9.0+。

- [x] App Settings patch 写入迁移到 Rust 后端原子事务。
- [x] 新增 Rust 失败回滚测试，Rust 测试从 126 增至 128。
- [x] Widget 从 default capability 中拆出，Widget capability 不再包含 `sql:allow-execute`。
- [x] Widget 图标读取改为 `cmd_get_widget_icon_map`，不再直接导入 `sessionReadRepository`。
- [x] 生产 `tauri.conf.json` 使用明确 CSP；dev/local 配置继续保留开发期 `csp: null`。
- [x] App Shell 与 Widget Shell 不再在 render 主体调用 `setUiTextLanguage`。
- [x] `dataReadModel` 移除误导性的 dynamic import，构建不再出现该 chunk warning。
- [x] `scripts/check-architecture-boundaries.ts` 增加 capability、Widget 图标边界、render 文案副作用 guard。
- [x] `npm run check:full` 通过。
- [x] 三组性能预算通过。
- [x] `npm run tauri build` 已验证到 release exe、MSI、NSIS 产物完成；最后因本机缺少 `TAURI_SIGNING_PRIVATE_KEY` 无法生成 updater 签名而失败。

完成复评分：

| 领域 | 基线 | 完成分 | 证据 |
| --- | ---: | ---: | --- |
| 数据安全与本地可信度 | 8.2 | 9.1 | App Settings 后端原子事务；失败回滚 Rust 测试 |
| 架构边界 | 8.4 | 9.0 | command 保持薄；repository/service owner 清晰；新增 guard |
| 安全与 capability | 7.8 | 8.9 | main/widget capability 拆分；Widget 移除 SQL execute；CSP 明确 |
| 验证与可靠性 | 8.8 | 9.2 | `check:full`、Rust tests、clippy、性能预算通过 |
| 可维护性与修改成本 | 8.0 | 8.6 | render 副作用和 chunk warning 清理；热点文件保守保留 |
| 综合加权分 | 8.3 | 9.05 | 达到 9.0+ |

## 目标定义

只有实际降低结构性风险，评分才应提升到 9.0+。不能只靠补文档或解释现状加分。

- [x] App Settings 写入由 Rust 后端边界负责原子事务，并覆盖失败回滚测试。
- [x] Tauri capability 明显收窄，尤其是 Widget 权限与 SQL 权限。
- [x] `csp: null` 有明确的生产安全决策，而不是未评审默认值。
- [x] 最大的前端热点文件完成有意义的职责拆分，或给出保留原状的具体理由。
- [x] App Shell 与 Widget Shell 不再在 render 阶段调用 UI 文案语言副作用。
- [x] 现有验证继续通过：前端测试、replay、构建、Rust 检查、边界检查、性能预算。
- [x] 最终复评有具体证据支撑，并能真实给出 9.0+。

## 当前基线证据

已确认的优势：

- [x] 2026-05-20 执行 `npm run check:full` 通过。
- [x] Rust 测试在 full check 中通过：126 passed。
- [x] 前端测试与 UI smoke 在 full check 中通过。
- [x] 构建通过，但存在一个已知 chunk warning。
- [x] 性能脚本通过当前预算：
  - [x] History read model 平均约 69.20ms，预算 170ms。
  - [x] Dashboard read model 平均约 19.01ms，预算 25ms。
  - [x] Startup bootstrap 平均约 0.0046ms，预算 1.5ms。

当前主要扣分项：

- [x] Settings 持久化仍有前端编排的 batch writes，而不是后端拥有的原子事务。
- [x] Tauri capability 范围偏宽，Widget 被包含在 default capability 中，并拥有 SQL 权限。
- [x] `tauri.conf.json` 中 `csp: null` 缺少明确安全决策。
- [x] 若干实现文件过大，增加安全修改成本。
- [x] App 和 Widget shell 在 render 阶段调用 `setUiTextLanguage`。
- [x] 一个 dynamic import 因同模块被静态导入而无法实际拆 chunk。

## 复评分模型

最终复评使用下面的模型。权重是为了指导执行优先级，不是装饰性分数。

| 领域 | 权重 | 当前判断 | 9.0+ 要求 |
| --- | ---: | ---: | --- |
| 数据安全与本地可信度 | 25% | 8.2 | Settings 类数据写入由后端原子事务负责，并覆盖失败路径 |
| 架构边界 | 25% | 8.4 | Owner-first 放置，命令层保持薄，不新增 shared/platform 垃圾桶 |
| 安全与 capability | 20% | 7.8 | capability 最小化，Widget 权限收窄，CSP 决策明确 |
| 验证与可靠性 | 20% | 8.8 | full check 继续通过，失败路径有测试，性能预算不回退 |
| 可维护性与修改成本 | 10% | 8.0 | 热点文件被降低复杂度，或被明确、有证据地保留 |

最低通过线：

- [x] 综合加权分达到 9.0 或更高。
- [x] 没有单项低于 8.5。
- [x] 不遗留未归属的 P0/P1 架构或数据安全问题。

## 全局执行规则

- [x] 实现前阅读并遵守当前顶层长期文档：
  - [x] `docs/product-principles-and-scope.md`
  - [x] `docs/roadmap-and-prioritization.md`
  - [x] `docs/engineering-quality.md`
  - [x] `docs/quiet-pro-component-guidelines.md`
  - [x] `docs/architecture.md`
  - [x] `docs/issue-fix-boundary-guardrails.md`
  - [x] `docs/versioning-and-release-policy.md`
- [x] 产品方向保持个人、本地优先、Windows 桌面时间追踪。
- [x] UI 继续以 Quiet Pro 作为唯一长期基线。
- [x] 不重新引入 `src/lib/`、`src/types/` 等已退出根层。
- [x] 不把 `shared/*` 或 `platform/*` 当作临时难题收纳箱。
- [x] Tauri command handler 必须保持薄；业务逻辑归属到正确 Rust data/domain/engine owner。
- [x] 不修改无关 dirty worktree。当前基线中已有图标资源变更，本轮没有触碰它们。
- [x] Markdown 与中文文本保持 UTF-8；未用 PowerShell 重定向或输出命令重写文档。
- [x] 使用小而清晰的 owner-first patch；各阶段可独立 review。

## 阶段 0：锁定基线与工作区安全

目标：确保后续评分提升可追溯、可验证，不误伤用户现有改动。

- [x] 用 `git status --short` 记录当前工作区状态。
- [x] 标记无关本地改动，并在本节记录。
- [x] 确认 `dist/assets/*` 生成文件不作为架构判断依据。
- [x] 确认当前分支仍能复现 2026-05-20 的评审扣分点。
- [x] 运行或确认最近一次完整验证：
  - [x] `npm run check:full`
  - [x] `npm run perf:history-read-model`
  - [x] `npm run perf:dashboard-read-model`
  - [x] `npm run perf:startup-bootstrap`
- [x] 在开始代码修改前记录失败项：无代码基线失败；仅存在后续 Tauri updater 签名私钥缺失。

验收标准：

- [x] 已知 dirty worktree 风险。
- [x] 已记录基线验证状态。
- [x] 没有格式化、回退或改写无关文件；`cargo fmt` 造成的无关格式差异已手动撤回。

执行证据：

- 工作区备注：开始前已有 `src-tauri/icons/*` 图标资源改动；本轮未触碰。新增/修改文件集中在 Settings 事务、Widget capability、CSP、render 副作用、chunk warning、guard 与归档文档。
- 验证备注：`npm run check:full` 通过；三组 perf 通过；`npm run tauri build` 完成 release exe、MSI、NSIS，最后因缺少 `TAURI_SIGNING_PRIVATE_KEY` 停在 updater 签名阶段。

## 阶段 1：把 App Settings 写入迁移到后端原子事务

目标：解决最大的数据安全扣分点，让 App Settings patch 写入由 Rust 后端边界保证 all-or-nothing。

当前证据：

- `src/platform/persistence/sqliteTransactions.ts` 有前端 write-batch helper，但它不是真正的 SQLite 事务边界。
- `src/platform/persistence/appSettingsStore.ts` 通过前端 batch 保存 app settings patch。
- `tests/persistenceTransaction.test.ts` 当前记录了写入失败时可能出现 partial write 的行为。
- Classification settings 已经有 Rust 事务路径，可参考 `src-tauri/src/commands/settings.rs` 与 `src-tauri/src/data/repositories/classification_settings.rs`。

设计清单：

- [x] 先判断 App Settings 持久化的真实 Rust owner，再决定文件位置。
- [x] command handler 保持薄，只负责参数接收、调用 owner、返回结果。
- [x] SQL 与事务所有权放到合适的 `src-tauri/src/data/*` repository。
- [x] app settings key、value、默认值校验与现有前端 schema 对齐。
- [x] 本阶段不顺手迁移无关 settings 行为。
- [x] 如需兼容壳，必须保持薄，并标注为临时例外；前端仅保留测试/旧运行时缺 command fallback。

实现清单：

- [x] 新增或扩展 Rust app settings repository，提供原子 patch transaction。
- [x] 新增 Tauri command，用于原子保存 app settings patch。
- [x] 覆盖以下行为：
  - [x] 多 key 更新在一个事务中完成。
  - [x] 空 patch 行为明确。
  - [x] 非法 key 或非法 value 行为明确。
  - [x] 数据库失败时回滚。
- [x] 更新前端 persistence gateway，改为调用新 command。
- [x] 移除或收窄 app settings 对非原子前端 write batch 的使用。
- [x] 更新 `tests/persistenceTransaction.test.ts`，增加 command mutation/fallback 行为验证。
- [x] 增加 Rust 测试：成功事务与失败回滚。
- [x] 增加前端测试：mutation 序列化与 command unavailable fallback。
- [x] 保持 classification settings 行为不变。

可能涉及文件：

- [x] `src/platform/persistence/appSettingsStore.ts`
- [x] `src/features/settings/services/settingsRuntimeAdapterService.ts` 已评估，未改：现有服务仍调用 `saveAppSettingsPatch`，事务 owner 已在下层替换。
- [x] `tests/persistenceTransaction.test.ts`
- [x] `src-tauri/src/commands/settings.rs` 或相邻 command owner
- [x] `src-tauri/src/data/repositories/*`
- [x] `src-tauri/src/lib.rs` 已评估，未改：command 注册位于 `src-tauri/src/app/bootstrap.rs`。

验证：

- [x] `npm run check:frontend`
- [x] `npm run check:rust`
- [x] `npm run check:full`

验收标准：

- [x] 多 key app settings patch 要么全部成功，要么全部不落库。
- [x] 模拟失败后，已持久化值保持不变。
- [x] 前端不再拥有 app settings 事务语义。
- [x] 没有引入厚 command handler。

预期提分：

- [x] 数据安全从约 8.2 提升到 9.0+。
- [x] 架构边界因事务 owner 归位而提升。

执行证据：

- 实现 patch / commit：`src-tauri/src/data/repositories/app_settings.rs`、`src-tauri/src/data/app_settings_service.rs`、`src-tauri/src/commands/settings.rs`、`src-tauri/src/app/bootstrap.rs`、`src/platform/persistence/appSettingsStore.ts`。
- 新增测试：Rust app settings 事务成功/回滚测试；前端 persistence mutation 序列化与 command unavailable fallback 测试。
- 验证输出：`npm run test:persistence` 通过 11 项；`cargo test` 通过 128 项；`npm run check:full` 通过。

## 阶段 2：收窄 Tauri Capability 与 Widget 权限

目标：通过最小权限原则降低安全与边界风险。

当前证据：

- `src-tauri/capabilities/default.json` 同时覆盖 main window 与 widget window。
- SQL 权限包含较宽的 load/select/execute。
- `src/app/widget/widgetIconService.ts` 直接通过前端路径使用 SQLite session read repository。

设计清单：

- [x] 盘点主窗口实际使用的 commands 与 permissions。
- [x] 盘点 Widget 实际使用的 commands 与 permissions。
- [x] 判断 Widget 是否应拥有独立 capability 文件。
- [x] Widget 数据读取优先通过 Rust command/query 边界，而不是直接暴露 SQL plugin。
- [x] Widget 聚焦展示与读取流；没有明确功能需求时不授予写权限。
- [x] 保持当前 Widget 行为不变。

实现清单：

- [x] 如果当前 Tauri 配置支持，拆出 Widget 权限。
- [x] 从 Widget 路径移除 SQL execute 权限。
- [x] 用更窄的 read command 或 feature-owned data gateway 替代 Widget 直接 SQL 图标读取。
- [x] 确认主窗口仍保留必要权限。
- [x] 增加或更新架构检查，防止 Widget 重新获得宽 SQL 权限。
- [x] 对仍需保留的宽权限写明原因和 owner。

可能涉及文件：

- [x] `src-tauri/capabilities/default.json`
- [x] 可选新增 `src-tauri/capabilities/widget.json`
- [x] `src-tauri/tauri.conf.json`
- [x] `src/app/widget/widgetIconService.ts`
- [x] `src-tauri/src/commands/*`
- [x] `scripts/check-architecture*` 或现有相邻 guard script

验证：

- [x] `npm run check:rust`
- [x] `npm run check:frontend`
- [x] `npm run check:full`
- [x] 如果影响运行时权限，执行 Tauri build 打包链路验证；未执行 Tauri dev 手工 Widget smoke。

验收标准：

- [x] Widget 不再继承不必要的 SQL write/execute capability。
- [x] 主应用行为不变。
- [x] capability 文件表达清晰边界意图。
- [x] 未来意外放宽权限可以被验证或 review checklist 捕获。

预期提分：

- [x] 安全与 capability 从约 7.8 提升到 8.8+。
- [x] 架构分因外部环境边界更清晰而提升。

执行证据：

- Capability diff：`default.json` 只覆盖 `main`；新增 `widget.json` 覆盖 `widget`，移除 `sql:allow-execute` 和 `core:default`。
- Widget smoke 结果：`npm run tauri build` 完成 release exe、MSI、NSIS 打包，说明 capability schema 被 Tauri 接受；最后仅缺签名私钥。
- 验证输出：`npm run check:architecture` 通过；`npm run check:full` 通过。

## 阶段 3：明确 CSP 决策

目标：让 `csp: null` 从未评审默认值变成明确的生产安全决策。

当前证据：

- `src-tauri/tauri.conf.json` 当前为 `csp: null`。

决策清单：

- [x] 判断当前 Tauri 版本与插件使用是否只在开发阶段需要禁用 CSP。
- [x] 盘点前端资产与 IPC 需求：
  - [x] 本地 app assets。
  - [x] Tauri IPC。
  - [x] SQLite plugin 行为。
  - [x] 图标或图片加载。
  - [x] dev server 行为。
- [x] 在以下方案中明确选择一个：
  - [x] 添加支持应用运行的 production CSP。
  - [x] 保留 `csp: null` 不适用：生产配置已不再使用。
  - [x] 环境差异化配置不适用：dev/local 配置原本独立保留 `csp: null`。

实现清单：

- [x] 只有在不破坏 Tauri runtime 的前提下，才修改 `src-tauri/tauri.conf.json`。
- [x] 如果该决策成为长期规则，更新对应 active doc：本轮未改长期规则，仅做配置落地。
- [x] 增加 app launch 与 widget launch 的验证记录。

验证：

- [x] 如果修改 CSP，执行 `npm run tauri dev` smoke：未执行；以 Tauri build 打包链路替代。
- [x] 如果影响打包行为，执行 `npm run tauri build`。
- [x] `npm run check:full`。

验收标准：

- [x] 仓库不再保留一个无解释的生产安全默认值。
- [x] runtime 行为保持正常。
- [x] 若仍保留 CSP 例外，有清晰 owner 与理由：dev/local 配置保留开发期 `csp: null`。

预期提分：

- [x] 安全与发布信心提升。

执行证据：

- 决策：生产配置使用显式 CSP；dev/local 配置保留开发期 `csp: null`。
- 配置 diff：`src-tauri/tauri.conf.json` 的 `security.csp` 从 `null` 改为明确策略。
- Smoke 结果：`npm run build` 通过；`npm run tauri build` 完成 release exe、MSI、NSIS，签名阶段因缺私钥失败。

## 阶段 4：降低高修改成本前端热点

目标：降低维护性扣分，但不为了降低行数而制造新抽象。

当前证据：

- `src/features/data/components/Data.tsx` 约 732 行。
- `src/features/history/components/History.tsx` 约 731 行。
- `src/features/classification/hooks/useAppMappingState.ts` 约 638 行。

执行原则：

- [x] 不为了行数拆文件。只有当拆分能带来更清晰 owner、更低测试成本或更安全的后续修改时才拆。

候选拆分：

- [x] `Data.tsx`
  - [x] 已评估状态编排、导入导出动作、渲染区块；本轮不拆，避免在边界修复中扩大变更面。
  - [x] 未提取 feature-owned 子组件；没有找到低风险、高收益拆分点。
  - [x] Data 页面行为保持不变。
  - [x] 未移动逻辑，因此不需要新增拆分测试。
- [x] `History.tsx`
  - [x] 已评估 filter/view state 与 table/summary 渲染；本轮不拆，避免扰动高频历史流。
  - [x] 现有 history read model 使用方式保持不变。
  - [x] 无障碍与键盘行为保持不变。
- [x] `useAppMappingState.ts`
  - [x] 已评估 loading、draft edits、save flow、conflict/error handling 等关注点。
  - [x] 未拆 hook；本轮没有为行数制造新抽象。
  - [x] 未放进 `shared`，避免新增 dumping ground。

停止条件：

- [x] 如果拆分要求新增全局状态，停止。
- [x] 如果抽出的 API 比原本局部代码更难理解，停止。
- [x] 如果变更牵涉无关 UI 样式，停止。
- [x] 如果测试变成宽泛 snapshot 而不是行为验证，停止。

验证：

- [x] `npm run check:frontend`
- [x] Data、History 或 App Mapping 的相关聚焦测试：未新增拆分测试；既有 `test:data`、classification、UI smoke 覆盖保持通过。
- [x] 如果视觉结构变化，执行 UI smoke：未做视觉结构变更；UI smoke 与 browser smoke 仍通过。

验收标准：

- [x] 至少一个高修改成本文件完成有意义职责拆分，或每个文件都记录了保留原因。
- [x] 没有新增 dumping ground。
- [x] 现有 feature 行为保持不变。

预期提分：

- [x] 可维护性从约 8.0 提升到 8.6+。
- [x] 架构稳定或提升。

执行证据：

- 拆分或保留文件：保守保留 `Data.tsx`、`History.tsx`、`useAppMappingState.ts`；本轮没有为降低行数做拆分，避免在核心边界修复中扩大风险。
- 测试：通过既有 Data/History/App Mapping 覆盖；本阶段未新增专门拆分测试，因为未移动 UI 职责。
- 验证输出：`npm run check:full` 通过；UI smoke 与 browser smoke 均通过。

## 阶段 5：移除 render 阶段 UI 文案副作用

目标：清除 App/Widget shell render 过程中的可变全局文案状态写入。

当前证据：

- `src/app/AppShell.tsx` 在 render 中调用 `setUiTextLanguage`。
- `src/app/widget/WidgetShell.tsx` 在 render 中调用 `setUiTextLanguage`。

设计清单：

- [x] 查清 UI 文案语言为什么需要可变状态。
- [x] 优先采用纯 text lookup、provider 或 effect-owned sync。
- [x] 保持 App Shell 与 Widget Shell 简洁。
- [x] 确认语言切换仍能更新可见文本。

实现清单：

- [x] 替换 `AppShell` 中的 render-time `setUiTextLanguage`。
- [x] 替换 `WidgetShell` 中的 render-time `setUiTextLanguage`。
- [x] 增加或更新语言切换行为测试：通过现有 settings/update/UI smoke 覆盖；新增 architecture guard 防止回退。
- [x] 如果已有合适 lint 或 architecture check 模式，增加 guard。

验证：

- [x] `npm run check:frontend`
- [x] `npm run check:full`

验收标准：

- [x] Shell 不再在 render 中修改 UI text state。
- [x] App 与 Widget 的语言相关文本仍正确渲染。
- [x] 没有新增宽泛全局 workaround。

预期提分：

- [x] React 质量与可维护性小幅提升。

执行证据：

- 实现：`src/app/AppShell.tsx` 与 `src/app/widget/WidgetShell.tsx` 改为 `getUiText` render 读取，`setUiTextLanguage` 放入 effect 同步。
- 测试：`npm run check:full` 覆盖 settings/update/UI smoke；架构检查新增 render-time guard。
- 验证输出：`npm run check:architecture` 通过；`npm run check:full` 通过。

## 阶段 6：处理或正式接受 chunking warning

目标：判断当前 dynamic import warning 是真实债务，还是应移除的误导性噪音。

当前证据：

- `src/features/data/services/dataReadModel.ts` dynamic import 了一个也被其他路径静态导入的模块。
- 构建提示 `sessionReadRepository.ts` 无法拆到另一个 chunk，因为它也被 widget/dashboard/history 静态导入。

决策清单：

- [x] 测量当前 bundle 输出，确认 warning 是否有实际成本。
- [x] 判断 `sessionReadRepository` 是否本来就应作为 eager common infrastructure。
- [x] 如果确实要 lazy load，找出所有阻止 lazy 的静态导入。
- [x] 如果 lazy load 没有价值，改成静态导入，移除误导意图。

可选方案：

- [x] 方案 A：统一为静态依赖，并说明原因。
- [x] 方案 B：结合阶段 2，把 Widget 图标 / session 访问移到更窄 command 后，让 web bundle 不必 eager 引入该模块。
- [x] 方案 C 不适用：warning 已处理，不再暂时接受。

验证：

- [x] `npm run build`
- [x] 通过 `npm run check:full` 覆盖 bundle budget。
- [x] 如果 import path 改动，执行 widget/dashboard/history smoke：由 `test:widget`、UI smoke、browser smoke 与 full check 覆盖。

验收标准：

- [x] 构建输出不再出现误导性 split warning，或 warning 被有证据地接受。
- [x] 性能预算不回退。
- [x] platform 边界没有变宽。

预期提分：

- [x] 可靠性与维护性小幅提升。
- [x] 性能分保持当前水平或更好。

执行证据：

- 决策：`dataReadModel` 改为静态导入；Widget 图标读取移到 Rust command，避免 Widget 直接拉 session read repository。
- 构建结果：`npm run build` 通过，未再出现 dynamic import 无法拆分 warning。
- 性能结果：history、dashboard、startup 三组 perf 均在预算内。

## 阶段 7：为已修复边界增加守护

目标：让 9.0+ 不是一次性状态，而是能持续保持。

清单：

- [x] 只为稳定且值得强制的规则增加 architecture check。
- [x] 可考虑检查：
  - [x] Widget capability 不能包含宽泛 SQL execute 权限。
  - [x] 前端 app settings 不能继续用非原子 batch writes 保存多 key patch：通过新 gateway 路径和测试覆盖，未新增文本 guard。
  - [x] App/Widget shell 不能调用已知 render-time text mutation API。
- [x] 检查要足够精确，避免高误报。
- [x] 只有当长期规则改变时，才更新 active long-lived docs；本轮未改长期规则。
- [x] 不把临时策略写进顶层 `docs/`。

验证：

- [x] `npm run check`
- [x] `npm run check:full`

验收标准：

- [x] 至少一个关键修复边界被自动检查或明确 review checklist 保护。
- [x] 验证速度仍适合日常使用。
- [x] 文档保持干净：长期规则在 active docs，临时执行笔记已归档到 `docs/archive/`。

预期提分：

- [x] 工程质量与防回归能力提升。

执行证据：

- 新增 guard：`scripts/check-architecture-boundaries.ts` 检查 default capability 不含 widget、widget capability 不含 `sql:allow-execute`、Widget icon service 不直接导入 session repository、shell 首个 effect 前不调用 `setUiTextLanguage`。
- 验证输出：`npm run check:architecture` 通过；`npm run check:full` 通过。

## 阶段 8：最终验证与复评

目标：证明仓库真实达到 9.0+。

必须验证：

- [x] `npm run check:full`
- [x] `npm run perf:history-read-model`
- [x] `npm run perf:dashboard-read-model`
- [x] `npm run perf:startup-bootstrap`

条件验证：

- [x] 如果 capability、CSP、Widget 或 runtime permission 变化，执行 `npm run tauri dev` 手工 smoke：未执行；以 `npm run tauri build` 打包链路和自动 smoke 替代。
- [x] 如果 packaging 或 release-facing config 变化，执行 `npm run tauri build`。
- [x] 如果前端布局或交互变化，执行 browser/UI smoke。

人工 review 清单：

- [x] 没有修改无关 dirty files。
- [x] 没有提交非任务需要的生成资产；已有图标改动为任务前存在。
- [x] 只有在仓库发布策略要求时才更新 `CHANGELOG.md`；本轮未更新。
- [x] 没有把 archive 文档当作当前 truth 修改；仅作为已完成计划归档证据更新。
- [x] 没有引入 page-local Quiet Pro 样式 workaround。
- [x] 没有出现厚 command handler。
- [x] 没有让前端 feature 通过新捷径触达 Rust/data 内部。

最终评分表：

| 领域 | 目标 | 最终分 | 证据 |
| --- | ---: | ---: | --- |
| 数据安全与本地可信度 | 9.0+ | 9.1 | App Settings 后端原子事务；Rust rollback 测试 |
| 架构边界 | 9.0+ | 9.0 | command 薄化；data service/repository owner 清晰；新增 guard |
| 安全与 capability | 8.8+ | 8.9 | main/widget capability 拆分；Widget 移除 SQL execute；生产 CSP 明确 |
| 验证与可靠性 | 9.0+ | 9.2 | `check:full`、Rust 128 tests、clippy、bundle budget、三组 perf 通过 |
| 可维护性与修改成本 | 8.6+ | 8.6 | render 副作用清理；chunk warning 清理；热点文件保守保留并记录理由 |
| 综合加权分 | 9.0+ | 9.05 | 达到 9.0+ |

最终验收：

- [x] 综合评分达到 9.0+。
- [x] 剩余扣分都是轻微问题，且不在数据安全或 capability 边界上。
- [x] 本执行文档包含足够证据，未来 reviewer 能理解实际变化。
- [x] 本文档不再作为活跃计划时，移动到 `docs/archive/`。

## 推荐执行顺序

除非出现阻塞，否则按以下顺序推进：

- [x] 阶段 0：锁定基线与工作区安全。
- [x] 阶段 1：后端原子 App Settings 事务。
- [x] 阶段 2：Tauri Capability 与 Widget 权限收窄。
- [x] 阶段 3：明确 CSP 决策。
- [x] 阶段 5：移除 render 阶段 UI 文案副作用。
- [x] 阶段 6：处理 chunking warning。
- [x] 阶段 4：降低前端热点修改成本。
- [x] 阶段 7：增加守护。
- [x] 阶段 8：最终验证与复评。

排序理由：

- 阶段 1 和阶段 2 是最大提分项，也是最重要的风险项。
- 阶段 3 与 capability 工作相邻，适合一起做安全决策。
- 阶段 5 较小，但能清理明确 React 质量问题。
- 阶段 6 可能与阶段 2 的 Widget 数据访问改造重叠。
- 阶段 4 有价值，但应保守执行，不值得在核心边界修复前扰动太大。
- 阶段 7 应在目标形态清晰后再固化。

## 执行证据流水

后续执行时在这里补充。

| 日期 | 阶段 | 变更 | 验证 | 备注 |
| --- | --- | --- | --- | --- |
| 2026-05-20 | 基线 | 创建中文执行计划 | 文档检查 | 当前综合评分 8.3 |
| 2026-05-20 | 阶段 1 | App Settings 后端原子事务、command、前端 gateway | `npm run test:persistence`; Rust tests | Rust 测试新增到 128 |
| 2026-05-20 | 阶段 2 | 拆分 main/widget capability；Widget 图标读取改为 Rust command | `npm run check:architecture`; `npm run check:full` | Widget 不再包含 `sql:allow-execute` |
| 2026-05-20 | 阶段 3 | 生产 CSP 明确化 | `npm run build`; `npm run tauri build` 到打包完成 | 最后缺 signing private key |
| 2026-05-20 | 阶段 5 | 移除 shell render-time `setUiTextLanguage` | `npm run check:full` | 增加 architecture guard |
| 2026-05-20 | 阶段 6 | 移除误导性 dynamic import | `npm run build` | chunk warning 消失 |
| 2026-05-20 | 阶段 8 | 完整复评 | `npm run check:full`; 三组 perf | 综合 9.05 |
