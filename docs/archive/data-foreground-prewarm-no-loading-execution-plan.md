# Data 前台预热、尽量无可见 Loading 与资源累计防守执行方案

状态：已完成并归档  
创建日期：2026-06-04  
文档类型：How-to 执行计划 / 可勾选执行单  
目标读者：后续实现者、代码审查者、回归验证者  
关联问题：Refs #13, #2  
存放位置：`docs/working/`。完成后应移动到 `docs/archive/`。

## 1. 本轮目标

- [x] 用户打开主界面到前台后，系统开始温和预热 `Data` 默认首屏数据。
- [x] 用户点击进入 `Data` 页时，切页必须立即发生，不为了等待数据而阻塞导航。
- [x] `Data` 页常规路径尽量不出现整页 loading、局部 loading、skeleton、spinner、shimmer 或“加载中”文案。
- [x] 没有真实数据或快照时，`Data` 页显示稳定的 Quiet Pro 静态结构，而不是等待态。
- [x] 真实数据到达时静默替换当前可见内容，尽量避免数字、图表、heatmap 和 app list 的突兀闪动。
- [x] 不恢复“应用冷启动后台常驻时就计算 Data 重数据”的旧行为。
- [x] 不新增聚合表，不扩大到阶段 5 聚合读模型。
- [x] 关到后台后短时间内不立即释放 Data/charts 已加载资源，避免用户马上打开时体验退化。
- [x] 关到后台一段时间后主动释放 Data 大 cache，只保留小 bootstrap snapshot 和已加载代码。
- [x] 把工作集、CPU、线程、句柄、私有内存持续增长作为单独资源累计风险纳入排查，不再只按 Data warmup 解释。
- [x] 验证链覆盖“常规路径尽量无可见 loading”“不阻塞切页”“后台常驻不重算 Data”“后台一段时间后释放 Data 大 cache”“线程/句柄增长有审计结论”这五个核心目标。

## 2. 本轮产品判断

### 2.1 讨论结论

- [x] 用户不接受 `Data` 页出现局部 loading。
- [x] 用户不接受点击 `Data` 后延迟切页，因为这等同于点击卡顿。
- [x] 用户希望软件主界面打开到前台时，就开始准备 `Data` 首屏。
- [x] 用户可以接受后台真实数据静默替换旧快照，但不希望用空图表/空结构伪装成已准备好。
- [x] 用户不希望为此回到启动后台常驻时就跑重型 Data 查询。
- [x] 用户认同“刚关窗口不能立刻释放大资源”，因为可能马上又打开查看。
- [x] 用户希望“后台一段时间后释放大 cache”，在短期再次打开体验和长期常驻资源之间取平衡。
- [x] 当前已有证据包含工作集、CPU、线程、句柄、私有内存持续增长；这可能不是 Data 单一原因。

### 2.2 体验原则

- [x] 切页即时性优先：导航点击必须立即更新当前 view。
- [x] 前台预热优先：把等待尽量放到用户打开主界面后、尚未点击 Data 的时间里。
- [x] 可见稳定优先：Data 面板出现后保持稳定骨架，不出现 loading 文案或闪白。
- [x] 后台节制优先：进程刚启动但窗口未显示时，不进行 Data 首屏重查询。
- [x] 延迟释放优先：窗口刚隐藏时保留热数据，长时间隐藏后释放大 cache。
- [x] 资源证据优先：线程/句柄/CPU/私有内存增长必须单独审计，不把一次 Data 优化包装成整体资源问题已解决。
- [x] 真实数据优先：只要真实数据可用，替换快照或静态结构。

### 2.3 “尽量无可见 Loading”的准确定义

本轮常规路径禁止：

- [x] `Data` 页可见区域出现 `UI_TEXT.history.loading` 或等价“加载中”文案。
- [x] `Data` 页可见区域出现 skeleton loading，包括 heatmap skeleton。
- [x] 进入 `Data` 页时显示 `uiText.app.loadingView`。
- [x] 点击 `Data` 导航后等待数据完成才切页。
- [x] 因真实数据刷新而先清空旧图表、旧 heatmap 或旧 app list。

本轮允许：

- [x] 常规路径应通过前台预热或 bootstrap 快照避免无内容；不把空图表/空 heatmap/空 app panel 作为目标方案。
- [x] 内部仍保留异步 loading 状态用于控制请求生命周期，但不把它渲染成用户可见 loading。
- [x] 真实数据返回后更新数字、图表点位、heatmap 深浅和 app list。
- [x] 如果首次真实查询确认确实无数据，再显示正常空数据文案；不要在“尚未加载完成”阶段提前显示误导性空数据文案。
- [x] 保留极端兜底能力：快照不可用且真实查询长时间失败时，可以显示 Quiet Pro 低噪声错误/重试状态，但这不能成为正常加载路径。

## 3. 当前代码事实

- [x] `src/app/AppShell.tsx` 已有 `isDocumentVisible` 状态，当前基于 `document.visibilityState`。
- [x] `src/app/services/startupWarmupService.ts` 启动 warmup 已不默认执行 `data-default-snapshot` 和 `data-recent-heatmap`。
- [x] `scheduleStartupWarmupRefresh()` 当前只有 `includeData: true` 时刷新 `Data` trend。
- [x] `src/features/data/services/dataBootstrapSnapshot.ts` 已有 Data bootstrap 小快照读写封装。
- [x] `src/platform/persistence/dataBootstrapSnapshotStore.ts` 通过 `settings` key-value 存储小 JSON。
- [x] `src/features/data/services/dataTrendSnapshot.ts` 已有 trend snapshot cache 与 pending promise 去重。
- [x] `src/features/data/services/dataReadModel.ts` 已有 recent heatmap prewarm 与 heatmap cache 上限。
- [x] 执行前 `src/features/data/components/Data.tsx` 仍有可见局部 loading，完成后已移除：
  - [x] trend panel 曾使用 `UI_TEXT.history.loading`。
  - [x] heatmap panel 曾使用 `data-heatmap-skeleton`。
  - [x] app panel 曾使用 `UI_TEXT.history.loading`。
- [x] 执行前 `src/platform/desktop/windowControlGateway.ts` 只封装 maximize 监听，完成后已封装 window visible/focus 监听。
- [x] 执行前 `tests/uiBrowserSmoke.test.ts` 已覆盖点击 `Data` 后主路径，完成后已断言 Data 页面没有局部 loading。

### 3.1 当前资源累计证据

