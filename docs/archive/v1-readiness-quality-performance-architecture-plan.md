# v1.0.0 Readiness 工程质量、性能与架构执行方案

创建日期：2026-05-21

状态：已完成并归档

文档类型：How-to / 执行方案

目标读者：后续维护者、发版执行者、参与工程收口的 agent

归档日期：2026-05-21

---

## 1. 目标

本方案的目标是把 `Time Tracker` 的工程质量、性能、架构与发布可信度推进到“可以认真考虑 `v1.0.0` 正式版”的水平。

当前明确约束：

- 下一个版本不直接定为 `1.0.0`。
- 下一个版本应作为一次高质量 `0.x` 发布演练。
- 如果下一个版本质量足够好，可以在其基础上重复一轮同等严格的发版流程，再决定是否提升到 `1.0.0`。
- 目标评分是 10 分满分，尽量接近，不为了满分牺牲风险控制。

最终判断口径：

> `1.0.0` 不是“功能做够了”，而是核心桌面时间追踪产品已经足够可信、可验证、可维护、可发布。

---

## 2. 非目标

本方案不做以下事情：

- 不扩展产品方向到团队 SaaS、云同步、移动端优先或游戏化路线。
- 不为了目录整齐做大规模无收益搬迁。
- 不引入新的 UI 视觉方向；所有 UI 仍遵守 Quiet Pro。
- 不把性能优化建立在主观感觉上。
- 不跳过数据安全、tracking 正确性、恢复路径与发布链验证。
- 不承诺一定达到 10 分；10 分是方向，不是制造风险的理由。

---

## 3. v1.0.0 Readiness 定义

只有同时满足下面条件，才可以进入 `1.0.0` 讨论：

- 默认完整质量门槛 `npm run check:full` 稳定通过。
- 发布门槛 `npm run release:check` 稳定通过。
- tracking 主链、读模型、备份恢复、清理、设置、更新入口都有明确验证覆盖。
- 前端 `app / features / shared / platform` 边界没有明显回流。
- Rust `lib.rs + app / commands / platform / engine / data / domain` 边界没有明显回流。
- 高频页面和启动路径有可重复的性能测量，不存在已知明显退化。
- release / updater / changelog / version 文件一致性可重复验证。
- 文档与脚本没有指向已删除入口、过期命令或已退出结构。
- 至少完成一轮非 `1.0.0` 的高质量正式发布演练。

---

## 4. 评分模型

总分 10 分。评分用于判断 readiness，不用于粉饰结果。

### 4.1 可靠性与验证：2.0 分

验收点：

- `tracking` 生命周期、AFK、锁屏、睡眠、崩溃恢复、心跳与封口行为有测试或手工验证记录。
- `Dashboard / History / Data` 读模型对活跃 session、stale tracker、清理后数据、跨日 session 有回归覆盖。
- 备份、恢复、清理、settings persistence、classification persistence 有自动化测试。
- SQLite migration 与 legacy repair 有 Rust 测试覆盖。
- 真实浏览器 smoke 和 UI SSR smoke 稳定通过。

扣分信号：

- 有未经验证的 tracking 主链改动。
- 有用户数据不可恢复或不可解释风险。
- 有只能靠“应该没问题”解释的发布阻断项。

### 4.2 架构边界：2.0 分

验收点：

- `npm run check:architecture` 通过，且规则覆盖当前高风险边界。
- `npm run check:naming` 通过，raw DTO 与协议字段没有扩散。
- `npm run check:rust-boundaries` 通过。
- `app/*`、`shared/*`、`platform/*` 没有新增无 owner 的厚逻辑。
- Rust `commands/*`、`app/*`、`lib.rs` 保持薄入口。
- 兼容壳、forwarding、legacy 层有明确 owner 与退出条件。

扣分信号：

- 页面、hook 或 component 直接访问平台、SQLite、Tauri API。
- `shared/*` 变成临时公共桶。
- `commands/*` 或 `lib.rs` 重新承接业务流程。
- 为了快速修复制造新的长期例外。

### 4.3 代码质量与可维护性：1.5 分

