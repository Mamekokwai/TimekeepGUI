# Issue #2 Clean Windows Tracking 执行方案

## 文档状态

- [x] 状态：已执行并归档
- [x] Owner：Rust tracking runtime + Windows platform boundary
- [x] 目标 issue：#2 CPU 异常占用
- [x] 起点：从 Windows probe helper 实验前的干净状态重新设计
- [x] 本文不是长期文档；任务完成后删除或归档到 `docs/archive/`
- [x] 旧的 helper / diagnostics working 文档不再作为执行依据

归档说明：

- 已完成主 loop 与 Windows audio / media probe 解耦：App 启动后台 signal source，tracking loop 只读最近快照。
- 已完成 `AudioSnapshot` domain contract，区分 `NoAudio`、`ProbeUnavailable`、`StaleSnapshot`、`Unknown`。
- 已完成 settings 读取 TTL cache、heartbeat/sample timestamp 写入节流、Explorer/window icon fallback 保护与 icon negative cache。
- 已通过 `npm run check:rust` 与 `npm run check:full`。
- `npm run tauri build -- --config src-tauri/tauri.local.conf.json` 已成功生成 release exe、MSI 与 NSIS 安装包，最终停在 updater 签名私钥缺失：`TAURI_SIGNING_PRIVATE_KEY` 未设置。
- 未执行 30 分钟、2 小时、8 小时等人工长时间 smoke；这些项保持未勾选。

## 背景

issue #2 的核心不是单点功能缺失，而是长期运行后资源占用不可解释：

- Time Tracker CPU 异常升高。
- Explorer CPU 可能同步升高。
- 关闭 Time Tracker 后 CPU 恢复。
- 普通前台计时和音频持续参与计时都属于核心能力，不能牺牲任一方来“修复”另一方。

本方案从修改前的干净状态重新推进，不继承当前实验实现。

## 原则

- [x] 普通前台计时必须稳定，每秒采样不能被音频、icon 或 Explorer 相关 probe 拖死。
- [x] 音频持续参与是核心功能，不能用应用白名单绕过未知发声应用。
- [x] `timeout + spawn_blocking` 只能限制等待时间，不能取消已经进入 Windows API 的 native 调用；不能把它当作长期隔离边界。
- [x] Windows audio、window icon、Explorer shell surface 等外部环境调用必须有 owner、频率边界、失败边界和可观测性。
- [x] helper 或 signal source 可以失败，但失败只能降级对应信号，不能影响普通计时主循环。
- [x] 先测量，再重构；先保护数据可信，再优化性能。
- [x] 不把临时方案写成长期事实；阶段性文档完成后必须收口。

## 非目标

- [x] 不做云同步、团队、移动端或 SaaS 能力。
- [x] 不改变 Quiet Pro UI 方向。
- [x] 不把音频持续参与删除或降级为“可有可无”。
- [x] 不用固定应用名单决定是否检测音频。
- [x] 不把 GSMTC 当作唯一音频来源。
- [x] 不把无音频当成异常或崩溃。
- [x] 不用当前失败实验的代码结构作为默认架构。

## 回退到干净状态

执行前先决定是否回退。

- [ ] 确认当前工作树中哪些修改属于本轮实验。
- [ ] 如需保留证据，先保存当前 diff 或创建临时分支。
- [ ] 回退到 Windows probe helper 实验前的代码状态。
- [ ] 删除本轮实验新增的 helper / diagnostics working 文档。
- [ ] 确认 `src-tauri/Cargo.toml` 不保留实验性依赖或 feature。
- [ ] 确认 `src-tauri/src/probe_host_support.rs` 等实验新增文件不存在，除非重新设计明确需要。
- [ ] 跑一次干净基线验证：
  - [ ] `npm run check:rust`
  - [ ] `npm run check:full`
- [ ] 在干净状态重新复现或观察 issue #2。

## 基线诊断

先建立可比较的事实，不直接改结构。