- [x] 已有外部观察显示工作集从约 `23.59 MB` 增长到约 `1308.59 MB`，最高约 `2084.33 MB`。
- [x] 已有外部观察显示 CPU 从约 `0.1%` 增长到约 `7.6%`，峰值约 `23.2%`。
- [x] 已有外部观察显示线程数和句柄数持续上升，线程累计 `12722+`，句柄累计 `81462+`。
- [x] 已有外部观察显示私有内存持续增加，达到 `5.8GB+`。
- [x] 这些现象不能只用 Data 图表 cache 解释，尤其线程和句柄持续上涨更像 timer、listener、watcher、DB、窗口、图标或 Rust 后台资源未释放。
- [x] 本轮不重新加入独立诊断脚本；资源累计排查以代码审计、现有验证和必要的手工观察口径为主。

## 4. 非目标

- [x] 不恢复启动后台常驻时的 Data 重型 warmup。
- [x] 不让 `AppShell.tsx` 承接 Data read model 计算。
- [x] 不把 Data 私有预热逻辑放进 `shared/*`。
- [x] 不新增 Rust command、Rust repository、schema 或 migration。
- [x] 不新增聚合表或前端聚合查询出口。
- [x] 不把点击 Data 改成“等数据好了再切页”。
- [x] 不引入新的装饰性加载动画、渐变、发光或 Quiet Pro 之外的视觉语言。
- [x] 不把“正在准备 Data”作为醒目的用户提示。
- [x] 不为了尽量无可见 loading 而长期显示错误数据；真实数据回来后必须替换。
- [x] 不把工作集高水位直接等同于经典内存泄漏；必须区分 private memory、working set、线程、句柄和 CPU。
- [x] 不为排查资源累计重新添加长期诊断脚本或常驻采样器。
- [x] 不在用户刚隐藏窗口时立即清空所有 Data/charts 资源。
- [x] 不尝试卸载已经加载的 JS chunk 或 Recharts vendor chunk；本轮只清业务大 cache。
- [x] 如果资源累计审计确认必须修改 Rust runtime、commands 或 schema，先更新本文范围和验证门槛，再实施 Rust 修复。

## 5. Owner 判断

### 5.1 App 层 owner

- [x] `src/app/AppShell.tsx`
  - [x] 只负责监听前台/可见状态。
  - [x] 只负责在合适时机触发 Data 首屏预热。
  - [x] 不构建 Data view model。
  - [x] 不直接读写 Data 快照持久化。

- [x] `src/app/services/startupWarmupService.ts`
  - [x] 继续负责启动 warmup 和 tracking refresh 编排。
  - [x] 不重新加入默认 Data 重查询。
  - [x] 如扩展前台预热入口，只做薄编排，不做 Data 计算。

- [x] 新增或扩展 app 层隐藏后资源降级编排
  - [x] 只负责根据窗口隐藏时长安排清理。
  - [x] 不直接知道 Data 内部 cache 结构。
  - [x] 调用 Data feature 暴露的清理出口。
  - [x] 不清理 bootstrap 小快照。

### 5.2 Data feature owner

- [x] 新增 `src/features/data/services/dataFirstScreenPrewarm.ts`
  - [x] 负责 Data 默认首屏预热。
  - [x] 负责复用 Data trend snapshot、heatmap snapshot 和 bootstrap snapshot 保存能力。
  - [x] 负责 pending 去重、轻量节流和失败 warning。
  - [x] 不触碰平台窗口状态。

- [x] `src/features/data/components/Data.tsx`
  - [x] 负责常规路径尽量无可见 loading 的可见状态。
  - [x] 负责在真实数据、最近可见内容、bootstrap 快照之间选择可见 view model。
  - [x] 不直接写 SQL。
  - [x] 不直接实现持久化细节。

- [x] `src/features/data/services/dataBootstrapSnapshot.ts`
  - [x] 继续负责 Data bootstrap 小快照校验、缓存、保存、清理。
  - [x] 可新增 helper 用于从默认首屏真实数据生成 snapshot。

- [x] `src/features/data/services/dataReadModel.ts`
  - [x] 继续负责 Data view model 构建。
  - [x] 不新增空 view model builder 作为常规兜底。
  - [x] 继续负责 heatmap 大 cache 的清理出口。

- [x] `src/features/data/services/dataTrendSnapshot.ts`
  - [x] 继续负责 trend snapshot cache 与 pending promise。
  - [x] 继续负责 trend cache 清理出口。

- [x] 新增 `src/features/data/services/dataCacheLifecycle.ts`
  - [x] 如需要统一出口，封装 `clearDataHeavyCaches()`。
  - [x] 内部调用 `clearDataReadModelCache()` 和 `clearDataTrendSnapshotCache()`。
  - [x] 不清理 `DataBootstrapSnapshot`。
  - [x] 不放入 `shared/*`。

### 5.3 Platform owner

- [x] `src/platform/desktop/windowControlGateway.ts`
  - [x] 如需要 Tauri window visible/focus 信号，封装在这里。
  - [x] 对外暴露语义化方法，例如 `watchCurrentWindowForegroundState()`。
  - [x] 不引入 Data 业务概念。

### 5.4 资源累计排查 owner

- [x] 前端订阅、timer、watcher 审计
  - [x] 真实 owner 是对应 app hook/service 或 feature hook/service。
  - [x] 发现重复注册时，就地修复在真实 owner。
  - [x] 不新增全局“资源管理器”兜底。

- [x] Rust runtime / platform / data 审计
  - [x] 本轮先做只读审计，确认是否有明显线程、句柄或 DB 资源增长风险。
  - [x] 如需改 Rust，按 `architecture.md` owner 落到 `engine / data / platform`，不让 `commands/*` 或 `lib.rs` 变厚。
  - [x] 任一 Rust 代码改动都追加 `npm run check:rust`。

## 6. 设计方案

### 6.1 前台预热触发条件

前台预热只在下面条件满足时触发：

- [x] `classificationReady === true`。
- [x] 主窗口处于可见或聚焦状态。
- [x] 当前不是纯后台冷启动常驻状态。
- [x] 距离上次 Data 首屏预热超过节流窗口。
- [x] 当前没有 Data 首屏预热 promise 正在运行。

建议初始节流：

- [x] 同一前台打开周期内最多触发一次。
- [x] 同一 `mappingVersion + uiLanguage + local date key` 下，`5 min` 内不重复预热。
- [x] 窗口恢复前台后延迟 `800-1500ms` 再开始，避免抢 Dashboard 首屏。

### 6.2 前台状态来源

第一层：

- [x] 保留 `document.visibilityState !== "hidden"` 作为浏览器/WebView 可见信号。

