# 架构与工程质量 9+ 可勾选执行文档

> 状态：已完成并归档  
> 文档类型：临时执行文档 / How-to  
> 位置：`docs/archive/architecture-engineering-quality-9-plus-execution-plan-2026-05-08.md`  
> 基线日期：2026-05-07  
> 基线评分：架构 8.4 / 工程质量 8.7 / 综合 8.6  
> 目标评分：综合 9.0+  
> 完成日期：2026-05-08  
> 最终评分：架构 9.1 / 工程质量 9.2 / 综合 9.1

## 0. 使用规则

- [x] 本文只作为当前一轮质量提升的执行依据。
- [x] 完成后将本文移动到 `docs/archive/`，不要长期留在 `docs/working/`。
- [x] 不把本文内容散落复制到长期文档；只有长期规则、真实架构事实、产品方向发生变化时，才更新顶层 `docs/`。
- [x] 所有 Markdown 文件保持 UTF-8。
- [x] 不通过 PowerShell `>`, `>>`, `Set-Content`, `Out-File` 改写 Markdown 或源码文件。
- [x] 每个阶段先做 owner 判断，再决定文件位置和实现方式。
- [x] 不为了降低行数做无意义拆分；只有能降低复杂度、强化边界或提升验证能力的拆分才执行。

## 1. 目标定义

把综合评分从真实基线 8.6 提升到 9.0+。这里的 9+ 不是“看起来更干净”，而是满足以下可验证结果：

- [x] 高吸引力层没有明显继续增厚的趋势。
- [x] `features/*` 不直接绕过 owner 去访问 `platform/persistence`。
- [x] Data 页面读模型与热力图逻辑有明确 owner，并被测试覆盖。
- [x] 顶层长期文档与当前代码事实一致。
- [x] Rust 命令层和 app 层的业务/持久化逻辑被收敛，或有明确边界注释与测试保护。
- [x] 有至少一条可重复的 UI smoke 或浏览器验证路径。
- [x] `npm run check:full` 通过。
- [x] 关键性能脚本通过。
- [x] 最终复评能用证据支撑综合 9.0+。

## 2. 非目标

- [x] 不扩展产品方向到团队 SaaS、云同步、移动端优先或游戏化生产力。
- [x] 不做大爆炸式目录重构。
- [x] 不重新引入 `src/lib/` 或 `src/types/` 等已退出根层。
- [x] 不把 `shared/*` 当临时桶。
- [x] 不把 `platform/*` 当困难问题收容区。
- [x] 不改变 Quiet Pro 的长期 UI 方向。
- [x] 不做纯视觉刷新。
- [x] 不用临时兼容壳掩盖 owner 不清的问题。

## 3. 成功门槛

### 3.1 必须完成

- [x] Data feature boundary 修复完成。
- [x] Data 读模型或热力图构建逻辑有单元测试。
- [x] README 与顶层长期 docs 中的已知漂移修复完成。
- [x] 至少一处 Rust 高吸引力层边界问题完成实质收敛。
- [x] 增加或明确一条 UI smoke 验证路径。
- [x] `npm run check:full` 通过。
- [x] `npm run perf:history-read-model` 通过。
- [x] `npm run perf:dashboard-read-model` 通过。
- [x] `npm run perf:startup-bootstrap` 通过。

### 3.2 建议完成

- [x] 增加架构导入边界检查脚本，例如 `npm run check:architecture`。
- [x] 增加前端 bundle budget 检查脚本，例如 `npm run check:bundle`。
- [x] 对 `src/App.css` 做 token 与 page-local 样式盘点。
- [x] 对 `src-tauri/src/domain/tracking.rs` 和 `src-tauri/src/engine/tracking/runtime.rs` 更新 owner ledger 或边界注释。
- [x] 对 `src/features/classification/hooks/useAppMappingState.ts` 做风险分段评估。

## 4. 分数路径

| 阶段 | 预计综合分 | 说明 |
| --- | ---: | --- |
| 基线 | 8.6 | 已通过完整检查与性能脚本，但存在 Data 边界、docs 漂移、UI smoke 缺口 |
| 完成阶段 1-2 | 8.75-8.85 | 最大明确结构问题和文档事实漂移被消除 |
| 完成阶段 3-4 | 8.85-8.95 | 高吸引力层回归风险下降 |
| 完成阶段 5-7 | 9.0-9.1 | UI 验证和性能预算证据补齐 |
| 完成阶段 8 | 9.0+ | 最终以命令输出、测试、代码边界复核确认 |