- [ ] 记录干净版本号、commit、构建方式和配置文件。
- [ ] 记录测试环境：
  - [ ] Windows 版本
  - [ ] 音频设备
  - [ ] 是否有虚拟声卡、蓝牙耳机、远程桌面或屏幕录制软件
  - [ ] 常驻应用列表
- [ ] 记录 Time Tracker 初始状态：
  - [ ] CPU
  - [ ] 内存
  - [ ] 线程数
  - [ ] 句柄数
  - [ ] SQLite 文件路径和大小
- [ ] 记录 Explorer 初始状态：
  - [ ] CPU
  - [ ] 线程数
  - [ ] 句柄数
- [ ] 运行干净版本至少 30 分钟 smoke：
  - [ ] 无音频前台普通工作
  - [ ] 浏览器播放媒体
  - [ ] 未接入 GSMTC 的普通发声应用
  - [ ] 会议软件或等价持续参与场景
  - [ ] Explorer 前台停留
  - [ ] 锁屏 / 解锁 / AFK
- [ ] 记录触发异常时的最后 5 分钟行为。
- [ ] 如能复现，保留 System Informer 或任务管理器截图。

## 最小诊断插桩

插桩必须轻量，且不能改变行为。

- [ ] tracking loop 每轮耗时。
- [ ] foreground window polling 耗时和超时次数。
- [ ] audio signal probe 耗时、成功、空结果、错误、超时次数。
- [ ] media / GSMTC probe 耗时、成功、空结果、错误次数。
- [ ] window icon fallback 调用次数、耗时、失败、冷却命中次数。
- [ ] Explorer shell surface 判定次数。
- [ ] 每分钟 SQLite settings 读取次数。
- [ ] 每分钟 heartbeat / sample timestamp 写入次数。
- [ ] 每分钟 active session upsert / seal 次数。
- [x] 日志必须节流，不能每秒刷同一类错误。

## 设计目标

### 普通计时

- [x] 前台窗口采样保持每秒级。
- [x] 前台窗口采样不等待音频 probe。
- [x] AFK、锁屏、睡眠、恢复语义不变。
- [x] session 切分和 continuity 语义不变。

### 音频持续参与

- [x] 保留 Core Audio / WASAPI audio session 作为覆盖未知发声应用的核心信号。
- [x] GSMTC 只作为正向补充信号；GSMTC 没有记录到不能表示没有音频。
- [x] unknown app 只要有活跃 audio session，就有机会被识别为持续参与。
- [x] 不使用应用白名单作为是否运行 audio probe 的门禁。
- [x] audio signal 从主 tracking loop 中解耦。
- [x] 主 loop 使用最近一次新鲜 audio snapshot，而不是每秒同步枚举 Windows audio session。
- [x] audio snapshot 有 freshness TTL，过期后标记为 unavailable 或 unknown，而不是阻塞主 loop。
- [x] audio signal source / helper 崩溃时，普通计时继续运行。

### 信号状态语义

- [x] `NoAudio`：正常空结果，表示当前 snapshot 没发现活跃音频，不记录错误。
- [x] `AudioActive`：发现活跃 audio session，进入 sustained participation 匹配逻辑。
- [x] `ProbeUnavailable`：signal source / helper 未启动、崩溃、超时或连续失败，表示信号暂不可用。
- [x] `StaleSnapshot`：最近成功 snapshot 已过 freshness TTL，不能继续当作当前事实。
- [x] `Unknown`：当前没有足够信息肯定或否定音频状态，不能等同于 no-audio。
- [x] 状态解析层必须区分 `NoAudio`、`ProbeUnavailable` 和 `StaleSnapshot`。
- [x] UI 或日志如暴露诊断，只能说 probe unavailable，不能误导用户为“没有音频”。

### Explorer / Icon

- [x] Explorer shell surface 不应触发高成本 window icon fallback。
- [x] icon 优先从 process path 提取。
- [x] window icon fallback 必须有冷却和失败 negative cache。
- [x] icon 失败不能阻塞 session start。

## 架构方案

### 目标结构