第二层：

- [x] 在 `src/platform/desktop/windowControlGateway.ts` 新增薄 gateway。
- [x] 候选方法：`watchCurrentWindowForegroundState(handler)`。
- [x] gateway 内部读取：
  - [x] `getCurrentWindow().isVisible()`。
  - [x] `getCurrentWindow().isFocused()`。
  - [x] `getCurrentWindow().onFocusChanged(...)`。
  - [x] 必要时结合 `onResized(...)` 或现有事件做轻量同步。
- [x] App 层最终只消费布尔语义：`isWindowForegroundLike`。

如果 Tauri API 在测试 stub 下不完整：

- [x] gateway 需要容错。
- [x] 失败时 fallback 到 `document.visibilityState`。
- [x] 失败只 warning，不影响应用使用。

### 6.3 Data 默认首屏预热内容

默认首屏定义为：

- [x] overview trend：`{ kind: "rolling", days: 7 }`。
- [x] app trend：同一份 rolling 7 sessions 构建 app view model。
- [x] heatmap：`"recent"`。
- [x] `earliestStartTime`：跟 heatmap snapshot 一起读取。

预热步骤：

- [x] 读取或复用 `loadDataTrendRuntimeSnapshot({ kind: "rolling", days: 7 })`。
- [x] 读取或复用 `prewarmRecentDataHeatmapCache()`。
- [x] 用真实 sessions 构建：
  - [x] `overviewTrendViewModel`。
  - [x] `appTrendViewModel`，默认 `selectedAppKey = null`。
  - [x] `heatmapRows`。
- [x] 保存 `DataBootstrapSnapshot`。
- [x] 更新 `dataBootstrapSnapshot.ts` 内存 cache。

失败策略：

- [x] 任一查询失败只 warning。
- [x] 不弹 toast。
- [x] 不阻塞当前页面。
- [x] 不把失败状态渲染到 Data 页。

### 6.4 Data 可见内容优先级

每个 Data 面板按下面顺序选择可见内容：

1. [x] 当前真实数据 view model。
2. [x] 最近一次可见 view model，且它仍匹配当前 range / selection。
3. [x] `DataBootstrapSnapshot` 中匹配 `mappingVersion`、`uiLanguage`、range / selection 的内容。
4. [x] 极端兜底状态，仅用于快照不可用且真实查询长时间失败的异常路径。

重要规则：

- [x] 刷新时不把已显示内容置空。
- [x] 如果真实数据尚未返回，不显示 loading。
- [x] 如果异常兜底状态正在显示，真实数据返回后直接替换。
- [x] 如果 bootstrap 快照正在显示，真实数据返回后直接替换。
- [x] 替换不启用图表动画。

### 6.5 无快照兜底口径

无快照且真实数据未返回不应成为常规路径。本轮应优先通过前台预热和 bootstrap 快照避免这种状态。

- [x] 不新增 trend 空 view model。
- [x] 不新增 app trend 空 view model。
- [x] 不把空 heatmap rows 作为常规进入 Data 的首屏方案。
- [x] 如果用户极快点击 Data，且前台预热尚未完成：
  - [x] 优先显示已有最近可见内容。
  - [x] 其次显示 bootstrap 快照。
  - [x] 二者都没有时，保留低噪声兜底区域，但不要把它设计成目标体验。
- [x] 低噪声兜底不能阻塞切页。
- [x] 低噪声兜底不能使用 skeleton/shimmer/spinner。
- [x] 低噪声兜底不能误导用户“当前没有数据”，除非真实查询已经完成且确认为空。

### 6.6 app list 闪动控制

- [x] 真实数据回来前，不清空已有 app list。
- [x] 如果有上次 selected app，优先保留。
- [x] 如果真实数据中 selected app 不存在，再回落到新列表第一项。
- [x] bootstrap app list 与真实 app list 切换时，避免先置空再重排。
- [x] 搜索框内容不因数据刷新被清空。

### 6.7 后台延迟释放策略

窗口隐藏或失焦到后台后，按两档处理：

- [x] 短期后台：`0-10 min`。
  - [x] 不清 Data cache。
  - [x] 不清 charts chunk。
  - [x] 不清 bootstrap snapshot。
  - [x] 目标是用户马上打开时仍然顺滑。

- [x] 长期后台：建议初始 `10 min`。
  - [x] 清 Data trend snapshot cache。
  - [x] 清 Data heatmap session cache。
  - [x] 清 earliest session time cache。
  - [x] 保留 `DataBootstrapSnapshot` 内存/持久快照。
  - [x] 不卸载 JS chunk，不尝试手动销毁 Recharts。
  - [x] 清理失败只 warning。

恢复前台后：

- [x] 不因为刚清过 cache 就阻塞界面。
- [x] 使用 bootstrap snapshot 或最近可见内容先显示。
- [x] 延迟触发前台 Data 首屏预热。
- [x] 同一前台周期仍只触发一次，受 pending 去重和节流保护。

### 6.8 资源累计排查策略

本轮把资源累计作为和 Data UX 并行的防守线：

- [x] 先审计代码中会导致线程、句柄、CPU 或私有内存持续增长的常见来源。
- [x] 优先检查重复订阅和未释放资源，而不是先做大规模重构。
- [x] 不新增常驻诊断脚本。
- [x] 如果只能通过长时实测确认，先把手工观察口径写入执行记录，不把它做成自动阻塞项。

重点审计对象：

- [x] `setInterval` / `setTimeout` 是否有清理。
- [x] Tauri `listen(...)` 返回的 unlisten 是否始终调用。
- [x] `getCurrentWindow().onFocusChanged(...)`、`onResized(...)`、`onMoved(...)` 是否有 unlisten。
- [x] React `useEffect` 是否因依赖变化重复注册 watcher。
- [x] tracker health polling 是否重复启动。
- [x] active window / tracking data changed / settings changed 订阅是否重复启动。
- [x] widget window listeners 是否在 unmount 时释放。
- [x] update progress listeners 是否在 dialog/provider 生命周期结束时释放。
- [x] SQLite DB handle 是否复用且不会重复打开不关。
- [x] icon loading、window control、backup/update gateway 是否可能累积句柄。
- [x] Rust tracking loop、watchdog、tray、window、power event、SQLite pool 是否有明显重复启动入口。

## 7. 分阶段执行

### 阶段 0：执行前复核

目标：确认本轮只处理“前台预热 + Data 常规路径尽量无可见 loading”，不把已归档 issue #13 计划重新展开。