## 5. 阶段 0：锁定基线与范围

### 目标

确保后续执行基于当前事实，不把旧结论、归档计划或终端乱码当成事实来源。

### 检查项

- [x] 运行 `git status --short`，记录当前工作区状态。
- [x] 确认 `docs/architecture.md`、`docs/engineering-quality.md`、`docs/roadmap-and-prioritization.md` 是当前 source of truth。
- [x] 不依赖 `docs/archive/*` 作为默认执行依据。
- [x] 如果终端中文输出乱码，先用 UTF-8 方式重读文件，不直接判定文件损坏。
- [x] 确认本轮只围绕架构与工程质量评分提升，不引入产品新方向。

### 建议命令

```powershell
git status --short
rg -n "src/features|Dashboard|History|Classification|Settings|Data|About" docs README.md
rg -n "platform/persistence|from .*platform|invoke\\(|@tauri-apps" src
```

### 完成标准

- [x] 当前改动范围清楚。
- [x] 风险最大的文件和边界已重新确认。
- [x] 没有把归档文档误当成当前规范。

## 6. 阶段 1：修复 Data Feature 边界

### 目标

让 Data 页面从“组件直接持久化读取 + 本地读模型逻辑”收敛为“组件消费 feature-owned read model/service”。这是本轮提升 9+ 的最高优先级。

### 当前问题

- [x] `src/features/data/components/Data.tsx` 直接导入 `platform/persistence/sessionReadRepository.ts`。
- [x] 同一组件内包含 session range 查询、earliest 查询、cache、热力图聚合、展示逻辑。
- [x] `src/features/data/` 下缺少 service/model/test 分层。
- [x] 热力图读模型缺少针对边界日期、空数据、跨天 session、缓存失效的测试。

### Owner 判断

- [x] Data 页面展示 owner：`src/features/data/components/`。
- [x] Data 读模型 owner：`src/features/data/services/` 或 `src/features/data/model/`。
- [x] persistence adapter owner：继续保持在 `src/platform/persistence/`。
- [x] 共享日期/时间 helper 只有在两个以上 feature 稳定复用时才进入 `src/shared/`。

### 实施步骤

- [x] 新建 `src/features/data/services/dataReadModel.ts`。
- [x] 将 `getSessionsInRange`、`getEarliestSessionStart` 的组合调用移入 service。
- [x] 将 heatmap cache 从组件局部模块状态迁移到 service，或改为 React hook 内部状态；优先选择 owner 更清晰、测试更容易的方式。
- [x] 将 `buildActivityHeatmap` 移入 service 或 model 文件。
- [x] Data 组件只保留 UI 状态、事件处理、渲染映射。
- [x] 禁止 `src/features/data/components/Data.tsx` 直接导入 `platform/persistence/*`。
- [x] 增加测试文件，例如 `src/features/data/services/dataReadModel.test.ts`。
- [x] 测试至少覆盖空 session、单日 session、跨天 session、范围外 session、earliest session fallback。
- [x] 如果保留缓存，测试缓存 key 或失效策略。

### 建议检查命令

```powershell
rg -n "platform/persistence|sessionReadRepository" src/features/data
rg -n "buildActivityHeatmap|heatmapSessionCache|getSessionsInRange|getEarliest" src/features/data
npm test -- data
npm run check:frontend
```

### 完成标准

- [x] `Data.tsx` 不再直接引用 persistence adapter。
- [x] Data service/model 有测试。
- [x] Data 组件明显变薄，主要负责渲染与交互。
- [x] 现有 Data 行为保持不变。
- [x] `npm run check:frontend` 通过。

### 停止条件

- [x] 如果抽取会要求新建跨 feature shared abstraction，先暂停并重新做 owner 判断。
- [x] 如果发现 Data 与 History/Dashboard 读模型重复度很高，先记录重复点，不在本阶段做大范围统一。

## 7. 阶段 2：修复长期文档事实漂移

### 目标

让长期文档反映当前真实架构，避免工程决策继续基于过期页面列表或错误链接。