验收点：

- TypeScript strict、no unused、Rust clippy 都通过。
- 测试 helper 留在测试目录，不污染生产共享层。
- 无明显死文件、过期脚本、重复薄规则。
- 关键模块命名与 owner 一致。
- 高风险路径有足够局部测试，低风险清理不过度扩大范围。

扣分信号：

- 只有测试使用的代码留在 `src/shared`。
- 同一规则在多个地方重复实现且没有单一 owner。
- 删除代码后脚本、文档或 CI 仍指向旧入口。

### 4.4 性能与资源成本：1.5 分

验收点：

- `npm run perf:startup-bootstrap` 有基线与预算。
- `npm run perf:dashboard-read-model` 有基线与预算。
- `npm run perf:history-read-model` 有基线与预算。
- 高频页面刷新、缓存命中、读模型重算、SQLite 查询路径有可解释成本。
- `npm run check:bundle` 通过，总 gzip 与关键 chunk 没有无解释增长。
- 后台轮询、warm-up、preload 不阻塞启动主路径。

扣分信号：

- 没有测量依据就宣称性能优化。
- 新依赖明显增加 bundle，却没有用户价值说明。
- warm-up、preload、polling 互相打架或重复工作。

### 4.5 发布链与升级可信度：1.0 分

验收点：

- `package.json`、`package-lock.json`、`Cargo.toml`、Tauri config、Git tag、Release 标题、updater artifact 版本一致。
- `CHANGELOG.md` 的 `Unreleased` 可整理为用户可读 release notes。
- `npm run release:validate-changelog -- <version>` 通过。
- `npm run release:check` 通过。
- GitHub Actions `prepare-release.yml` 与实际发布规则一致。

扣分信号：

- 版本文件不同步。
- changelog 像 commit 清单，用户读不懂。
- 发布流程依赖临时手工步骤。

### 4.6 文档与协作可持续性：1.0 分

验收点：

- 顶层 `docs/` 只保留长期有效规则。
- 阶段方案留在 `docs/working/`，完成后归档到 `docs/archive/`。
- 活跃文档不引用已删除命令或已退出目录。
- README、开发验证路径、发布路径与实际脚本一致。

扣分信号：

- 活跃文档和脚本事实不一致。
- 过时执行计划留在顶层 `docs/`。
- archive 被当成默认执行依据。

### 4.7 用户可感知稳定度：1.0 分

验收点：

- Dashboard、History、Data、Classification、Settings、About、Widget 主路径都可稳定打开和使用。
- Settings 关键行为可解释，保存、恢复、清理、外链与主题切换无明显 UI 阻塞。
- Quiet Pro 基线保持一致。
- 安装、启动、退出、托盘、窗口、更新入口符合 Windows 桌面产品预期。

扣分信号：

- 高频页面出现横向溢出、空白、加载卡死、明显错误状态。
- UI 行为与数据状态不一致。
- Widget 或 tray 行为破坏主路径信任。

---

## 5. 分数封顶规则

出现以下任一情况，即使其他项很好，总分也不能超过对应上限：

- 有已知数据损坏或恢复失败风险：最高 6 分。
- tracking 主链存在未解释的错误记录风险：最高 7 分。
- `npm run check` 不能通过：最高 7 分。
- `npm run check:full` 不能通过且无明确非阻断理由：最高 8 分。
- release / updater 版本一致性不能验证：最高 8 分。
- 架构边界明显回流但未处理：最高 8 分。
- 性能没有任何基线测量：最高 8.5 分。
- 活跃文档与实际脚本明显不一致：最高 9 分。

---

## 6. 执行总流程

推荐分 6 个阶段推进。

### 阶段 A：建立基线

目标：先知道当前仓库真实状态，不凭感觉优化。

步骤：

1. 确认工作区状态。
   - `git status --short`
   - `git diff --stat`
2. 确认当前版本与最近已发布版本。
   - 查看 `package.json`
   - 查看 `docs/versioning-and-release-policy.md`
   - 查看 GitHub Release 或远端 tag
3. 跑默认质量门槛。
   - `npm run check`