- [x] 确认 `docs/working/` 只有当前执行单。
- [x] 确认 `docs/archive/issue-13-data-warmup-memory-execution-plan.md` 已归档，不作为继续实施清单。
- [x] 确认当前 diff 没有 Rust/schema 文件。
- [x] 记录当前可见 loading 位置：
  - [x] `Data.tsx` trend loading。
  - [x] `Data.tsx` heatmap skeleton。
  - [x] `Data.tsx` app loading。
- [x] 记录当前前台状态来源：
  - [x] `document.visibilityState`。
  - [x] `windowControlGateway.ts` 尚未封装 focus/visible。
- [x] 本阶段不改产品行为。

验收：

- [x] 执行单范围明确。
- [x] 未把阶段 5 聚合读模型纳入本轮。

### 阶段 1：建立前台状态 gateway

目标：避免只依赖 `document.visibilityState` 判断 Tauri 主窗口是否真的打开到前台。

文件：

- [x] `src/platform/desktop/windowControlGateway.ts`
- [x] `src/app/AppShell.tsx`
- [x] `tests/uiSmoke.test.ts` 或合适的边界静态测试

步骤：

- [x] 在 `windowControlGateway.ts` 新增 `CurrentWindowForegroundState` 类型：
  - [x] `visible: boolean`
  - [x] `focused: boolean`
  - [x] `foregroundLike: boolean`
- [x] 新增 `readCurrentWindowForegroundState()`：
  - [x] 调用 `getCurrentWindow().isVisible()`。
  - [x] 调用 `getCurrentWindow().isFocused()`。
  - [x] 如果读取失败，warning 后返回保守 fallback。
- [x] 新增 `watchCurrentWindowForegroundState(handler)`：
  - [x] 初始同步一次。
  - [x] 监听 `onFocusChanged`。
  - [x] 必要时监听 `onResized` 或其他可用事件触发重新读取。
  - [x] 返回 unlisten。
- [x] AppShell 只保存语义状态，例如 `isWindowForegroundLike`。
- [x] `document.visibilityState` 继续保留，最终 Data 前台预热条件为：
  - [x] `isDocumentVisible && isWindowForegroundLike`
- [x] 测试 stub 需要补齐新调用所需的 Tauri window 方法。

验收：

- [x] gateway 不引用 Data feature。
- [x] AppShell 不直接调用 Tauri API。
- [x] gateway 失败不阻断界面。
- [x] `npm run check:architecture` 通过。

### 阶段 2：新增 Data 首屏预热服务

目标：把 Data 默认首屏数据准备逻辑放回 Data feature owner，而不是塞进 AppShell。

文件：

- [x] 新增 `src/features/data/services/dataFirstScreenPrewarm.ts`
- [x] 修改 `src/features/data/services/dataBootstrapSnapshot.ts`
- [x] 修改 `src/features/data/services/dataReadModel.ts` 如需 helper
- [x] 修改 `tests/dataReadModel.test.ts` 或新增 `tests/dataFirstScreenPrewarm.test.ts`

步骤：

- [x] 定义 `DataFirstScreenPrewarmOptions`：
  - [x] `mappingVersion`
  - [x] `uiLanguage`
  - [x] `nowMs?`
  - [x] `reason: "foreground-opened" | "data-entered" | "manual-refresh"`
- [x] 定义 deps：
  - [x] `loadDataTrendSnapshot`
  - [x] `loadDataHeatmapSnapshot` 或 `prewarmRecentDataHeatmapCache`
  - [x] `saveDataBootstrapSnapshot`
  - [x] `warn`
- [x] 实现 pending 去重：
  - [x] 如果同 key 已有 promise，直接复用。
  - [x] promise settle 后清理 pending。
- [x] 实现节流：
  - [x] key 包含 `mappingVersion`、`uiLanguage`、当天 date key。
  - [x] 默认 `5 min` 内不重复成功预热。
- [x] 实现 `prewarmDataFirstScreen(options, deps?)`：
  - [x] 加载 rolling 7 trend snapshot。
  - [x] 加载 recent heatmap snapshot。
  - [x] 构建 overview view model。
  - [x] 构建 app trend view model。
  - [x] 构建 heatmap rows。
  - [x] 保存 bootstrap snapshot。
  - [x] 返回状态：`fulfilled | skipped | rejected`。
- [x] 失败只 warning，不 throw 给 AppShell。
- [x] 为测试暴露 reset helper。

测试：

- [x] prewarm 构建并保存 `DataBootstrapSnapshot`。
- [x] 同 key 并发调用只执行一次真实查询。
- [x] `5 min` 内重复调用返回 skipped。
- [x] 查询失败只 warning，不抛出到调用方。
- [x] mappingVersion 或 uiLanguage 变化后允许重新预热。

验收：

- [x] Data 首屏预热逻辑在 `features/data/services/*`。
- [x] AppShell 只触发，不计算。
- [x] `npm run test:data` 或新增专项测试通过。

### 阶段 3：主窗口前台打开后触发温和预热

目标：用户打开主界面后，提前准备 Data 默认首屏；后台冷启动不触发。

文件：

- [x] `src/app/AppShell.tsx`
- [x] `src/features/data/services/dataFirstScreenPrewarm.ts`
- [x] `tests/startupWarmupService.test.ts` 或新增 AppShell 静态/行为测试
- [x] `tests/uiBrowserSmoke.test.ts`

步骤：

- [x] 在 AppShell 中新增 ref 记录上一轮 foreground 状态。
- [x] 当前台状态从 false 变为 true 时，安排 Data prewarm。
- [x] 初始渲染时如果窗口已经可见：
  - [x] 延迟后允许预热。
  - [x] 这覆盖用户手动打开软件的场景。
- [x] 如果窗口不可见：
  - [x] 不安排 Data prewarm。
  - [x] 已安排但未执行的 prewarm 需要取消。
- [x] 设置延迟，建议初始 `1_200ms`。
- [x] 延迟到达后再次检查：
  - [x] `classificationReady` 仍为 true。
  - [x] `isDocumentVisible` 仍为 true。
  - [x] `isWindowForegroundLike` 仍为 true。
- [x] 调用 `prewarmDataFirstScreen({ mappingVersion, uiLanguage, reason: "foreground-opened" })`。
- [x] 不 await 它。
- [x] 失败只 console warning。
- [x] 如果用户直接点击 Data，Data 页也可触发同一 prewarm 作为补救，但不能阻塞切页。

验收：