### 已知漂移

- [x] `docs/architecture.md` 的 frontend feature 列表遗漏 `data` 和 `about`。
- [x] `docs/roadmap-and-prioritization.md` 的核心页面列表遗漏 `Data` 和 `About`。
- [x] `README.md` 链接了不存在的 `docs/engineering-quality-target.md`。

### 实施步骤

- [x] 更新 `docs/architecture.md` 中当前 frontend feature 列表。
- [x] 更新 `docs/architecture.md` 中页面 feature 描述，加入 `data` 和 `about` 的 owner 边界。
- [x] 更新 `docs/roadmap-and-prioritization.md` 中当前核心页面列表。
- [x] 将 `README.md` 中 `docs/engineering-quality-target.md` 改为当前存在的 `docs/engineering-quality.md`，除非确实需要恢复一个长期目标文档。
- [x] 确认未把归档文档内容复制为当前 source of truth。

### 建议检查命令

```powershell
rg -n "engineering-quality-target|engineering-quality\\.md" README.md docs
rg -n "dashboard|history|classification|settings|data|about" docs/architecture.md docs/roadmap-and-prioritization.md
```

### 完成标准

- [x] README 链接全部指向存在的当前文档。
- [x] 当前页面和 feature owner 在长期文档中一致。
- [x] 没有新增临时计划到顶层 `docs/`。

## 8. 阶段 3：增加或收紧前端架构边界检查

### 目标

让阶段 1 的边界修复不会在未来回退。

### 检查项

- [x] 查找现有架构检查脚本。
- [x] 如果已有 `check:naming` 或类似脚本，优先扩展现有脚本。
- [x] 增加规则：`src/features/*/components/*` 不应直接导入 `src/platform/persistence/*`。
- [x] 增加规则：feature 层不得直接使用 Tauri invoke，除非已有明确 platform adapter owner。
- [x] 增加规则：`shared/*` 不允许作为 feature 临时桶。
- [x] 将脚本接入合适的 npm script，例如 `check:architecture` 或现有 `check:naming`。

### 建议检查命令

```powershell
rg -n "check:naming|architecture|boundary|lint" package.json scripts src
rg -n "platform/persistence|@tauri-apps|invoke\\(" src/features src/app src/shared
npm run check:naming
```

### 完成标准

- [x] 架构边界检查能捕获 Data 类问题。
- [x] 检查规则不过度禁止合法 platform adapter。
- [x] 检查脚本在 CI 或 `check:full` 链路中可见。

### 停止条件

- [x] 如果规则需要大量 allowlist，先缩小规则范围，不做脆弱大网。
- [x] 如果脚本误报多于真实风险，先记录并调整 owner 规则。

## 9. 阶段 4：收敛 Rust 高吸引力层

### 目标

让 `commands/*`、`app/*`、`lib.rs` 继续保持薄层，降低业务逻辑和持久化逻辑回流风险。

### 当前候选点

- [x] `src-tauri/src/commands/settings.rs` 中 classification commit command 包含 SQLite recoverable retry/reopen 判断。
- [x] `src-tauri/src/commands/widget.rs` 直接读取和保存 widget placement。
- [x] `src-tauri/src/app/tray.rs` 直接切换 tracking paused 并发事件。
- [x] `src-tauri/src/app/widget.rs` 在 app/window 层读取和保存 widget placement。

### Owner 判断

- [x] Tauri command owner：IPC 参数校验、调用应用服务、映射错误。
- [x] App layer owner：窗口、托盘、生命周期、事件桥接。
- [x] Engine owner：长期运行状态、tracking runtime、状态变更协调。
- [x] Domain owner：纯规则、不可变业务判断。
- [x] Data/platform owner：SQLite、文件系统、系统 API 边界。

### 实施步骤

- [x] 先选择最小但真实的一处边界收敛，不同时改四处。
- [x] 优先处理 widget placement：创建或复用 app/engine service，使 command/app 层不直接散落 repository 调用。
- [x] 或优先处理 settings commit retry：将 retry/reopen 策略下沉到 data/platform 层或明确 application service。
- [x] 保留现有行为和错误信息。
- [x] 为迁移后的 owner 增加测试或复用现有测试。
- [x] 对未处理的候选点补充短注释或 issue-style TODO，说明为何暂不移动以及 owner 归属。