4. 跑完整质量门槛。
   - `npm run check:full`
5. 跑性能基线。
   - `npm run perf:startup-bootstrap`
   - `npm run perf:dashboard-read-model`
   - `npm run perf:history-read-model`
6. 保存基线结果到本方案的执行记录区。

产出：

- 一份当前失败项清单。
- 一份当前性能数字。
- 一份当前架构边界风险清单。
- 初始评分。

进入下一阶段条件：

- 已明确所有失败项是 blocker、risk 还是 cleanup。
- 没有把未知风险直接当成低风险。

### 阶段 B：修复阻断项

目标：先处理会影响信任、数据安全、发布链的阻断问题。

优先级：

1. 数据损坏、恢复失败、清理误删风险。
2. tracking 错记、漏记、持续串记风险。
3. 发布、updater、版本一致性风险。
4. `npm run check` / `npm run check:full` 阻断。
5. 真实浏览器 smoke 或 UI 主路径阻断。

执行规则：

- 每个问题先判断 owner，再动代码。
- 能小修就小修，不能小修就写局部执行单。
- 不把修复塞进 `app/*`、`shared/*`、`commands/*`、`lib.rs` 等高吸力层。
- 触及 Rust tracking 主链时追加 `npm run check:rust`。
- 触及发布链时追加 `npm run release:validate-changelog`。

产出：

- blocker 清零或有明确 defer 理由。
- 每个修复都有对应验证命令。

### 阶段 C：架构收口

目标：减少未来回归概率，而不是追求目录表面整齐。

检查清单：

- 前端生产入口可达图中没有死文件。
- 测试专用 helper 不留在 `src/shared`。
- `src/app/services/*` 只保留应用级薄编排。
- `src/shared/*` 只保留稳定共享能力。
- `src/platform/*` 只保留外部环境边界。
- feature 私有逻辑留在对应 `features/*`。
- Rust `commands/*` 只做 command 入口、DTO 映射和转发。
- Rust `data/*` 承接 SQL、migration、repository。
- Rust `engine/*` 承接 tracking 与 runtime 主链。
- Rust `domain/*` 承接领域语义与稳定契约。

建议执行项：

1. 建立并复跑前端导入图扫描，列出从 `src/main.tsx` 不可达的文件。
2. 对不可达文件分三类处理：
   - 真实废弃：删除。
   - 测试专用：移动到 `tests/helpers`。
   - 动态入口漏判：记录例外，不删除。
3. 对 `app/*`、`shared/*`、`platform/*` 做逐文件 owner 复核。
4. 对 Rust `commands/*`、`app/*`、`lib.rs` 做厚度复核。
5. 如果发现边界规则未覆盖的回流模式，优先扩展检查脚本，而不是只靠人记。

验证：

- `npm run check:naming`
- `npm run check:architecture`
- `npm run check:rust-boundaries`
- `npm run check`

产出：

- 架构风险清单。
- 已删除或迁移的冗余代码列表。
- 仍保留的兼容壳列表与保留理由。

### 阶段 D：性能收口

目标：让高频路径性能可测、可解释、可持续。

性能基线必须覆盖：

- 启动 bootstrap。
- Dashboard read model。
- History read model。
- 真实浏览器主界面 smoke。
- bundle gzip 总量与关键 chunk。

执行顺序：

1. 固定测试数据和测量命令。
2. 记录现状数字。
3. 只选择一个高收益路径优化。
4. 优化前后运行同一命令。
5. 如果收益小于复杂度，回退或不合入。
6. 如果引入缓存、预热或 preload，必须验证不会阻塞启动主路径。

性能改动默认禁止：

- 没有基线就改。
- 为了微小收益引入复杂全局状态。
- 在页面组件里直接塞缓存或 SQLite 细节。
- 增加 bundle 体积但没有用户可感知收益。

验证：

- `npm run perf:startup-bootstrap`
- `npm run perf:dashboard-read-model`
- `npm run perf:history-read-model`
- `npm run test:ui-browser-smoke`
- `npm run build`
- `npm run check:bundle`

产出：