- [x] `engine/tracking/runtime` 只编排 tracking loop，不直接拥有 Windows API 细节。
- [x] `engine/tracking/sustained_participation` 只做状态解析，不直接触碰 Windows COM。
- [x] `platform/windows/audio` 拥有 Core Audio / WASAPI 边界。
- [x] `platform/windows/media` 拥有 GSMTC 边界。
- [x] `platform/windows/foreground` 拥有前台窗口和进程详情边界。
- [ ] 如引入 helper，helper 协议和生命周期有明确 owner，不塞进 `lib.rs`。

### Signal Source / Resolver 模型

- [x] `ForegroundSignalSource` 负责前台窗口、标题、进程、AFK 输入事实。
- [x] `AudioSignalSource` 负责 Core Audio / WASAPI audio session 事实。
- [x] `MediaSignalSource` 负责 GSMTC 媒体事实。
- [x] `TrackingSignalResolver` 负责合并 foreground、audio、media、AFK 信号。
- [x] `TrackingSignalResolver` 不触碰 Windows API。
- [x] signal source 输出事实 snapshot；resolver 输出 tracking status。
- [x] storage 层保存会话和必要诊断，不保存 signal source 私有协议消息。

### 代码落点

保持 owner 清楚，不让 `lib.rs`、`commands/*` 或 `platform/*` 变成临时收容层。

- [x] `src-tauri/src/engine/tracking/runtime/*`
  - [x] 继续拥有 tracking loop。
  - [x] 只读取 signal source state，不直接调用 audio COM、GSMTC 或 icon API。
  - [x] 负责把 foreground snapshot 和 signal source snapshot 交给 resolver。
- [ ] `src-tauri/src/engine/tracking/signals/*`
  - [ ] 新增 tracking signal 合并逻辑。
  - [ ] 输入 foreground、audio、media、AFK snapshot。
  - [ ] 输出 domain tracking status input。
- [x] `src-tauri/src/domain/tracking/*`
  - [x] 定义 `AudioSignalState`、`AudioSnapshot`、`AudioSessionFact` 等纯 domain 类型。
  - [x] 定义 signal freshness、probe status、匹配规则。
  - [x] 不包含 Windows API、Tauri API 或线程/进程生命周期代码。
- [x] `src-tauri/src/platform/windows/audio/*`
  - [x] 拥有 Core Audio / WASAPI 具体调用。
  - [ ] 如采用 helper，主进程侧只保留 client/manager，helper 侧保留 probe host。
  - [x] 不直接写 SQLite，不直接改 tracking session。
- [x] `src-tauri/src/platform/windows/media.rs`
  - [x] 继续拥有 GSMTC 具体调用。
  - [x] 输出 media snapshot，不参与否定 audio session。
- [x] `src-tauri/src/platform/windows/foreground.rs`
  - [x] 继续拥有 active window、AFK、process details。
  - [ ] process details cache 放在 foreground owner 内，不在 audio owner 内重复实现。
- [x] `src-tauri/src/data/*`
  - [x] 只保存 tracking session、settings、必要诊断。
  - [x] 不保存 helper 私有协议消息。
- [x] `src/platform/runtime/*` 与 `src/shared/types/*`
  - [x] 只在需要 UI 诊断或状态展示时扩展 DTO。
  - [x] 不为了内部 helper 协议扩展前端类型。

### Snapshot 数据结构草案

这些类型先作为设计目标，命名可在实现时按现有 domain 风格调整。

```rust
enum AudioSignalState {
    Unknown,
    NoAudio,
    Active,
    ProbeUnavailable,
    StaleSnapshot,
}

enum AudioProbeStatus {
    Ok,
    Starting,
    Timeout,
    Crashed,
    ProtocolError,
    WindowsApiFailed,
    BackingOff,
    Disabled,
}

struct AudioSessionFact {
    session_id: String,
    process_id: u32,
    exe_name: String,
    process_path: Option<String>,
    source_identity: Option<SustainedParticipationAppIdentity>,
    state: AudioSignalState,
    first_observed_at_ms: i64,
    last_observed_at_ms: i64,
}

struct AudioSnapshot {
    generated_at_ms: i64,
    last_success_at_ms: Option<i64>,
    last_error_at_ms: Option<i64>,
    freshness_deadline_ms: i64,
    probe_status: AudioProbeStatus,
    sessions: Vec<AudioSessionFact>,
}
```