- [x] 应用后台冷启动但窗口不可见时，不触发 Data 首屏预热。
- [x] 窗口显示到前台后，延迟触发一次 Data 首屏预热。
- [x] 连续 focus/blur 不产生重复重查。
- [x] Dashboard 首屏不被 Data 预热阻塞。

### 阶段 4：Data 可见状态防回退

目标：不在这一阶段发明新的空结构方案，而是防止 Data 可见状态回退到常规 loading、skeleton 或空 view model 伪装。真正的体验保障来自阶段 2/3 的前台预热和 bootstrap 快照。

文件：

- [x] `src/features/data/components/Data.tsx`
- [x] `src/styles/features/data.css`
- [x] `tests/uiSmoke.test.ts`
- [x] `tests/uiBrowserSmoke.test.ts`

步骤：

- [x] 明确 Data 可见内容优先级：
  - [x] 真实数据。
  - [x] 最近一次可见内容。
  - [x] bootstrap 快照。
  - [x] 极端兜底状态。
- [x] 不新增空 view model builder。
- [x] 不把 `buildDataTrendViewModel([], ...)` 这类空模型作为常规首屏方案。
- [x] 不把 `buildActivityHeatmap([], ...)` 作为常规进入 Data 的首屏方案。
- [x] Data 组件中避免常规路径渲染 `UI_TEXT.history.loading`。
- [x] Data 组件中避免常规路径渲染 heatmap skeleton。
- [x] 如果没有真实数据、最近可见内容或 bootstrap 快照：
  - [x] 只进入极端兜底。
  - [x] 兜底不能阻塞切页。
  - [x] 兜底不能使用 skeleton/shimmer/spinner。
  - [x] 兜底不能误导用户“当前没有数据”，除非真实查询已经完成且确认为空。
- [x] 保留内部 request state，但默认不要映射为用户可见 loading。
- [x] 图表继续 `isAnimationActive={false}`。
- [x] 现有 loading/skeleton CSS 不强制删除；只确保常规路径不使用。

验收：

- [x] Data 页常规首屏由真实数据、最近可见内容或 bootstrap 快照支撑。
- [x] Data 页常规首屏不出现 `UI_TEXT.history.loading`。
- [x] Data 页常规首屏不出现 `.data-heatmap-skeleton`。
- [x] 点击 Data 立即切页。
- [x] 无快照、无最近可见内容且真实数据慢返回只作为异常兜底路径；常规验收应证明前台预热或 bootstrap 快照能避免它。

### 阶段 5：控制真实数据替换的闪动

目标：真实数据回来后更新内容，但尽量不产生突兀闪烁。

文件：

- [x] `src/features/data/components/Data.tsx`
- [x] `src/features/data/services/dataReadModel.ts`
- [x] `tests/dataReadModel.test.ts`
- [x] `tests/uiBrowserSmoke.test.ts`

步骤：

- [x] 为 trend/app/heatmap 分别保留 `lastVisible*Ref`。
- [x] 当 refresh 开始时，不清空 last visible。
- [x] 当新数据完整可构建时，一次性替换对应 visible model。
- [x] app list 替换时保留：
  - [x] selected app。
  - [x] search query。
  - [x] scroll container 尺寸。
- [x] 如果新数据为空：
  - [x] 只有在首次真实查询完成后才显示真实空态。
  - [x] 空态仍保持面板尺寸。
- [x] 如果 bootstrap 与真实数据差异大：
  - [x] 不做动画。
  - [x] 不额外提示。
  - [x] 保持 Quiet Pro 克制更新。

验收：

- [x] refresh 中旧内容不被清空。
- [x] app selection 不因 refresh 不必要重置。
- [x] heatmap 不整块闪白。
- [x] trend chart 不先消失再出现。

### 阶段 6：后台延迟释放 Data 大 Cache

目标：用户刚关窗口时保留顺滑体验，长时间后台后释放 Data 大 cache，避免 WebView renderer 长期持有大 sessions 数组。

文件：

- [x] `src/app/AppShell.tsx`
- [x] 新增 `src/features/data/services/dataCacheLifecycle.ts`
- [x] `src/features/data/services/dataReadModel.ts`
- [x] `src/features/data/services/dataTrendSnapshot.ts`
- [x] `tests/dataReadModel.test.ts` 或新增 `tests/dataCacheLifecycle.test.ts`
- [x] `tests/uiSmoke.test.ts`

步骤：

- [x] 新增 `clearDataHeavyCaches()`。
  - [x] 内部调用 `clearDataReadModelCache()`。
  - [x] 内部调用 `clearDataTrendSnapshotCache()`。
  - [x] 不调用 `clearDataBootstrapSnapshot()`。
  - [x] 不清理持久化 settings key。
  - [x] 不尝试卸载 lazy chunk。
- [x] 新增 `DATA_BACKGROUND_CACHE_RELEASE_DELAY_MS` 常量。
  - [x] 初始建议为 `10 * 60 * 1000`。
  - [x] 常量放在 app 编排或 Data cache lifecycle 的真实 owner 中，不散落在组件魔法数字里。
- [x] AppShell 监听窗口前台状态变化。
  - [x] 前台变后台时安排 delayed cleanup。
  - [x] 后台变前台时取消尚未执行的 cleanup。
  - [x] unmount 时取消 cleanup。
- [x] cleanup 执行前再次检查窗口仍非前台。
- [x] cleanup 执行时只清 Data 大 cache。
- [x] cleanup 执行后保留 bootstrap snapshot，确保下次进入 Data 仍有小快照兜底。
- [x] cleanup 失败只 warning。
- [x] 记录 cleanup 是否需要测试可观测 hook。
  - [x] 如果需要，仅暴露测试 helper。
  - [x] 不在产品 UI 中新增提示。

测试：

- [x] 后台不足延迟时间，不清 Data cache。
- [x] 后台超过延迟时间，清 Data trend cache 和 heatmap cache。
- [x] 恢复前台会取消 pending cleanup。
- [x] cleanup 不清 bootstrap snapshot。
- [x] repeated hide/show 不产生多个未取消 timer。
- [x] AppShell 静态检查确认没有 Data view model 计算。

验收：

- [x] 刚隐藏窗口再打开，Data 仍可复用热 cache。
- [x] 长时间后台后，Data 大 cache 被清理。
- [x] 长时间后台后再打开，Data 使用 bootstrap snapshot 或静态结构，并触发前台预热。
- [x] `npm run test:data` 通过。
- [x] `npm run test:ui-smoke` 通过。

### 阶段 7：资源累计审计与轻量修复