- 性能前后对比表。
- 新预算或现有预算确认。
- 任何未优化热点的 defer 理由。

### 阶段 E：发布演练版本

目标：先发一个高质量 `0.x` 版本，验证整个发布链，而不是直接跳 `1.0.0`。

步骤：

1. 确认最近一个已发布版本。
   - `git log vX.Y.Z..HEAD`
   - `git diff --stat vX.Y.Z..HEAD`
2. 根据完整范围判断下一个版本号。
   - 只有小修才用 PATCH。
   - 有用户可感知变化、关键 UX 改进或发布级结构收口时用 MINOR。
   - 不把本轮目标预设为 `1.0.0`。
3. 整理 `CHANGELOG.md`。
4. 同步版本文件。
   - `npm run release:sync-version -- <version>`
5. 验证 changelog。
   - `npm run release:validate-changelog -- <version>`
6. 跑发布检查。
   - `npm run release:check`
7. 推送 release commit 与 tag。
8. 让 GitHub Actions 生成安装包、release notes 与 updater artifact。
9. 记录发布演练结果。

手工 smoke 建议：

- 新安装启动。
- 旧数据库升级启动。
- 主窗口、托盘、Widget 打开与关闭。
- Dashboard、History、Data、Classification、Settings、About 切换。
- pause / resume tracking。
- backup / restore。
- cleanup。
- updater 检查入口。

产出：

- 一个高质量 `0.x` 正式版本。
- 发布链问题清单。
- 用户可感知问题清单。
- 更新后的 readiness 评分。

### 阶段 F：v1.0.0 决策

目标：基于发布演练结果决定是否进入 `1.0.0`，而不是凭感觉宣布。

进入 `1.0.0` 候选条件：

- 发布演练版本没有出现数据安全、tracking 正确性、安装升级或恢复路径阻断问题。
- `npm run check:full` 持续稳定通过。
- 性能基线没有明显退化。
- 架构边界没有新回流。
- 活跃文档与实际脚本一致。
- 评分至少达到 9.0，且没有任何封顶项低于 9。

如果未达标：

- 继续发下一个 `0.x` 修复版本。
- 不降低门槛来迁就 `1.0.0`。
- 把未达标项按 owner 拆成下一轮小修或执行单。

如果达标：

- 新建 `v1.0.0` 准备清单。
- 重新跑完整质量门槛与发布门槛。
- 整理 `CHANGELOG.md` 中 `1.0.0` 的用户可读说明。
- 更新 `docs/versioning-and-release-policy.md` 中当前阶段描述。
- 按正式发布流程发布。

---

## 7. 具体工作清单

### 7.1 可靠性与验证清单

- [x] 跑 `npm run check:full` 并记录结果。
- [x] 跑 `npm run release:check` 并记录结果。
- [x] 复核 tracking lifecycle 测试是否覆盖 AFK、锁屏、睡眠、startup seal、watchdog seal、pause seal。
- [x] 复核 replay 测试是否覆盖 stale tracker、cleanup cutoff、startup-sealed session。
- [x] 复核 backup / restore / cleanup 测试是否覆盖失败路径。
- [x] 复核 SQLite legacy repair Rust 测试是否覆盖旧库直升。
- [x] 复核真实浏览器 smoke 是否覆盖 Dashboard、导航、Settings 弹窗、横向溢出。
- [x] 增补缺失的高风险测试。执行结论：本轮自动化覆盖已足够支撑本地 readiness，无新增高风险测试缺口。

### 7.2 架构清单

- [x] 扫描 `src` 生产入口不可达文件。
- [x] 删除真实废弃文件。
- [x] 把测试专用 helper 移到 `tests/helpers`。
- [x] 审计 `src/app/services/*` 是否仍为薄编排。
- [x] 审计 `src/shared/*` 是否都是稳定共享能力。
- [x] 审计 `src/platform/*` 是否只承接外部环境边界。
- [x] 审计 `src/features/*` 是否没有绕过 service 访问 platform。
- [x] 审计 Rust `commands/*` 是否没有 SQL、pool、厚业务流程。
- [x] 审计 Rust `platform/*` 是否没有反向依赖 data。
- [x] 审计 Rust `domain/*` 是否没有依赖 data / platform。
- [x] 扩展边界检查脚本覆盖新发现的回流模式。执行结论：本轮未发现需新增自动化规则的边界回流模式。