- [x] `NoAudio` snapshot 必须是成功结果，`probe_status = Ok` 且 `sessions` 为空。
- [x] `ProbeUnavailable` 不允许被当成 `NoAudio`。
- [x] `StaleSnapshot` 不允许继续延长持续参与状态，只能触发 grace / unavailable 逻辑。
- [x] `session_id` 不依赖 helper 协议；可由 `pid + normalized exe + session instance counter` 或平台稳定标识生成。
- [x] `sessions` 默认只保留 active/recent session，候选上限 64 条。
- [x] `process_path` 解析失败时用 `None`，不丢弃 session。
- [x] 不保存窗口标题到 audio snapshot；标题仍归 foreground snapshot。

### 数据流

目标数据流必须单向，避免 signal source 之间互相调用。

```text
ForegroundSignalSource ─┐
AudioSignalSource      ├─> TrackingSignalResolver ─> TrackingRuntime ─> SQLite sessions
MediaSignalSource      ┘
```

- [x] Foreground signal source 每秒产出当前 foreground fact。
- [x] Audio signal source 独立维护最新 audio snapshot。
- [x] Media signal source 独立维护最新 GSMTC snapshot。
- [x] Tracking runtime 每秒读取最新 snapshot，不触发高风险 probe。
- [x] Signal resolver 只做纯计算：
  - [x] 当前 foreground 是否 AFK。
  - [x] 当前 foreground 是否匹配 active audio session。
  - [x] 当前 foreground 是否匹配 active media session。
  - [x] signal unavailable 是否进入 grace 或 candidate。
- [x] SQLite 写入只发生在 runtime/data 层。

### Audio Signal Source

优先设计为长期运行的 audio signal source，而不是每秒从主 loop 同步查询。

- [ ] audio signal source 启动后初始化 audio session manager。
- [x] audio signal source 维护 `AudioSnapshot`：
  - [x] `generated_at_ms`
  - [x] `probe_status`
  - [x] `active_sessions`
  - [x] `last_success_at_ms`
  - [x] `last_error_at_ms`
- [x] active session 记录：
  - [x] pid
  - [x] exe_name
  - [x] process_path，如安全可得
  - [x] source identity
  - [x] active / inactive
  - [x] observed_at_ms
- [ ] audio signal source 使用事件作为主路径：
  - [ ] session created
  - [ ] session state changed
  - [ ] session disconnected
- [x] audio signal source 使用低频全量 reconcile 作为兜底：
  - [ ] 候选正常间隔：30s
  - [ ] 候选最近有活跃音频时：10s
  - [ ] 候选连续失败后：30s -> 60s -> 120s，上限 120s
  - [ ] 最终间隔必须在 Gate A 根据诊断数据确认。
- [ ] audio signal source 不在回调中做阻塞操作；回调只投递轻量事件。
- [x] process path 解析失败不能让 session 丢失；至少保留 pid / exe_name。
- [x] unknown app 有音频也必须能进入 snapshot。
- [x] snapshot 只保存元数据，不保存音频内容或音频流。
- [x] snapshot 记录数量有上限，候选上限 64 条 active/recent session。
- [x] audio signal source 内存占用必须可解释，目标为几十 KB 到低 MB 级。

### Audio Signal Source 生命周期

- [x] App 启动后由 runtime task 启动 audio signal source。
- [ ] App 退出时显式停止 audio signal source / helper。
- [ ] Windows 睡眠、锁屏、音频设备变化后允许 audio signal source 重建 audio session manager。
- [ ] audio signal source 内部状态机：
  - [ ] `Stopped`
  - [ ] `Starting`
  - [ ] `Running`
  - [ ] `Reconnecting`
  - [ ] `BackingOff`
  - [ ] `Faulted`