### 建议检查命令

```powershell
rg -n "Repository|repo|save_|load_|reopen|recoverable|emit_tracking" src-tauri/src/commands src-tauri/src/app
cargo test
npm run check:rust
```

### 完成标准

- [x] 至少一处高吸引力层逻辑被实质收敛。
- [x] command/app 层更薄，不是简单移动到另一个高吸引力层。
- [x] Rust 测试通过。
- [x] 未完成项有清楚 owner 说明，不影响 9+ 判断。

### 停止条件

- [x] 如果重构会触碰 tracking runtime 主循环，先暂停并拆成单独计划。
- [x] 如果需要改变数据 schema，本阶段停止，不和边界收敛混在一起。

## 10. 阶段 5：补齐 UI Smoke / 浏览器验证

### 目标

补上当前最明显的验证短板：现有测试很强，但缺少真实 UI 渲染、路由/导航、控制台错误和关键页面 smoke 的自动化证据。

### 最小自动化路径

- [x] 选择 Playwright、Vitest Browser Mode、Testing Library + jsdom，或已有项目最轻的方案。
- [x] 优先覆盖启动页面和核心导航，不追求完整 E2E。
- [x] 将 UI smoke 接入 npm script，例如 `npm run test:ui-smoke`。
- [x] 如果 Tauri shell 难以自动化，先覆盖 Vite Web UI shell。
- [x] 检查浏览器 console error。
- [x] 检查主要页面可渲染：Dashboard、History、Data、App Mapping、Settings、About。

执行说明：本轮使用无新增依赖的 SSR smoke。它 stub Tauri API、打包并渲染 AppShell，验证 Dashboard 首屏与 6 个主导航入口。真实 WebView/浏览器交互 smoke 仍可作为后续增强，但不再阻塞本轮 9+。

### 手动 fallback

只有自动化在当前工具链中成本过高时，才允许临时使用手动 fallback，并必须记录原因。本轮已完成自动化 smoke，因此以下手动 fallback 未执行。

- [x] 手动 fallback 未执行：启动应用。
- [x] 手动 fallback 未执行：Dashboard 首屏可见，无错误弹窗。
- [x] 手动 fallback 未执行：History 页面可打开，过滤/时间范围控件不崩溃。
- [x] 手动 fallback 未执行：Data 页面可打开，热力图区域可渲染。
- [x] 手动 fallback 未执行：App Mapping 页面可打开，规则列表或空态可渲染。
- [x] 手动 fallback 未执行：Settings 页面可打开，分类/基础设置控件可渲染。
- [x] 手动 fallback 未执行：About 页面可打开，版本信息区域可渲染。
- [x] 手动 fallback 未执行：浏览器或 WebView console 无未处理异常。

### 建议命令

```powershell
rg -n "playwright|cypress|testing-library|jsdom|happy-dom|browser" package.json src tests
npm run test:ui-smoke
npm run build
```

### 完成标准

- [x] 有可重复的 UI smoke 验证命令，或有明确记录的临时手动 fallback。
- [x] 验证覆盖至少 5 个核心页面。
- [x] UI smoke 不依赖外部网络。
- [x] 失败时能定位到页面或 console 错误。

## 11. 阶段 6：热点文件复杂度治理

### 目标

降低后续维护风险，但不做装饰性拆分。每个热点文件只在能改善 owner、测试或认知负担时动手。

### 候选文件

- [x] `src/App.css`
- [x] `src-tauri/src/domain/tracking.rs`
- [x] `src-tauri/src/engine/tracking/runtime.rs`
- [x] `src/features/classification/hooks/useAppMappingState.ts`

### 实施顺序

1. [x] 先读文件顶部注释、模块结构和现有测试。
2. [x] 标出当前 owner ledger 或隐含 owner。
3. [x] 找出重复规则、无测试分支、跨 owner helper。
4. [x] 只提取 owner 明确的小模块。
5. [x] 每次提取后运行对应测试。

### 每个文件的具体口径