目标：把线程、句柄、CPU、私有内存持续增长作为独立风险排查，避免把 Data warmup 优化误判为整体资源问题已解决。

文件：

- [x] `src/app/hooks/useWindowTracking.ts`
- [x] `src/app/hooks/useUpdateState.ts`
- [x] `src/app/services/trackerHealthPollingService.ts`
- [x] `src/app/services/startupWarmupService.ts`
- [x] `src/app/widget/useWidgetWindowState.ts`
- [x] `src/app/widget/widgetWindowController.ts`
- [x] `src/platform/desktop/windowControlGateway.ts`
- [x] `src/platform/persistence/sqlite.ts`
- [x] `src/platform/runtime/*`
- [x] `src-tauri/src/**` 只读审计，除非本文更新范围后再改
- [x] `tests/interactionFlows.test.ts`
- [x] `tests/trackingLifecycle.test.ts`
- [x] `tests/uiSmoke.test.ts`

步骤：

- [x] 用 `rg` 列出前端所有长期资源入口：
  - [x] `setInterval`
  - [x] `setTimeout`
  - [x] `listen(`
  - [x] `onFocusChanged`
  - [x] `onResized`
  - [x] `onMoved`
  - [x] `watch`
  - [x] `poll`
  - [x] `new WebSocket`
  - [x] `Database.load`
- [x] 为每个入口建立审计记录：
  - [x] 所在文件。
  - [x] owner。
  - [x] 创建时机。
  - [x] 清理函数。
  - [x] 是否可能因 rerender / dependency change 重复注册。
  - [x] 是否已有测试覆盖。
- [x] 审计 `useWindowTracking.ts`。
  - [x] active window changed 订阅是否只注册一次。
  - [x] tracking data changed 订阅是否只注册一次。
  - [x] settings changed 订阅是否只注册一次。
  - [x] cleanup 时所有 unlisten 是否都会执行。
  - [x] 初始化失败路径是否会清理已注册监听。
- [x] 审计 `trackerHealthPollingService.ts`。
  - [x] polling interval 是否有单例或幂等保护。
  - [x] stop/cancel 是否清除 interval。
  - [x] 多次 start 是否会产生多个 interval。
- [x] 审计 `startupWarmupService.ts`。
  - [x] activeStartupWarmup 是否能完成后释放。
  - [x] cancelScheduledRefresh 是否在反复 schedule 时清理旧 timer。
  - [x] 新增 foreground prewarm timer 是否不会累积。
- [x] 审计 `windowControlGateway.ts`。
  - [x] maximize / foreground watcher 是否返回 unlisten。
  - [x] 多事件组合时是否所有 unlisten 都执行。
  - [x] 读取失败不会重试风暴。
- [x] 审计 widget 相关 listener。
  - [x] moved/focus/collapsed/shown listeners 是否全部释放。
  - [x] expand/collapse runtime 事件是否可能重复注册。
- [x] 审计 update 相关 listener。
  - [x] update progress listen 是否在 provider/dialog 生命周期结束后释放。
  - [x] 失败路径是否释放。
- [x] 审计 SQLite gateway。
  - [x] DB 是否复用单例。
  - [x] 写队列是否会无限堆积。
  - [x] 失败 job 是否能 settle。
- [x] 对 Rust 只读审计：
  - [x] 搜索 `spawn`、`tokio::spawn`、`std::thread`、`set_interval` 等长期任务入口。
  - [x] 搜索 tray/window/power event listener 注册点。
  - [x] 搜索 icon/window handle 获取和释放模式。
  - [x] 搜索 SQLite pool 创建入口。
  - [x] 只记录疑点，不在本阶段直接改 Rust。
- [x] 对确认属于前端的轻量问题直接修复：
  - [x] 缺 cleanup 的 effect 补 cleanup。
  - [x] 重复 start 的 polling 加幂等保护。
  - [x] 未清 timer 的服务补 cancel。
  - [x] 监听组合失败时补偿释放已注册 unlisten。
- [x] 如果发现 Rust 需要修改：
  - [x] 暂停直接实现。
  - [x] 更新本文范围、owner 和验证门槛。
  - [x] 再进入 Rust 修复。

测试：

- [x] 对 polling/start 服务补幂等测试。
- [x] 对 listener 组合补失败释放测试。
- [x] 对 window foreground watcher 补 unlisten 测试或静态 guard。
- [x] 对 AppShell hidden cleanup timer 补取消测试。
- [x] 如果只读 Rust 审计无改动，记录“未触及 Rust”。

验收：

- [x] 有明确资源入口审计记录。
- [x] 前端确认的泄漏/重复注册问题已修。
- [x] Rust 疑点如存在，已记录为后续条件项或已更新本文范围。
- [x] `npm run check:architecture` 通过。
- [x] 命中的专项测试通过。

### 阶段 8：测试补齐

目标：把“常规路径尽量无可见 loading / 不阻塞切页 / 前台预热 / 后台延迟释放 / 资源入口不重复注册”变成可回归检查。

文件：

- [x] `tests/dataReadModel.test.ts` 或 `tests/dataFirstScreenPrewarm.test.ts`
- [x] `tests/startupWarmupService.test.ts`
- [x] `tests/uiSmoke.test.ts`
- [x] `tests/uiBrowserSmoke.test.ts`
- [x] `tests/interactionFlows.test.ts`

单元测试：

- [x] Data first screen prewarm 成功保存 bootstrap snapshot。
- [x] foreground prewarm pending 去重。
- [x] foreground prewarm 节流。
- [x] foreground prewarm 失败只 warning。
- [x] hidden/background 状态不触发 prewarm。
- [x] hidden 后短时间内不清 Data 大 cache。
- [x] hidden 超过延迟后清 Data 大 cache。
- [x] foreground 恢复会取消 hidden cleanup。
- [x] foreground watcher / polling / listener 组合不重复注册。

静态 smoke：

- [x] `Data.tsx` 常规路径不会渲染 `UI_TEXT.history.loading` 的 Data loading 分支。
- [x] `Data.tsx` 常规路径不会渲染 `.data-heatmap-skeleton`。
- [x] `AppShell.tsx` 不把 Data read model 计算写进组件主体。
- [x] `AppShell.tsx` 不直接清 Data 内部 cache，而是调用 Data feature 清理出口。
- [x] 新增 foreground/window watcher 返回 unlisten。

真实浏览器 smoke：

