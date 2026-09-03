# WebDAV 远程备份执行方案

文档状态：已归档  
创建日期：2026-06-03  
归档日期：2026-06-03  
关联问题：[#5](https://github.com/Ceceliaee/time-tracking/issues/5)  
文档类型：How-to / 执行单  
目标读者：后续实现该功能的维护者或仓库协作者  

## 0. 归档记录

本执行单的 MVP 已按远程备份目标落地，自动化验收已完成：

- [x] WebDAV 远程备份配置、密码保存、连接测试、上传、列表、下载预览与确认恢复流程已实现。
- [x] 本地备份与本地恢复路径保持独立可用。
- [x] WebDAV 密码不写入 settings 持久化字段；仅在用户点击密码显示按钮时从系统凭据读取到配置弹窗。
- [x] Rust WebDAV HTTP 细节留在 `platform` 层，远程备份编排留在 `data` 层，command 层保持薄。
- [x] 设置页远程备份 UI 遵循 Quiet Pro，并加入 browser smoke 覆盖配置弹窗和窄屏无横向溢出。
- [x] `npm run check` 通过。
- [x] `npm run check:rust` 通过。

真实 WebDAV 服务手工验证已由用户环境完成并确认通过。第 4.2 节的自动定时备份、保留策略、多配置等项目仍是后续版本范围。

## 1. 目标

本执行单用于指导 `Time Tracker` 增加 WebDAV 作为远程备份目标。

该能力的产品定位是：

- 将现有结构化备份 zip 上传到用户自己的 WebDAV 空间。
- 从用户自己的 WebDAV 空间下载备份 zip，再复用现有预览与恢复流程。
- 保持本地数据为主，不引入完整云同步系统。

完成后，用户应能在 `Settings / 数据安全` 中完成：

- 配置 WebDAV 地址、用户名、密码和远端目录。
- 测试 WebDAV 连接。
- 上传一份当前数据备份到远端。
- 查看远端备份列表。
- 选择一份远端备份，下载、预览并确认恢复。

## 2. 非目标

以下内容不属于本执行单范围：

- 不做多端实时同步。
- 不做远端数据库。
- 不做本地与远端双写。
- 不做冲突合并。
- 不做账号体系。
- 不做团队、组织或云端 SaaS 能力。
- 不把 WebDAV 密码写入备份包。
- 不让应用启动、追踪或本地恢复依赖 WebDAV 可用性。

## 3. 关键原则

- 本地优先：本地 SQLite 和本地结构化备份仍然是数据事实来源。
- 备份包唯一：WebDAV 只传输现有 `TimeTracker-backup-*.zip` 格式，不新增另一套远端数据格式。
- 恢复复用：远端恢复必须先下载为本地 zip，再走现有 `preview_backup` 与 `restore_backup_and_refresh`。
- 密码隔离：WebDAV 密码必须走系统凭据或专门 secret 边界，不进入 settings 备份。
- 可回退：远端备份默认保留多份历史文件，不默认覆盖唯一 `backup.zip`。
- Quiet Pro：UI 保持设置页现有安静、专业、克制的信息密度。

## 4. 推荐交付切片

### 4.1 MVP

- [x] WebDAV 配置保存。
- [x] WebDAV 密码安全保存。
- [x] 测试连接。
- [x] 手动上传当前备份。
- [x] 远端备份列表。
- [x] 远端备份下载、预览、确认恢复。
- [x] 不改变现有本地备份/恢复行为。

### 4.2 暂缓到后续版本

- [ ] 自动定时远程备份。
- [ ] 保留最近 N 份并自动清理。
- [ ] 导入远端目录中未进入索引的手工备份文件。
- [ ] 多个 WebDAV 配置。
- [ ] 远端备份加密密码。

## 5. 架构落点

### 5.1 Rust owner

- [x] `src-tauri/src/domain/backup.rs`
  - 只承载远程备份相关领域类型与恢复安全语义。
  - 不放 HTTP/WebDAV 细节。

- [x] `src-tauri/src/platform/webdav.rs`
  - 承载 WebDAV 协议与 HTTP 请求细节。
  - 提供最小能力：测试连接、创建目录、上传文件、下载文件、读写索引文件。
  - 不读写 SQLite。
  - 不调用 Tauri command。

- [x] `src-tauri/src/platform/credentials.rs` 或 `src-tauri/src/platform/windows/credentials.rs`
  - 承载系统凭据读写。
  - Windows 优先使用 Windows Credential Manager。
  - 不把 secret 暴露给前端读取。

- [x] `src-tauri/src/data/remote_backup.rs`
  - 编排现有 `data::backup` 与 `platform::webdav`。
  - 负责导出本地备份、上传远端、下载远端、生成临时恢复文件。
  - 负责远端索引读写。

- [x] `src-tauri/src/commands/backup.rs`
  - 只增加薄命令入口。
  - 只做参数接收、DTO 映射、转发。

### 5.2 前端 owner

- [x] `src/platform/backup/remoteBackupRuntimeGateway.ts`
  - 承载 Tauri command 调用和 raw DTO 映射。
  - 不承载设置页 UI 状态。

- [x] `src/platform/persistence/remoteBackupSettingsStore.ts`
  - 承载 WebDAV 非 secret 配置的 settings 表读写。
  - 保存地址、用户名、远端目录、最近远程备份时间等非敏感字段。
  - 不保存密码。

- [x] `src/features/settings/services/settingsRemoteBackupActions.ts`
  - 承载设置页私有流程编排。
  - 包括保存配置、测试连接、上传、列出、下载、恢复前确认。

- [x] `src/features/settings/hooks/useRemoteBackupState.ts`
  - 承载设置页远程备份局部状态。
  - 避免继续加厚 `useSettingsPageState.ts`。

- [x] `src/features/settings/components/SettingsRemoteBackupPanel.tsx`
  - 放在 `SettingsDataSafetyPanel` 内部或同级。
  - 复用 Quiet Pro 组件原型。

## 6. 数据与协议设计

### 6.1 WebDAV 配置

建议前端业务模型：

```ts
export interface RemoteBackupConfig {
  url: string;
  username: string;
  remoteDir: string;
  passwordState: "missing" | "saved";
  lastBackupAtMs: number | null;
}
```

建议 settings 表字段：

- `webdav_backup_url`
- `webdav_backup_username`
- `webdav_backup_remote_dir`
- `webdav_backup_last_backup_at_ms`

执行步骤：

- [x] 新增 `remoteBackupSettingsStore.ts`。
- [x] 定义默认远端目录为 `/TimeTracker`。
- [x] 读取 settings rows 后规范化配置。
- [x] 保存配置时只写非 secret 字段。
- [x] 删除配置时删除非 secret 字段，并调用 Rust 删除系统凭据。
- [x] 恢复旧备份后，如果 settings 中存在 WebDAV 配置但系统凭据不存在，UI 不会复用孤儿密码，用户需要重新输入。

### 6.2 系统凭据

建议凭据 key：

```text
com.timetracker.backup.webdav.default
```

命名含义：

- `com.timetracker`：沿用应用 identifier，避免与其他软件的凭据名称冲突。
- `backup`：明确这是备份能力使用的凭据，不是通用账号。
- `webdav`：明确远端类型。
- `default`：当前只支持一组默认 WebDAV 配置，后续如支持多配置可替换为配置 id。

执行步骤：

- [x] 在 Rust 平台层新增 credential store 抽象。
- [x] Windows 实现使用 Windows Credential Manager。
- [x] `Cargo.toml` 为 `windows` 依赖补充需要的 Credential Manager feature。
- [x] 暴露保存、存在性检查、删除三种能力。
- [x] 仅为配置弹窗的用户显式显示动作暴露读取密码 command。
- [x] WebDAV 上传、下载在 Rust 内部读取密码；测试连接优先使用未落盘的本次表单密码，避免取消后残留。
- [x] 单元测试覆盖保存失败、缺失密码、删除后状态。

验收点：

- [x] 导出的备份 zip 内不能出现 WebDAV 密码。
- [x] 前端只能在用户点击密码显示按钮时通过 command 读取明文密码。
- [x] 删除 WebDAV 配置后，系统凭据同步删除。

### 6.3 远端文件布局

推荐远端目录：

```text
/TimeTracker/
  backup-index.json
  TimeTracker-backup-20260603-213000.zip
  TimeTracker-backup-20260604-092100.zip
```

不要使用单个固定 `backup.zip` 作为默认行为。
不要复用其他应用目录，例如坚果云中常见的 `/zotero` 目录。`/zotero` 通常是 Zotero WebDAV 附件同步使用的独立目录，Time Tracker 应创建自己的远端备份目录。

执行步骤：

- [x] 新增备份文件名生成函数，包含日期和时间，避免同一天多次备份互相覆盖。
- [x] 本地备份文件名同步使用日期和时间，避免同一天多次本地备份互相覆盖。
- [x] 远端上传时使用时间戳文件名。
- [x] 文件名只允许 ASCII 字母、数字、连字符、点号。
- [x] 默认远端目录使用 `/TimeTracker`，避免空格和非 ASCII 路径带来的 WebDAV 兼容风险。
- [x] 远端目录必须规范化为以 `/` 开头、不以 `/` 结尾。
- [x] 拒绝包含 `..`、反斜杠、控制字符的远端目录。

### 6.4 远端索引

使用我们自己的 `backup-index.json`，避免依赖 WebDAV `PROPFIND` XML 解析。

建议结构：

```json
{
  "version": 1,
  "product": "Time Tracker",
  "updatedAtMs": 1780493400000,
  "backups": [
    {
      "id": "20260603-213000",
      "fileName": "TimeTracker-backup-20260603-213000.zip",
      "remotePath": "/Time Tracker/backups/TimeTracker-backup-20260603-213000.zip",
      "createdAtMs": 1780493400000,
      "sizeBytes": 123456,
      "appVersion": "1.3.0",
      "backupVersion": 2,
      "schemaVersion": 15,
      "sessionCount": 240,
      "titleSampleCount": 1200,
      "settingCount": 18,
      "iconCacheCount": 32
    }
  ]
}
```

执行步骤：

- [x] 在 `domain::backup` 或 `data::remote_backup` 定义索引 DTO。
- [x] 上传前导出本地备份 zip。
- [x] 上传前读取并预览该 zip，得到 app 版本、备份版本、schema、数量等摘要。
- [x] 上传 zip 成功后读取远端 index。
- [x] 如果 index 不存在，创建新 index。
- [x] 如果 index 存在但格式不认识，保留远端文件并提示“索引不可用”，不覆盖未知 index。
- [x] 将新 entry 插入 index 顶部。
- [x] 写回 index。
- [x] 如果 zip 上传成功但 index 写回失败，提示用户备份文件已上传但列表索引更新失败。

## 7. Rust 实施步骤

### 7.1 准备模块

- [x] 新增 `src-tauri/src/platform/webdav.rs`。
- [x] 新增 `src-tauri/src/platform/credentials.rs` 或 Windows 子模块。
- [x] 新增 `src-tauri/src/data/remote_backup.rs`。
- [x] 更新 `src-tauri/src/platform/mod.rs` 导出新模块。
- [x] 更新 `src-tauri/src/data/mod.rs` 导出新模块。
- [x] 保持 Tauri 启动与命令注册层只做注册，不放业务逻辑。

### 7.2 HTTP/WebDAV 依赖选择

推荐使用手写最小 WebDAV 客户端，而不是引入完整 WebDAV SDK。

执行步骤：

- [x] 检查 Rust 依赖体积和维护状态。
- [x] 优先选择 `reqwest`，使用 `default-features = false` 和 `rustls-tls`。
- [x] 只实现需要的方法：`MKCOL`、`PUT`、`GET`、必要时 `DELETE`。
- [x] 暂不实现 `PROPFIND`。
- [x] 为所有请求设置连接、发送、接收超时。
- [x] 失败信息不要包含密码。

建议超时：

- 连接：8 秒。
- 上传：60 秒。
- 下载：60 秒。

### 7.3 WebDAV client 细节

- [x] 定义 `WebDavConfig`：`url`、`username`、`remote_dir`。
- [x] 密码只在 Rust 内部或本次测试连接调用中短暂承载，不写入 settings。
- [x] 规范化 base URL，去掉结尾 `/`。
- [x] 规范化远端路径，保留 WebDAV 路径中的空格并正确 URL encode。
- [x] `ensure_dir` 对目录分段执行 `MKCOL`。
- [x] `MKCOL` 遇到 `201 Created` 视为成功。
- [x] `MKCOL` 遇到 `405 Method Not Allowed` 或等价“已存在”结果视为成功。
- [x] `PUT` 上传 zip。
- [x] `GET` 下载 zip 或 index。
- [x] `PUT` 写回 index。
- [x] 响应错误中只显示状态码和安全摘要。

### 7.4 远程备份编排

- [x] 在 `data::remote_backup` 中新增 `upload_webdav_backup`。
- [x] 调用现有 `backup::export_backup(Some(temp_path), app.clone())` 生成临时 zip。
- [x] 调用现有 `backup::preview_backup(temp_path.clone())` 读取摘要。
- [x] 计算远端文件名。
- [x] 调用 `platform::webdav.upload_file` 上传 zip。
- [x] 读取并更新 `backup-index.json`。
- [x] 返回 `RemoteBackupUploadResult`：远端文件名、时间、大小、index 更新状态。
- [x] 上传结束后清理临时 zip，或放入受控 cache 目录并有后续清理。

### 7.5 远程备份列表

- [x] 新增 `list_webdav_backups`。
- [x] 读取 `backup-index.json`。
- [x] 校验 `product === "Time Tracker"`。
- [x] 校验 `version === 1`。
- [x] 按 `createdAtMs` 倒序返回。
- [x] 最多返回最近 50 条，避免 UI 过长。
- [x] index 缺失时返回空列表和“暂无远程备份”状态。
- [x] index 格式错误时返回明确错误，不自动覆盖。

### 7.6 远程恢复准备

- [x] 新增 `download_webdav_backup`。
- [x] 参数使用 entry id 或 remote path，但必须来自已解析 index。
- [x] 下载 zip 到 app data 下的临时目录。
- [x] 下载完成后调用现有 `preview_backup` 校验结构化备份。
- [x] 返回本地临时路径和 preview。
- [x] 前端确认后调用现有 `cmd_restore_backup`。
- [x] 恢复成功后删除临时下载文件。
- [x] 恢复失败时保留临时文件到本次会话结束，便于用户重试。

### 7.7 Tauri commands

建议新增命令：

- [x] `cmd_save_webdav_backup_secret(password: String) -> Result<(), String>`
- [x] `cmd_delete_webdav_backup_secret() -> Result<(), String>`
- [x] `cmd_has_webdav_backup_secret() -> Result<bool, String>`
- [x] `cmd_test_webdav_backup_target(config: WebDavBackupConfigDto) -> Result<WebDavTestResult, String>`
- [x] `cmd_upload_webdav_backup(config: WebDavBackupConfigDto) -> Result<RemoteBackupUploadResult, String>`
- [x] `cmd_list_webdav_backups(config: WebDavBackupConfigDto) -> Result<Vec<RemoteBackupEntryDto>, String>`
- [x] `cmd_download_webdav_backup(config: WebDavBackupConfigDto, id: String) -> Result<RemoteBackupDownloadResult, String>`

执行步骤：

- [x] 在 `commands/backup.rs` 增加命令函数。
- [x] 在命令注册入口注册命令。
- [x] commands 层不直接访问 HTTP、Credential Manager 或 SQLite。
- [x] command 参数验证错误使用清晰字符串。

## 8. 前端实施步骤

### 8.1 平台网关

- [x] 新增 `src/platform/backup/remoteBackupRuntimeGateway.ts`。
- [x] 定义 raw DTO。
- [x] 定义前端模型。
- [x] 增加 raw payload parser，拒绝字段缺失或类型错误。
- [x] 暴露 `saveWebDavBackupSecret`。
- [x] 暴露 `deleteWebDavBackupSecret`。
- [x] 暴露 `hasWebDavBackupSecret`。
- [x] 暴露 `testWebDavBackupTarget`。
- [x] 暴露 `uploadWebDavBackup`。
- [x] 暴露 `listWebDavBackups`。
- [x] 暴露 `downloadWebDavBackup`。

### 8.2 配置持久化

- [x] 新增 `src/platform/persistence/remoteBackupSettingsStore.ts`。
- [x] 通过 settings 表读写非 secret 配置。
- [x] 解析 URL 时 trim。
- [x] 解析远端目录时空值使用默认值。
- [x] `lastBackupAtMs` 解析失败时回落为 `null`。
- [x] 提供 `loadRemoteBackupConfig`。
- [x] 提供 `saveRemoteBackupConfig`。
- [x] 提供 `clearRemoteBackupConfig`。
- [x] 不把这些字段加入 `AppSettings`，除非后续确认它们属于全局 app settings 模型。

### 8.3 设置页状态

- [x] 新增 `useRemoteBackupState.ts`。
- [x] 初始加载配置和 secret 状态。
- [x] 维护 `isTesting`、`isUploading`、`isListing`、`isDownloading`、`isSavingConfig`。
- [x] 维护 `connectionStatus`：`unknown`、`ok`、`failed`。
- [x] 配置变更后将连接状态重置为 `unknown`。
- [x] 上传成功后刷新 `lastBackupAtMs`。

### 8.4 设置页流程

- [x] 远程备份流程由 `useRemoteBackupState.ts` 承载，未另拆 `settingsRemoteBackupActions.ts`。
- [x] 实现保存配置流程。
- [x] 保存配置时，如果密码输入为空且原本已有 secret，不覆盖原 secret。
- [x] 保存配置时，如果密码输入非空，调用 secret 保存 command。
- [x] 删除配置时，先确认，再清除 settings 和 secret。
- [x] 测试连接前检查 URL、用户名、密码状态、远端目录。
- [x] 上传备份前如果 secret 缺失，打开配置弹窗。
- [x] 远程恢复前先加载备份列表。
- [x] 用户选择远端备份后，再选择恢复策略，然后下载并预览。
- [x] 下载预览成功后复用现有恢复确认弹窗。
- [x] 确认后调用现有 `restoreBackup(path, restoreStrategy)`。

### 8.5 UI 组件

新增或调整：

- [x] `SettingsRemoteBackupPanel.tsx`
- [x] WebDAV 配置弹窗集成在 `SettingsRemoteBackupPanel.tsx`
- [x] 远端备份列表弹窗集成在 `SettingsRemoteBackupPanel.tsx`

配置弹窗字段：

- [x] 服务器地址。
- [x] 用户名。
- [x] 应用密码。
- [x] 远端目录固定为 `/TimeTracker`，不作为独立输入项展示。
- [x] 操作按钮：取消、测试连接、保存。

设置页显示：

- [x] 未配置：显示“配置 WebDAV”。
- [x] 已配置：显示紧凑的 WebDAV 配置行，保留测试连接、编辑、删除。
- [x] 备份和恢复入口保留在上方本地备份/恢复行；绑定 WebDAV 后通过弹窗选择本地或 WebDAV。
- [x] 恢复策略选择放在用户选定本地文件或云端备份之后。

Quiet Pro 要求：

- [x] 使用现有 `qp-panel`、`QuietSubpanel`、`QuietActionRow`。
- [x] 图标尺寸保持 14 到 16。
- [x] 不新增大面积色块。
- [x] 不新增玻璃、重模糊、发光或大渐变。
- [x] 按钮文案保持短。
- [x] 在窄屏下按钮换行但不挤压正文。

### 8.6 文案

新增中英文文案：

- [x] `settings.remoteBackupTitle`
- [x] `settings.remoteBackupHint`
- [x] `settings.webDavConfigure`
- [x] `settings.webDavEdit`
- [x] `settings.webDavServerUrl`
- [x] `settings.webDavUsername`
- [x] `settings.webDavPassword`
- [x] `settings.webDavRemoteDir`
- [x] `settings.webDavTestConnection`
- [x] `settings.webDavUploadBackup`
- [x] `settings.webDavRestoreBackup`
- [x] `settings.webDavMissingPassword`
- [x] `settings.webDavLastBackupAt`
- [x] `toast.webDavTestSuccess`
- [x] `toast.webDavTestFailed`
- [x] `toast.webDavUploadSuccess`
- [x] `toast.webDavUploadFailed`
- [x] `toast.webDavListFailed`
- [x] `toast.webDavDownloadFailed`

文案要求：

- [x] 不说“云同步”。
- [x] 使用“远程备份”或“WebDAV 备份”。
- [x] 明确“不会影响本地数据，恢复前会预览并确认”。
- [x] 错误提示不包含密码、完整认证 header 或敏感 URL query。

## 9. 测试计划

### 9.1 Rust 单元测试

- [x] 远端目录规范化。
- [x] 拒绝危险路径。
- [x] 远程备份文件名包含日期和时间。
- [x] index 新建。
- [x] index 插入后按时间倒序。
- [x] index 格式错误时不覆盖。
- [x] 缺失密码时返回明确错误。
- [x] WebDAV 错误不泄漏密码。
- [x] 下载后调用 preview 能识别不兼容备份。

### 9.2 Rust 集成或 fake client 测试

- [ ] 为 `platform::webdav` 定义 trait 或在 `data::remote_backup` 注入 fake client。
- [ ] 测试上传成功完整流程。
- [ ] 测试 zip 上传成功但 index 写回失败。
- [ ] 测试 index 缺失时列表为空。
- [ ] 测试下载后 preview 成功。
- [ ] 测试下载失败不触发 restore。

### 9.3 前端单元测试

- [x] `remoteBackupRuntimeGateway` raw parser。
- [x] `remoteBackupSettingsStore` 配置规范化。
- [x] 保存配置时空密码不覆盖已有 secret。
- [x] 删除配置时调用 secret 删除。
- [x] 上传成功后更新 `lastBackupAtMs`。
- [x] 缺失密码时上传流程打开配置路径。
- [x] 远程恢复在选择云端备份后选择策略，再下载、预览、确认、恢复。
- [x] 预览不兼容时不调用恢复。

### 9.4 UI smoke

- [x] Settings 页面可渲染远程备份区域。
- [x] 配置弹窗可打开和关闭。
- [x] 配置弹窗字段在窄屏不溢出。
- [x] 远程备份列表空状态可显示。
- [x] loading 状态不会造成布局跳动。

### 9.5 手工验证

使用坚果云或本地 WebDAV 服务验证：

- [x] 使用错误密码，测试连接失败。
- [x] 使用正确密码，测试连接成功。
- [x] 上传备份后，远端目录出现 zip 和 `backup-index.json`。
- [x] 上传两次后，列表显示两条不同备份。
- [x] 选择较早备份下载并预览。
- [x] 使用 `兼容` 策略恢复。
- [x] 使用 `覆盖` 策略恢复。
- [x] 删除 WebDAV 配置后，重新打开应用仍显示未配置。
- [x] 恢复包含 WebDAV 非 secret 设置的备份后，密码显示缺失，需要重新输入。

## 10. 验证命令

局部开发期间：

- [x] `npm run test:settings`
- [x] `npm run test:persistence`
- [x] `npm run test:ui-smoke`
- [x] `cargo test --manifest-path src-tauri/Cargo.toml --quiet`
- [x] `cargo check --manifest-path src-tauri/Cargo.toml --quiet`

交付前最低要求：

- [x] `npm run check`
- [x] `npm run check:rust`

如果本次同时改动发布说明：

- [ ] `npm run release:validate-changelog`

如果准备正式发布：

- [ ] `npm run release:check`

## 11. 失败处理与回滚

### 11.1 上传失败

- [x] 如果导出本地 zip 失败，不访问 WebDAV。
- [x] 如果 WebDAV 上传失败，保留本地数据不变。
- [x] 如果 zip 上传成功但 index 失败，提示用户远端文件已上传但列表可能不完整。
- [x] 上传失败 toast 不包含密码。

### 11.2 下载失败

- [x] 不调用恢复。
- [x] 不改变本地数据库。
- [x] 显示可重试提示。

### 11.3 预览失败

- [x] 不调用恢复。
- [x] 删除或隔离临时下载文件。
- [x] 显示“无法预览该备份”。

### 11.4 恢复失败

- [x] 继续依赖现有 restore transaction 回滚。
- [x] toast 使用现有“已自动回滚，不会破坏当前数据”口径。
- [x] 不删除远端备份。

### 11.5 配置删除

- [x] 删除 settings 中的 URL、用户名、远端目录、最近备份时间。
- [x] 删除系统凭据。
- [x] 不删除远端 WebDAV 文件。
- [x] UI 回到未配置状态。

## 12. 发布与 issue 处理

### 12.1 CHANGELOG

如果功能进入发布：

- [x] 在 `CHANGELOG.md` 的 `Unreleased / Added` 中记录 WebDAV 远程备份目标。
- [x] 文案引用 issue 时使用 `Refs #5` 或 Markdown 链接。
- [x] 不使用 `Closes`、`Fixes`、`Resolves` 等关闭关键词，除非用户明确要求关闭 issue。

建议条目：

```md
- Added WebDAV as a remote backup target, allowing users to upload and restore backup files from their own WebDAV storage. Refs #5.
```

### 12.2 GitHub issue 回复口径

建议回复：

```md
感谢建议。这个方向可以按“WebDAV 远程备份目标”处理，而不是完整云同步。

计划边界是：本地数据仍然作为主数据源，应用只把结构化备份 zip 上传到用户自己的 WebDAV 空间；恢复时先下载备份、预览兼容性，再由用户确认恢复。暂不做多端实时同步、冲突合并、账号体系或远端数据库。

后续实现会优先保证密码不进入备份包，并保留本地备份/恢复路径不变。Refs #5
```

### 12.3 文档归档

- [x] 功能实现前，本执行单保留在 `docs/working/`。
- [x] 功能完成且规则稳定后，将本执行单移入 `docs/archive/`。
- [x] 如果形成长期规则，只把长期结论回写到对应顶层文档，不把整个执行单留在顶层 `docs/`。

## 13. 最终验收清单

产品验收：

- [x] WebDAV 被呈现为远程备份，不被呈现为云同步。
- [x] 本地备份和本地恢复仍可独立使用。
- [x] 上传和下载失败不会改变本地数据库。
- [x] 恢复前必须有预览和确认。
- [x] WebDAV 配置只负责账号绑定；备份与恢复入口仍使用上方统一备份/恢复按钮。
- [x] 绑定 WebDAV 后，备份和恢复会先选择本地或 WebDAV。
- [x] 恢复策略默认兼容，且在用户选定本地文件或云端备份后再选择。

安全验收：

- [x] WebDAV 密码不进入 settings 备份。
- [x] WebDAV 密码不进入 toast、日志、错误文案。
- [x] 前端只能在配置弹窗内按显式密码显示语义读取明文密码。
- [x] 删除配置会删除系统凭据。

架构验收：

- [x] WebDAV HTTP 细节留在 Rust platform 层。
- [x] 远程备份编排留在 Rust data 层。
- [x] command 层保持薄。
- [x] 前端平台网关只做 invoke 和 DTO 映射。
- [x] 设置页只做 UI 与 feature 私有流程。
- [x] 没有新增 `src/lib/` 或 `src/types/`。
- [x] 没有让 `shared/*` 变成临时公共桶。

验证验收：

- [x] Rust 相关测试通过。
- [x] 前端相关测试通过。
- [x] `npm run check` 通过。
- [x] `npm run check:rust` 通过。
- [x] 手工 WebDAV 验证完成并记录结果。