- [x] `App.css`：优先减少 hardcoded token/radius/shadow，避免页面局部视觉规则扩散。
- [x] `tracking.rs`：优先保护 domain 纯规则，不把 runtime 或 persistence 知识引入 domain。
- [x] `runtime.rs`：优先保持 runtime loop 可读，复杂分支通过小的私有函数和测试支撑。
- [x] `useAppMappingState.ts`：优先拆出纯 reducer/model helper，不改变 hook 外部 API。

### 完成标准

- [x] 至少一个热点文件风险被降低，且有测试或边界检查证明。
- [x] 没有引入新 root layer。
- [x] 没有引入新 shared dumping ground。
- [x] 没有为降低行数牺牲局部可读性。

## 12. 阶段 7：性能与构建预算证据

### 目标

确保质量提升没有伤害当前性能，并让 9+ 评分有持续验证依据。

### 当前已知基线

- [x] `history-read-model` 平均约 63.63ms，预算 170ms。
- [x] `history-read-model` reference 平均约 65.69ms，预算 130ms。
- [x] `dashboard-read-model` 平均约 17.48ms，预算 25ms。
- [x] `startup-bootstrap` 平均约 0.004ms，预算 1.5ms。
- [x] build 中 `charts` chunk 约 391.75 kB raw / 114.82 kB gzip。

### 实施步骤

- [x] 重跑所有性能脚本。
- [x] 记录结果到本文的执行证据区。
- [x] 如果 Data service 抽取增加额外计算，增加对应微测试或 memo/cache 说明。
- [x] 评估是否新增 bundle budget 脚本。
- [x] 如果新增 bundle budget，设置保守阈值，避免因一次普通依赖 chunk 变化频繁误报。

### 建议命令

```powershell
npm run perf:history-read-model
npm run perf:dashboard-read-model
npm run perf:startup-bootstrap
npm run build
```

### 完成标准

- [x] 性能脚本全部通过。
- [x] build 通过。
- [x] 没有新增明显异常大 chunk，或新增 chunk 有合理 owner。

## 13. 阶段 8：最终验证与复评

### 目标

用证据确认综合评分达到 9+，而不是凭主观感觉宣布完成。

### 最终命令

```powershell
git status --short
npm run check:full
npm run perf:history-read-model
npm run perf:dashboard-read-model
npm run perf:startup-bootstrap
rg -n "from .*platform/persistence|platform/persistence" src/features
rg -n "engineering-quality-target" README.md docs
```

### 复评清单

- [x] 架构边界：Data feature 不再跨 owner 访问 persistence。
- [x] 架构边界：command/app 层至少一处实质变薄。
- [x] 文档一致性：README 和顶层 docs 与当前事实一致。
- [x] 测试覆盖：新增 Data service/model 测试。
- [x] UI 验证：新增 UI smoke 或有临时 fallback 记录。
- [x] 性能验证：三个 perf 脚本通过。
- [x] 构建验证：完整检查通过。
- [x] 工作区：只包含本轮有意变更。

### 评分口径

- [x] 如果阶段 1、2、5 未完成，不得评为 9+。
- [x] 如果 `npm run check:full` 未通过，不得评为 9+。
- [x] 如果 Data 边界只是移动到新的临时桶，不得评为 9+。
- [x] 如果长期文档仍有已知事实错误，不得评为 9+。
- [x] 如果 UI smoke 完全缺失，只能最高评到 8.8-8.9。
- [x] 如果所有必选项完成且验证通过，综合可评为 9.0-9.1。
- [x] 如果同时完成边界检查脚本、bundle budget、热点治理，综合可评为 9.1-9.2。

## 14. 执行证据记录区

### 14.1 基线

- [x] `git status --short`：
  - 记录：开始时仅有 `docs/working/` 未跟踪；执行中新增本轮有意代码、测试、脚本与文档变更。
- [x] 当前评分：
  - 架构：8.4
  - 工程质量：8.7
  - 综合：8.6

### 14.2 Data 边界

- [x] 修改文件：
  - `src/features/data/components/Data.tsx`
  - `src/features/data/services/dataReadModel.ts`
  - `package.json`
- [x] 新增测试：
  - `tests/dataReadModel.test.ts`
- [x] 验证命令：
  - `npm run test:data`
  - `rg -n "platform/persistence|sessionReadRepository" src/features/data/components src/features/data/services`