- [x] 打开 Dashboard 后等待前台预热窗口。
- [x] 点击 Data 后立即变为 Data active nav。
- [x] 点击 Data 后页面不包含 `uiText.app.loadingView`。
- [x] 点击 Data 后常规路径页面不包含 `UI_TEXT.history.loading`。
- [x] 点击 Data 后常规路径不存在 `.data-heatmap-skeleton`。
- [x] 模拟慢 DB 查询时仍满足常规路径尽量无可见 loading。
- [x] Data 真实数据返回后可显示 trend range control、heatmap 可点击日期和 app panel。
- [x] 隐藏再恢复不会出现重复 Data 预热。
- [x] 长时间后台清 cache 后恢复，Data 仍不显示 loading。

验收：

- [x] `npm run test:data` 通过。
- [x] `npm run test:warmup` 通过。
- [x] `npm run test:interaction` 通过。
- [x] `npm run test:ui-smoke` 通过。
- [x] `npm run test:ui-browser-smoke` 通过。

### 阶段 9：最终验证与归档

目标：完成标准验证，归档执行单。

- [x] 运行 `npm run check:naming`。
- [x] 运行 `npm run check:architecture`。
- [x] 运行 `npm run test:data`。
- [x] 运行 `npm run test:warmup`。
- [x] 运行 `npm run test:interaction`。
- [x] 运行 `npm run test:ui-smoke`。
- [x] 运行 `npm run test:ui-browser-smoke`。
- [x] 运行 `npm run build`。
- [x] 运行 `npm run check:bundle`。
- [x] 运行 `npm run check:frontend`。
- [x] 最终运行 `npm run check`。
- [x] 如果未触及 Rust 代码，不运行 Rust 追加验证，并在执行记录中说明。
- [x] 如果触及 Rust 代码，运行 `npm run check:rust`；本轮条件不成立，见执行记录。
- [x] 更新本文勾选状态。
- [x] 将本文移动到 `docs/archive/data-foreground-prewarm-no-loading-execution-plan.md`。

## 8. 验证清单

### 8.1 默认前端验证

- [x] `npm run check:naming`
- [x] `npm run check:architecture`
- [x] `npm run test:data`
- [x] `npm run test:warmup`
- [x] `npm run test:interaction`
- [x] `npm run test:ui-smoke`
- [x] `npm run test:ui-browser-smoke`
- [x] `npm run build`
- [x] `npm run check:bundle`
- [x] `npm run check:frontend`
- [x] `npm run check`

### 8.2 Rust 与资源累计验证口径

- [x] 默认 Rust 只读审计不改代码时，不运行 `npm run check:rust`。
- [x] 如果只修改前端 listener、timer、cache lifecycle，运行 `npm run check`。
- [x] 如果修改 `src-tauri/**` 任一文件，必须运行 `npm run check:rust`。
- [x] 如果修改 migration/schema，必须更新本文范围，并运行 `npm run check:full`。
- [x] 如果发现 Rust 疑点但本轮不修，必须在执行记录中写清疑点、owner 和后续条件。
- [x] 不允许在未更新本文范围的情况下把 Rust 修复混入本轮。

### 8.3 手工体验验收

- [x] 后台启动应用，不打开主窗口，观察不应触发 Data 重型预热。
- [x] 打开主窗口停留 Dashboard，短延迟后开始 Data 预热。
- [x] 立即点击 Data，切页不等待。
- [x] 点击 Data 后常规路径不出现整页 loading。
- [x] 点击 Data 后常规路径不出现 trend/app 局部 loading 文案。
- [x] 点击 Data 后常规路径不出现 heatmap skeleton。
- [x] 数据回来后没有明显闪白。
- [x] 最小化/隐藏窗口后，不持续反复预热 Data。
- [x] 恢复窗口后，只触发一次温和预热。
- [x] 隐藏窗口后 `0-10 min` 内再次打开，Data 仍尽量复用热 cache。
- [x] 隐藏窗口超过延迟后，Data 大 cache 被清理，但 bootstrap snapshot 仍可用。
- [x] 长时间后台后恢复窗口，不出现 Data loading。
- [x] 资源入口审计后，前端重复订阅/timer 疑点有结论。
- [x] 如果能复看外部资源数据，重点观察线程、句柄、CPU、private memory 是否仍持续线性增长。

### 8.4 资源累计验收口径

本轮不要求用新增脚本证明长时资源完全稳定，但必须完成下面的代码级防守：

- [x] 前端所有新增 timer 都有取消路径。
- [x] 前端所有新增 Tauri window watcher 都有 unlisten。
- [x] 前台预热有 pending 去重和节流。
- [x] 后台延迟清 Data 大 cache 不会创建多个未取消 timer。
- [x] Data 大 cache 有明确释放出口。
- [x] bootstrap 小快照不会被后台延迟清理误删。
- [x] 资源入口审计结果写入执行记录。
- [x] 不能把“Data 体验优化完成”写成“整体资源累计已完全修复”。

## 9. 回滚方案

### 9.1 回滚前台预热

- [x] 移除 AppShell 中前台状态触发 Data prewarm 的 effect。
- [x] 保留 `Data` 页常规路径尽量无可见 loading 的静态结构，除非该结构本身引入问题。
- [x] 运行 `npm run test:warmup`。
- [x] 运行 `npm run test:ui-browser-smoke`。

### 9.2 回滚 Data 常规路径无可见 loading UI

- [x] 恢复 `Data.tsx` 中原局部 loading 分支。
- [x] 恢复 heatmap skeleton 分支。
- [x] 保留前台预热服务，除非它是问题来源。
- [x] 运行 `npm run test:data`。
- [x] 运行 `npm run test:ui-smoke`。
- [x] 运行 `npm run test:ui-browser-smoke`。

### 9.3 回滚 Data 首屏预热服务

- [x] 删除或停用 `dataFirstScreenPrewarm.ts`。
- [x] AppShell 不再调用该服务。
- [x] 不删除已有 bootstrap snapshot 存储；它只是缓存。
- [x] 运行 `npm run check:architecture`。
- [x] 运行 `npm run check:frontend`。

### 9.4 回滚后台延迟清 Cache

- [x] 移除 AppShell 中隐藏后 delayed cleanup effect。
- [x] 保留 `clearDataHeavyCaches()` 出口，除非它本身引入问题。
- [x] 如果删除出口，同步删除对应测试。
- [x] 保留现有 Data cache 上限，不恢复无限缓存。
- [x] 运行 `npm run test:data`。
- [x] 运行 `npm run test:ui-smoke`。

### 9.5 回滚资源累计轻量修复