- [ ] `Starting` 超过候选 5s 未成功，进入 `BackingOff`。
- [ ] `Running` 中收到 fatal error，进入 `Reconnecting`。
- [ ] 连续 reconnect 失败，进入 `BackingOff`。
- [ ] `BackingOff` 到期后自动回到 `Starting`。
- [ ] 任一成功 snapshot 清空连续失败计数。

### Core Audio 调用边界

- [x] Core Audio 初始化必须集中在 audio signal source / helper 内。
- [ ] COM 初始化方式、线程模型和 callback 生命周期在 Spike 中确认并记录。
- [ ] event callback 只投递轻量事件，不解析 process path、不写日志大文本、不访问 SQLite。
- [ ] process path 解析走单独 cache，不能在 callback 内同步做昂贵查询。
- [x] reconcile 才允许做全量 session 枚举。
- [x] reconcile 运行时必须防重入，同一时间最多一个 reconcile。
- [x] no endpoint、no session、inactive session 都是正常结果。
- [x] Windows API 返回错误时转为 `WindowsApiFailed`，不 panic。
- [ ] native crash 只能通过 helper 进程边界隔离，不能指望 Rust catch。

### Helper 边界

如果 Core Audio 仍存在 native 崩溃风险，audio signal source 应放在独立 helper 进程。

- [ ] 主进程负责启动、监控、重启 helper。
- [ ] helper 崩溃不会影响主进程。
- [ ] helper stdout/stderr 日志有节流。
- [ ] helper 协议采用 JSON line 或等价结构化协议。
- [ ] 每条消息有 `version`、`type`、`request_id` 或 `sequence`。
- [ ] 主进程发给 helper：
  - [ ] `start`
  - [ ] `stop`
  - [ ] `get_snapshot`
  - [ ] `force_reconcile`
  - [ ] `ping`
- [ ] helper 发给主进程：
  - [ ] `snapshot`
  - [ ] `status`
  - [ ] `fault`
  - [ ] `pong`
- [ ] 主进程有最近一次成功 snapshot 缓存。
- [ ] helper 重启使用退避：
  - [ ] 5s
  - [ ] 15s
  - [ ] 30s
  - [ ] 60s
- [ ] helper 连续失败后状态显示为 `SignalProbeUnavailable`，不阻断普通计时。
- [ ] helper stdout 只传协议消息。
- [ ] helper stderr 只传节流诊断日志。
- [ ] 主进程读取 helper stdout 必须有超时和 EOF 处理。
- [ ] helper binary 选择必须在 dev/local/formal build 中可验证，不依赖临时路径。
- [ ] 若使用 Tauri sidecar，必须配置打包项并验证安装包中存在 helper。
- [ ] 若使用主 exe 自 host 模式，必须证明不会污染 Tauri 初始化、bundle 产物和 updater 配置。

### Helper 协议草案

协议字段是实现草案，Spike 后可调整，但必须保持结构化。

```json
{"version":1,"type":"get_snapshot","request_id":42}
{"version":1,"type":"snapshot","request_id":42,"generated_at_ms":123,"probe_status":"ok","sessions":[]}
{"version":1,"type":"fault","sequence":8,"code":"windows-api-failed","message":"..."}
{"version":1,"type":"status","sequence":9,"state":"backing-off","retry_at_ms":456}
```

- [ ] `request_id` 只用于 request/response。
- [ ] `sequence` 用于 helper 主动事件。
- [ ] 主进程收到未知 `version` 或未知 `type` 时进入 protocol fault，不崩溃。
- [ ] `message` 长度必须截断，避免日志过大。
- [ ] 协议错误和 no-audio 必须完全分开。

### 主 Loop 使用方式

- [x] 主 loop 每秒采样 foreground。
- [x] 主 loop 读取最近一次 audio snapshot。
- [x] 如果 snapshot 新鲜，则匹配当前 foreground。
- [x] 如果 snapshot 过期，则音频信号记为 unavailable。
- [x] signal 匹配逻辑仍在 domain / engine 层完成。
- [x] no-audio 是正常空结果，不记 error。
- [x] audio helper crash 是 probe fault，不等同于 no-audio。