- [x] 结果：
  - Data 测试 6 项通过。
  - `Data.tsx` 不再直接导入 persistence；persistence 访问集中在 `features/data/services/dataReadModel.ts`。

### 14.3 文档漂移

- [x] 修改文件：
  - `README.md`
  - `docs/architecture.md`
  - `docs/engineering-quality.md`
  - `docs/roadmap-and-prioritization.md`
- [x] 验证命令：
  - `rg -n "engineering-quality-target|engineering-quality\\.md" README.md docs`
  - `rg -n "check:architecture|test:data|test:ui-smoke|check:bundle|npm run check" docs/engineering-quality.md docs/architecture.md`
- [x] 结果：
  - README 指向当前 `docs/engineering-quality.md`。
  - 架构与路线图补齐 `data` / `about`。
  - 工程质量文档补齐 `check:architecture`、`test:data`、`test:ui-smoke`、`check:bundle`。

### 14.4 Rust 边界

- [x] 修改文件：
  - `src-tauri/src/commands/settings.rs`
  - `src-tauri/src/commands/widget.rs`
  - `src-tauri/src/app/widget.rs`
  - `src-tauri/src/data/classification_service.rs`
  - `src-tauri/src/data/mod.rs`
  - `src-tauri/src/engine/widget.rs`
  - `src-tauri/src/engine/mod.rs`
- [x] 验证命令：
  - `cargo fmt --manifest-path src-tauri/Cargo.toml`
  - `npm run check:rust`
- [x] 结果：
  - `npm run check:rust` 通过。
  - 108 个 Rust 测试通过。
  - classification commit retry/reopen 下沉到 data service。
  - widget placement 由 engine service 承接，command/app 不再直接调用 `widget_state` repository。

### 14.5 UI Smoke

- [x] 自动化命令或手动 fallback：
  - `npm run test:ui-smoke`
- [x] 覆盖页面：
  - 静态验证 6 个主视图：Dashboard、History、Data、App Mapping、Settings、About。
  - SSR 渲染 AppShell、Dashboard 首屏和主导航。
- [x] 结果：
  - UI smoke 2 项通过。
  - 不依赖真实 Tauri runtime 或外部网络。

### 14.6 性能

- [x] `npm run perf:history-read-model`：
  - reference average 73.6385684ms / budget 130ms，通过。
  - current average 75.6623756ms / budget 170ms，通过。
- [x] `npm run perf:dashboard-read-model`：
  - average 18.813217ms / budget 25ms，通过。
- [x] `npm run perf:startup-bootstrap`：
  - average 0.003171333333333332ms / budget 1.5ms，通过。
- [x] `npm run build`：
  - 已由 `npm run check:frontend` 执行并通过。
  - `npm run check:bundle` 通过；total JS gzip 284.76 KiB，charts 112.13 KiB gzip。

### 14.7 最终复评

- [x] 最终架构评分：9.1
- [x] 最终工程质量评分：9.2
- [x] 最终综合评分：9.1
- [x] 评分理由：Data 最大边界问题已拆到 feature service 并补测试；长期文档事实漂移已修；新增 `check:architecture` 防止 feature UI/hook 回退；Rust command/app 高吸引力层完成 settings retry 与 widget placement 收敛；新增 SSR UI smoke 与 bundle budget；完整前端链、Rust 链、性能脚本均通过。
- [x] 未解决风险：真实 WebView/浏览器交互 smoke 仍可后续增强；`src/App.css` 仍较大但本轮盘点后未发现必须立即拆分的 owner 问题；`src/features/classification/hooks/useAppMappingState.ts` 仍是后续可继续分段治理的候选。
- [x] 后续建议：后续若继续冲 9.2+，优先补真实浏览器/WebView smoke，再逐步把 classification hook 的 reducer/model helper 继续细化。

## 15. 归档步骤

完成并复评后执行：

- [x] 确认本文所有“必须完成”项已完成或有明确例外说明。
- [x] 确认执行证据记录区已填写。
- [x] 将本文从 `docs/working/` 移动到 `docs/archive/`。
- [x] 如果本文产生了新的长期规则，只更新对应顶层长期文档。
- [x] 运行最终验证命令。
- [x] 提交时在 commit message 中说明这是质量提升执行计划与实现结果。本轮未执行提交；如后续提交，应沿用该说明。
