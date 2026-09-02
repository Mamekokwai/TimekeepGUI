# Patina GUI 迁移 TODO

目标：将 `sample/patina` 作为 Timekeep 的桌面 GUI，复用 Timekeep 现有 Go Service、SQLite 数据和命令语义。每项完成后先验证，再进入下一项。

## 约束

- GUI 不直接复制或重写 Timekeep 的业务规则。
- GUI 的增删改、重置、刷新和查询结果必须与现有 CLI 行为一致。
- 破坏性操作（删除程序、重置统计、清空数据）必须有确认和明确反馈。
- Patina 暂时不展示 Timekeep 尚未支持的能力；不能用假数据填充页面。
- Windows 使用 `\\.\pipe\Timekeep`，Linux 使用 `/var/run/timekeep/timekeep.sock`；协议应保持可扩展。

## 任务

- [x] 盘点 Timekeep 的现有操作、数据模型、IPC 入口和 Patina 的 GUI/原生边界。
- [x] 为 Timekeep Service 增加稳定的请求/响应 IPC 协议，覆盖查询与写操作。
  - [x] 已完成 v1 查询：服务状态、程序列表/详情、活动会话、历史记录。
  - [x] 已完成 v1 写入：添加、更新、删除、单个/全部重置、刷新监控。
  - [x] 已补齐配置查询/更新接口（轮询间隔、WakaTime/Wakapi）；已覆盖协议入口测试，真实 Service 全量测试待 Go 工具链可用后执行。
  - 查询：服务状态、已跟踪程序、程序详情、当前活动会话、会话历史。
  - 写入：添加、更新、删除程序，重置单个/全部统计，更新配置，刷新监控。
  - 响应统一包含成功结果或结构化错误；GUI 不解析 CLI 文本输出。
- [x] 为 Patina 增加 Timekeep IPC Rust adapter，并建立 TypeScript 类型化 gateway。
- [x] 完成第一个真实面板：已跟踪程序列表 + 当前累计时长 + 添加/删除/刷新操作。
- [x] 适配程序分类与项目字段，保持空值、大小写和重复添加语义与 CLI 一致。
- [x] 适配 Dashboard：活动会话、累计时长和最近状态，接入刷新/服务不可用状态。
  - [x] Timekeep 专属面板已展示活动会话、最近历史、服务版本和离线状态。
  - [x] 主 Dashboard 已加入真实 Service 状态、追踪程序数、活跃会话数和累计时长摘要；Timekeep 面板支持刷新。
- [x] 适配 History：按程序、日期和数量查看会话历史，并保持现有排序/限制规则。
  - [x] 查询结果显示开始/结束时间与时长，查询期间有独立 loading 状态。
- [x] 适配 Settings：轮询间隔、轮询宽限、WakaTime/Wakapi 配置和服务刷新。
- [x] 为删除、重置、服务不可用、IPC 超时和部分成功补充统一错误交互。
  - [x] Gateway 将传输层错误分类为 service unavailable/timeout，GUI 区分业务失败与写入成功但刷新失败；删除和单个/全部重置均有确认。
- [x] 补充 Go IPC/命令测试、Rust adapter 测试、TypeScript gateway 测试和 GUI smoke 测试。
  - [x] TypeScript gateway 已有成功、错配、结构化错误和非法响应测试。
  - [x] Go Service 已增加基于 `net.Pipe` 的请求/响应入口、日期范围边界测试；真实平台管道测试仍待联调。
  - [x] Rust adapter 已增加 duplex stream JSON 往返测试；浏览器 GUI smoke 已通过 104 个场景。
  - [x] Go 工具链（`C:\Program Files\Go`）已可用，`events/protocol` 定向测试、`vet` 和格式检查通过。
  - [ ] Go 全量测试的依赖下载受网络影响；Cargo/Rust 尚未安装，真实原生 Tauri runtime smoke 和 Windows 管道联调待执行。
- [ ] 完成 Windows Tauri 开发运行、Go Service 联调和构建验证，更新运行说明。

## 第一阶段边界决策

Patina 现有的 Rust 数据层和完整 GUI 不能直接视为 Timekeep 的业务后端：两者的数据模型、配置项和操作范围不同。第一阶段采用窄桥接方案：Timekeep Service 继续拥有业务和数据库，Patina 只通过请求/响应 IPC 读取和修改数据。这样可以保留 CLI、Service 与 GUI 的一致行为，并为后续迁移提供可测试边界。

## 验收方式

每项任务至少同时通过对应的单元测试和一条真实开发命令；涉及 IPC、权限或 Tauri runtime 时追加真实 Windows runtime smoke。完成一项后更新本文件，再开始下一项。