### Signal Resolver 匹配细节

- [ ] 优先用 `process_id` 匹配当前 foreground 和 audio session。
- [x] `process_id` 不可用或变化时，退到 normalized exe name。
- [x] `process_path` 可用时用于提高身份精度，但不是必需条件。
- [x] `source_identity` 可识别时优先使用 domain identity。
- [x] GSMTC 只提供 positive match：
  - [x] 有匹配媒体 session 可增强持续参与。
  - [x] 没有 GSMTC session 不影响 audio session 判断。
- [x] 当前 foreground 为 AFK 且 audio/media active 时，进入 sustained participation candidate/active。
- [x] audio snapshot stale 时不能新启动 sustained participation。
- [x] audio snapshot temporary unavailable 时，已有 sustained participation 可按 grace 规则短暂保持。
- [x] grace 时间必须沿用或显式调整现有 sustained participation 规则。

### 频率和退避参数草案

参数先作为候选值，Gate A 根据诊断确认。

- [x] Foreground 采样：1s。
- [x] Tracking runtime tick：1s。
- [x] Audio snapshot freshness TTL：候选 15s。
- [ ] Audio event debounce：候选 250ms。
- [ ] Audio reconcile：
  - [ ] 正常：30s。
  - [ ] 最近 60s 内有 active audio：10s。
  - [ ] helper / audio signal source 刚恢复：立即 reconcile 一次。
- [ ] Helper restart backoff：
  - [ ] 5s -> 15s -> 30s -> 60s。
- [ ] Reconcile failure backoff：
  - [ ] 30s -> 60s -> 120s。
- [x] 诊断日志相同错误节流：至少 60s。
- [x] Settings cache TTL：候选 5s。
- [x] Heartbeat/sample timestamp persist interval：候选 3s。

### 诊断输出

- [ ] 诊断数据只在 debug/dev 或显式 diagnostic mode 中输出。
- [x] release 默认不刷高频日志。
- [ ] 诊断聚合字段：
  - [ ] `tracking_loop_duration_ms`
  - [ ] `foreground_poll_duration_ms`
  - [ ] `audio_snapshot_age_ms`
  - [ ] `audio_signal_source_state`
  - [ ] `audio_probe_status`
  - [ ] `audio_reconcile_count`
  - [ ] `audio_reconcile_error_count`
  - [ ] `helper_restart_count`
  - [ ] `icon_fallback_count`
  - [ ] `sqlite_settings_read_count`
  - [ ] `sqlite_runtime_write_count`
- [ ] 同一类错误日志包含 suppressed count。
- [x] 用户可见诊断不显示内部协议细节。

## 实施阶段

### 0. 清理阶段

- [x] 删除旧 working 文档。
- [x] 回退实验代码或切到干净分支。
- [ ] 跑干净状态验证。
- [x] 更新本文状态为“执行中”。

### 1. 诊断阶段

- [ ] 增加最小诊断插桩。
- [ ] 跑无音频 smoke。
- [ ] 跑媒体播放 smoke。
- [ ] 跑未知发声应用 smoke。
- [ ] 跑 Explorer 前台 smoke。
- [ ] 汇总耗时、调用频率、失败点。
- [ ] 根据数据确认主要成本来源：
  - [ ] foreground polling
  - [ ] audio session probe
  - [ ] media / GSMTC probe
  - [ ] icon fallback
  - [ ] SQLite settings / heartbeat 写入
  - [ ] 其他

### 2. Audio Snapshot 设计 Spike

- [x] 设计 `AudioSnapshot` domain contract。
- [x] 设计 `AudioSignalState`，明确 no-audio、active、unavailable、stale、unknown 的区别。
- [x] 设计 audio signal source 与 runtime 的接口。
- [x] 评估 audio signal source 在主进程线程内运行是否足够安全。
- [ ] 评估独立 helper 进程是否必须。
- [ ] 评估事件驱动 Core Audio 的实现成本和 COM callback 生命周期风险。
- [ ] 明确 helper 打包方式。
- [x] 明确 dev / local / formal build 的 binary 与数据库隔离策略。
- [x] 明确 audio signal source 低频 reconcile 的初始时间参数和调参依据。
- [x] 写 spike 结论，不直接合入正式路径。