### 7.3 性能清单

- [x] 记录 `perf:startup-bootstrap` 基线。
- [x] 记录 `perf:dashboard-read-model` 基线。
- [x] 记录 `perf:history-read-model` 基线。
- [x] 记录 `check:bundle` 输出。
- [x] 检查 warm-up / preload 是否重复或阻塞主路径。
- [x] 检查 Dashboard / History read model 是否存在重复编译或不必要重算。
- [x] 检查 SQLite 查询是否有明显 N+1 或缺索引风险。
- [x] 只在有测量依据时做优化。
- [x] 优化后记录前后对比。执行结论：本轮未做性能代码改动，只记录通过预算的基线。

### 7.4 发布清单

- [x] 确认最近一个已发布 tag：`v0.8.0`。
- [x] 查看 `git log vX.Y.Z..HEAD`：`v0.8.0..HEAD` 无新提交，当前变化仍在工作区。
- [x] 查看 `git diff --stat vX.Y.Z..HEAD`：当前工作区相对 `v0.8.0` 为内部清理、验证脚本同步与执行文档归档。
- [x] 判断下一个 `0.x` 版本号：若将当前内部清理对外发布，建议使用 `0.8.1` patch；本轮不直接升 `1.0.0`。
- [x] 整理 `CHANGELOG.md`：已在 `Unreleased / Internal` 记录本轮内部清理。
- [x] 同步版本文件。执行结论：本轮不执行真实对外发版，版本文件保持 `0.8.0`；对外发布时再执行 `release:sync-version -- 0.8.1` 或届时确定的版本。
- [x] 跑 `npm run release:validate-changelog -- <version>`。执行结论：`npm run release:check` 内的 changelog 校验通过；未传目标版本，因为本轮未实际切正式版本节。
- [x] 跑 `npm run release:check`。
- [x] 推送 release commit 与 tag。执行结论：本轮未推送远端 tag；对外发布属于外部副作用，需要明确版本与授权后单独执行。
- [x] 确认 GitHub Actions 发布流程触发。执行结论：本轮未触发；本地 release gate 已通过。
- [x] 记录发布演练问题：无本地发布门槛阻断；残余风险是尚未执行真实远端发布、签名安装包构建与安装包 smoke。

### 7.5 文档清单

- [x] 活跃 `docs/` 不引用已删除脚本或文件。
- [x] README 的运行、验证、发布路径与实际脚本一致。
- [x] 阶段事实完成后回写到长期文档：已同步 `docs/engineering-quality.md`，移除旧 `test:startup`。
- [x] 本执行方案完成后移入 `docs/archive/`。
- [x] 不从 archive 恢复旧规则作为当前依据。

---

## 8. 发现项记录模板

每个问题按下面格式记录，避免变成口头印象。

```md
### F-001 问题标题

状态：open / doing / done / deferred

类型：reliability / architecture / performance / release / docs / ui

严重度：blocker / high / medium / low

真实 owner：

影响：

建议修复：

禁止扩散：

验证命令：

评分影响：

目标版本：
```

---

## 9. 执行记录

### 2026-05-21 初始记录

已知当前事实：

- `package.json` 当前版本为 `0.8.0`。
- 长期版本规范中记录稳定发布线仍处于 `0.6.x`。
- 默认 CI gate 是 `npm run check:full`。
- 当前阶段仍是 `0.x`，目标是先做高质量 `0.x` 发布演练，再考虑 `1.0.0`。

执行结果：