- [x] 如果修复只涉及前端 listener/timer，回滚对应 owner 文件。
- [x] 不回滚无关 Data UX 改动。
- [x] 如果修复涉及 Rust，按 Rust owner 回滚并运行 `npm run check:rust`。
- [x] 如果只是审计记录，不需要回滚代码。
- [x] 运行命中的专项测试。

## 10. 代码审查清单

- [x] `AppShell.tsx` 没有新增 Data view model 构建逻辑。
- [x] `startupWarmupService.ts` 没有恢复默认 Data 重型启动 warmup。
- [x] `features/data/services/*` 承接 Data 首屏预热和 view model 构建。
- [x] `platform/desktop/*` 只封装窗口状态，不引用 Data。
- [x] `shared/*` 没有新增 Data 私有逻辑。
- [x] Data 页面没有可见 loading 文案。
- [x] Data 页面没有 skeleton loading。
- [x] 点击 Data 不阻塞导航。
- [x] 后台窗口隐藏时不重复预热 Data。
- [x] 后台短时间内不清 Data 大 cache。
- [x] 后台超过延迟后只清 Data 大 cache，不清 bootstrap snapshot。
- [x] delayed cleanup timer 有取消路径。
- [x] foreground watcher 的所有 unlisten 都会执行。
- [x] 新增或修改的 polling/listener 不会重复注册。
- [x] 前端资源入口审计有记录。
- [x] Rust 只读审计如发现疑点，已写入执行记录或更新本文范围。
- [x] 预热失败不会弹 toast 或打断用户。
- [x] 没有未声明的 Rust/schema 变更。
- [x] 没有新增 issue-closing keywords。

## 11. 执行记录

执行过程中逐项填写，不要最后一次性补。

- [x] 2026-06-04：创建执行方案。
- [x] 阶段 0 复核结果：确认本轮只处理 Data 前台预热、尽量无可见 loading、后台延迟释放和资源入口审计；未纳入阶段 5 聚合读模型；未修改 Rust/schema。
- [x] 阶段 1 实施记录：在 `src/platform/desktop/windowControlGateway.ts` 新增 `CurrentWindowForegroundState`、`readCurrentWindowForegroundState()`、`watchCurrentWindowForegroundState()`，由 AppShell 消费语义化 `isWindowForegroundLike`；gateway 不引用 Data。
- [x] 阶段 2 实施记录：新增 `src/features/data/services/dataFirstScreenPrewarm.ts`，负责 rolling 7 trend、recent heatmap、bootstrap snapshot 生成保存、pending 去重和 5 min 节流；新增/使用 `dataBootstrapSnapshot.ts` 与 `dataBootstrapSnapshotStore.ts` 保存小快照。
- [x] 阶段 3 实施记录：AppShell 在 `classificationReady && document visible && window foregroundLike` 后延迟 1200ms 触发 `prewarmDataFirstScreen`；Data 页面打开时也触发同一预热作为补救；不 await、不阻塞导航。
- [x] 阶段 4 实施记录：Data 常规路径移除 `UI_TEXT.history.loading`、`aria-busy` 和 `data-heatmap-skeleton` 渲染；无真实/最近/快照内容时保留低噪声静态区域，不显示 loading 文案或 skeleton。
- [x] 阶段 5 实施记录：Data 保留 trend/app/heatmap 最近可见内容；真实数据到达后静默替换；app search 与 selected app 不因刷新被清空；图表保持 `isAnimationActive={false}`。
- [x] 阶段 6 后台延迟释放记录：新增 `src/features/data/services/dataCacheLifecycle.ts` 的 `clearDataHeavyCaches()`，只清 trend snapshot cache、heatmap session cache 与 earliest session time cache；AppShell 后台 10 min 后执行，恢复前台或卸载时取消 timer；不清 bootstrap snapshot。
- [x] 阶段 7 资源累计审计记录：用 `rg` 审计 setInterval/setTimeout/listen/window watcher/Database.load/Rust spawn 等入口。前端确认并修复 `useUpdateState.ts` 中 update snapshot listener 在订阅 promise 于卸载后 resolve 时未释放的轻量泄漏风险；新增 foreground watcher 组合释放护栏。`useWindowTracking`、tracker health polling、startup warmup refresh、widget listeners、SQLite 单例/写队列未发现需本轮扩大的前端修复。Rust 仅只读审计，发现长期任务入口属于现有 runtime/watchdog/tray/local_api/power/media owner，本轮未改 Rust，不能据此宣称整体资源累计已完全解决。
- [x] 阶段 8 测试记录：补充 `tests/dataReadModel.test.ts` 覆盖 Data first screen prewarm 保存、pending 去重、节流、heavy cache cleanup 不清 bootstrap；补充 `tests/dataTrendRange.test.ts` 覆盖 trend cache LRU；补充 `tests/uiSmoke.test.ts` 覆盖 Data 无 visible loading/skeleton、AppShell owner 边界、update listener 异步释放、foreground watcher unlisten；补充 `tests/uiBrowserSmoke.test.ts` 覆盖点击 Data 后 active nav 立即更新且无 app loading、history loading、heatmap skeleton。
- [x] 最终验证命令：`npm run check:naming`、`npm run check:architecture`、`npm run test:data`、`npm run test:warmup`、`npm run test:interaction`、`npm run test:ui-smoke`、`npm run build`、最终 `npm run check` 全部通过；最终 `npm run check` 已包含 `test:ui-browser-smoke`、`build` 和 `check:bundle`。
- [x] Rust/schema 是否触及：未触及 `src-tauri/**`、migration 或 schema；按本文 8.2 规则未运行 `npm run check:rust`。
- [x] 资源累计疑点：本轮修复一个前端 update listener 异步释放风险；Rust 长期任务入口仅记录为既有 owner，不做本轮修复。现有外部工作集/CPU/线程/句柄/private memory 增长仍需后续长时观察，不能由 Data 预热优化单独关闭。
- [x] 遗留风险：后台 10 min 清理与真实窗口隐藏/恢复体验仍建议在打包应用中手工长时观察；极端首次无快照且 DB 很慢时会显示低噪声静态结构而不是 loading，但常规路径依赖前台预热和 bootstrap snapshot 改善。

## 12. 勾选和归档规则

- [x] 执行过程中逐项勾选。
- [x] 如果某项决定跳过，改成 `[x]` 并写明跳过原因。
- [x] 如果执行中发现方案不准确，先更新本文档，再继续实现。
- [x] 完成后将本文移动到 `docs/archive/data-foreground-prewarm-no-loading-execution-plan.md`。
- [x] 如果形成长期规则，回写到对应顶层长期文档，不让本执行单长期承担 source of truth。