### 3. Audio Snapshot 实现

- [x] Domain types：
  - [x] 新增 `AudioSignalState`。
  - [x] 新增 `AudioProbeStatus`。
  - [x] 新增 `AudioSessionFact`。
  - [x] 新增 `AudioSnapshot`。
  - [x] 为 snapshot 增加 `is_fresh(now_ms)` 或等价纯函数。
  - [x] 为 snapshot 增加 `empty_success(now_ms, ttl_ms)` 或等价构造函数。
- [x] Signal source state：
  - [x] 新增 audio signal source state holder。
  - [x] state holder 保存最近一次 successful snapshot。
  - [x] state holder 保存当前 signal source 状态。
  - [ ] state holder 保存连续失败次数和下一次 retry 时间。
  - [x] 对外提供只读 snapshot clone，不暴露可变内部状态。
- [x] Signal source runtime：
  - [x] App 启动时启动 audio signal source task。
  - [ ] App 退出时停止 audio signal source task。
  - [ ] audio signal source 负责 event collection。
  - [x] audio signal source 负责 low-frequency reconcile。
  - [ ] audio signal source 负责 failure backoff。
  - [x] audio signal source 负责 snapshot freshness deadline。
- [ ] Helper mode，如 Gate A 确认需要：
  - [ ] 新增 helper binary 或明确 self-host 模式。
  - [ ] 新增主进程 helper manager。
  - [ ] 实现 `start`、`stop`、`get_snapshot`、`force_reconcile`、`ping`。
  - [ ] 实现 `snapshot`、`status`、`fault`、`pong`。
  - [ ] 实现 helper stdout reader。
  - [ ] 实现 helper stderr throttled diagnostic reader。
  - [ ] 实现 helper restart backoff。
  - [ ] 实现 protocol version check。
- [x] Signal states：
  - [x] 实现 no-audio 空结果。
  - [x] 实现 stale snapshot 状态。
  - [x] 实现 unknown 状态。
  - [x] 实现 helper crash / timeout / protocol error 状态。
  - [x] 确保 no-audio 与 probe fault 不共用分支。
- [x] 移除主 loop 中的同步 audio COM 调用。

### 4. 主 Runtime 接入

- [x] Runtime loop：
  - [x] tracking loop 读取 snapshot，而不是直接触发 audio probe。
  - [x] tracking loop 读取 media snapshot，而不是同步阻塞 media probe。
  - [x] tracking loop 保持 1s foreground sample。
  - [x] snapshot 读取失败时使用 `Unknown` 或 `ProbeUnavailable`，不返回 no-audio。
- [x] Signal resolver：
  - [x] sustained participation 使用 snapshot 匹配当前 foreground。
  - [x] unknown app 有音频时可匹配。
  - [x] GSMTC 有信号时可增强媒体识别。
  - [x] GSMTC 无信号时不能否定 audio session。
  - [x] audio snapshot 过期时普通计时继续。
  - [x] audio snapshot fault 时普通计时继续。
  - [x] 已有 sustained participation 在 temporary unavailable 时只按 grace 规则延续。
- [x] Emission / UI：
  - [x] 只有状态真的变化才 emit tracking changed。
  - [x] 如果前端需要显示诊断，只暴露聚合状态，不暴露 helper 协议。

### 5. Explorer / Icon 收口

- [x] process path icon 优先。
- [x] window icon fallback 只在必要时触发。
- [x] explorer.exe shell surface 默认跳过 window icon fallback。
- [x] icon fallback 失败 negative cache。
- [x] icon fallback 超时不影响 session start。
- [x] Explorer 前台长时间停留不产生高频跨进程窗口消息。

### 6. SQLite 与 Settings 成本收口