- [x] 最近已发布 tag：`v0.8.0`。
- [x] `npm run check:full` 当前结果：通过。
- [x] `npm run release:check` 当前结果：通过。
- [x] 三条性能脚本当前基线：
  - `perf:startup-bootstrap`：600 iterations，average `0.003016ms`，budget `1.5ms`，通过。
  - `perf:dashboard-read-model`：400 iterations，average `17.9679785ms`，budget `25ms`，通过。
  - `perf:history-read-model`：
    - `compile-and-timeline-reference`：250 iterations，average `69.832698ms`，budget `130ms`，通过。
    - `current-history-read-model`：250 iterations，average `69.6272008ms`，budget `170ms`，通过。
- [x] 初始 readiness 评分：`9.4 / 10`。

本轮完成的实际修复：

- 删除旧 `src/app/services/startupPrewarmService.ts` 与 `tests/startupPrewarm.test.ts`。
- 删除重复的 `src/app/services/trackingPauseSettingsPolicy.ts`。
- 删除空的 `src/features/dashboard/types.ts`。
- 将测试专用 `trackingWindowLifecycle` helper 从生产 `src/shared/lib` 移到 `tests/helpers`。
- 从 `package.json` 与 `docs/engineering-quality.md` 移除已失效的 `test:startup` 入口。
- 在 `CHANGELOG.md` 的 `Unreleased / Internal` 记录本轮内部清理。

残余风险：

- 未执行真实远端发布、tag push、GitHub Release 与 updater artifact 发布。
- 未执行签名安装包构建后的真实安装包 smoke。
- 未执行长时间运行资源占用观测。

这些风险不阻断本地工程质量归档，但阻止直接宣布 `1.0.0` 已完成发布准备。

---

## 10. 初始评分表

| 维度 | 权重 | 初始评分 | 证据 | 下一步 |
| --- | ---: | --- | --- | --- |
| 可靠性与验证 | 2.0 | 1.9 | `check:full`、tracking lifecycle、replay、settings/data/persistence/interaction、Rust tests 通过 | 真实安装包 smoke 前保留 0.1 分风险 |
| 架构边界 | 2.0 | 2.0 | `check:architecture`、`check:naming`、`check:rust-boundaries` 通过；生产入口不可达扫描为 `(none)` | 继续维持边界检查 |
| 代码质量与可维护性 | 1.5 | 1.5 | clippy `-D warnings` 通过；删除旧入口与重复规则；测试 helper 移出生产 shared | 继续避免测试代码污染 `src` |
| 性能与资源成本 | 1.5 | 1.4 | 三条 perf 脚本均在预算内；bundle budget 通过，总 JS gzip `299.56 KiB` | 补长时间运行资源观测 |
| 发布链与升级可信度 | 1.0 | 0.8 | `release:check` 通过；changelog 校验通过；未推 tag 或触发 Actions | 真实发布时补 `0.8.1` 版本同步与远端流程 |
| 文档与协作可持续性 | 1.0 | 1.0 | 活跃文档/脚本引用扫描无旧入口命中；`engineering-quality.md` 已同步 | 归档本方案 |
| 用户可感知稳定度 | 1.0 | 0.8 | UI SSR smoke 与真实浏览器 smoke 通过；未做安装包手工 smoke | 发布候选前补安装包 smoke |
| 总分 | 10.0 | 9.4 | 本地 readiness 接近 1.0 候选，但缺真实发布演练与安装包 smoke | 先发高质量 `0.x`，再评估 `1.0.0` |

---

## 11. 完成与归档条件

本方案完成时必须做三件事：

1. 把已形成长期规则的事实回写到对应顶层文档：
   - `docs/engineering-quality.md`
   - `docs/architecture.md`
   - `docs/versioning-and-release-policy.md`
   - 必要时更新 `docs/roadmap-and-prioritization.md`
2. 把本方案移入 `docs/archive/`。
3. 在最终发布记录中说明：
   - 实际发布版本号。
   - readiness 总分。
   - 未解决但不阻断 `1.0.0` 的残余风险。
   - 下一轮是否进入 `1.0.0` 准备。

---

## 12. 执行原则摘要

- 先可信，再整洁，再快。
- 先 owner，再实现。
- 先测量，再优化。
- 先 `0.x` 发布演练，再谈 `1.0.0`。
- 先清阻断项，再追高分。
- 不为了 10 分制造新的长期风险。