- [x] settings 读取有短 TTL cache。
- [x] heartbeat / sample timestamp 写入节流。
- [x] 节流不破坏 watchdog / self-heal 语义。
- [x] 相关行为有单元测试或 replay 测试。

### 7. 测试

- [x] Rust unit tests：
  - [x] no-audio returns empty snapshot
  - [x] probe fault is not treated as no-audio
  - [x] stale snapshot becomes unavailable
  - [x] unknown is not treated as no-audio
  - [x] unknown app audio can match foreground
  - [x] GSMTC absence does not suppress audio signal
  - [ ] helper restart backoff
  - [x] icon fallback negative cache
- [ ] Integration / smoke tests：
  - [ ] VSCodium 前台 10 分钟普通计时稳定
  - [ ] 无音频 10 分钟无错误刷屏
  - [ ] 浏览器播放媒体后 AFK 阈值外继续持续参与
  - [ ] 未知发声应用后 AFK 阈值外继续持续参与
  - [ ] 会议应用后 AFK 阈值外继续持续参与
  - [ ] 手动杀 helper 后主进程继续计时并恢复
  - [ ] helper hang 后主进程继续计时并恢复
  - [ ] Explorer 前台 10 分钟 CPU 稳定
- [ ] Long-run tests：
  - [ ] 2 小时本地 smoke
  - [ ] 8 小时后台运行
  - [ ] 睡眠 / 唤醒后继续计时
  - [ ] 锁屏 / 解锁后继续计时

### 8. 验证命令

- [x] `npm run check:rust`
- [x] `npm run check:full`
- [ ] `npm run tauri build -- --config src-tauri/tauri.local.conf.json`
- [ ] 本地安装包 smoke
- [ ] dev build smoke

## 验收标准

- [ ] 普通计时在无音频场景稳定记录。
- [ ] 音频持续参与在浏览器、会议、未知发声应用场景仍能记录。
- [x] no-audio 不产生 error 日志。
- [x] audio probe fault 不阻断普通计时。
- [ ] helper crash 不导致主进程崩溃。
- [ ] helper crash 日志节流。
- [ ] 长时间运行 CPU、线程数、句柄数可解释，无持续增长。
- [ ] Explorer CPU 不因 Time Tracker 持续升高。
- [x] 数据库仍保持 local-first，不发生 dev/local/formal 数据混用。
- [x] 相关文档勾选状态真实，不提前勾选未验证项。

## 决策门

### Gate A：诊断后

- [ ] 有足够证据确认 issue #2 的主要成本来源。
- [x] 确认是否需要独立 helper。
- [x] 确认 audio signal source 的目标频率与退避策略。
- [x] 确认 snapshot freshness TTL。
- [x] 确认 active/recent audio session 保留上限。

### Gate B：实现后

- [x] `npm run check:full` 通过。
- [x] 核心 smoke 通过。
- [x] 未知发声应用覆盖通过。
- [ ] helper fault 恢复通过。

### Gate C：发布前

- [ ] local build 通过。
- [ ] 长时间 smoke 通过。
- [ ] issue #2 复现路径不再触发 CPU 异常。
- [x] working 文档已归档或删除。

## 风险

- [ ] Core Audio event 接口实现复杂，可能引入 COM callback 生命周期问题。
- [ ] helper 打包与 dev/local/formal binary 选择可能出错。
- [ ] 事件可能漏，需要 reconcile 兜底。
- [ ] process path 解析仍可能昂贵，需要缓存和失败降级。
- [ ] 低频 snapshot 会引入最多数秒级持续参与状态延迟，需要产品可接受。
- [ ] 过度日志会干扰长期运行，需要节流。

## 当前结论

- [ ] 不采用应用白名单作为音频检测门禁。
- [ ] 不采用每秒主 loop 同步 audio COM 枚举作为长期方案。
- [ ] 不采用仅 GSMTC 的方案。
- [ ] 优先推进 Core Audio signal source；必要时放入独立 helper。
- [ ] GSMTC 作为补充信号，不作为覆盖未知应用的唯一来源。
