# 文案模块拆分执行方案

Status: archived completed

Document type: How-to / execution plan

Target audience: 后续执行文案架构收口的维护者与代码代理

Goal: 将当前集中在 `src/shared/copy/uiText.ts` 的大体量文案拆成按领域维护的 copy 模块，同时保留统一公共入口和现有 `UI_TEXT.xxx` 调用形状，避免文案重新散落到组件中。

Created on: 2026-06-23

Completed on: 2026-06-23

Archived on: 2026-06-23

---

## 0. 执行结果

- [x] 最终公共入口为 `src/shared/copy/index.ts`；调用方统一从 `copy/index.ts` 读取公共 API。
- [x] 语言包组合层为 `src/shared/copy/bundle.ts`，文件保持薄组合职责；未承载大段文案内容。
- [x] 运行时语言状态、`getUiText`、`getUiLocale`、`getUiTextLanguage`、`setUiTextLanguage`、`UI_TEXT` Proxy 已迁入 `src/shared/copy/runtime.ts`。
- [x] `UiLanguage`、`UiText`、`WidenCopyValue` 已迁入 `src/shared/copy/types.ts`，并保留旧实现的字符串、数字、布尔、数组与函数返回值拓宽行为。
- [x] `src/shared/copy/uiText.ts` 已删除，未保留长期兼容壳。
- [x] `src/features/settings/copy/storageSettingsCopy.ts` 已删除，Storage Settings 文案已合并为 `UI_TEXT.settings.storage`。
- [x] `AboutSupportDialog.tsx` 的 `SUPPORT_DIALOG_COPY` 已迁入 `UI_TEXT.about.supportDialog`。
- [x] `History.tsx`、`HistoryHorizontalTimeline.tsx`、`HistoryTimelineLists.tsx` 的局部 copy 已迁入 `UI_TEXT.history` 与 `UI_TEXT.history.horizontalTimeline`。
- [x] 实际创建 domain 文件：`accessibilityCopy.ts`、`aboutCopy.ts`、`appCopy.ts`、`backupCopy.ts`、`categoriesCopy.ts`、`commonCopy.ts`、`dashboardCopy.ts`、`dataCopy.ts`、`dateTimeCopy.ts`、`dialogCopy.ts`、`historyCopy.ts`、`mappingCopy.ts`、`settingsCopy.ts`、`toastCopy.ts`、`toolsCopy.ts`、`updateCopy.ts`、`widgetCopy.ts`。
- [x] 保留的非 UI copy：`src/shared/classification/defaultMappings.ts` 的真实应用显示名、`src/shared/lib/windowTitleCleaner.ts` 的窗口标题清洗规则。
- [x] 静态复查确认：`uiText.ts` 与 `storageSettingsCopy.ts` 不存在；组件没有直接 import `src/shared/copy/domains/*`；仅 `bundle.ts` 直接组合 domain copy。
- [x] 验证通过：`npx tsc --noEmit`、执行单列出的专项测试、`npm run test:ui-browser-smoke`、`npm run check`、`npm run release:check`。

## 1. 背景

当前文案状态：

- [x] 大部分用户可见文案已经集中在 `src/shared/copy/uiText.ts`。
- [x] `src/shared/copy/uiText.ts` 当前约 `1571` 行，已经同时承担 copy 内容、语言包组合、类型推导、运行时语言切换和 `UI_TEXT` Proxy。
- [x] `tests/uiSmoke.test.ts` 已有中英文 key 结构一致性测试。
- [x] 仍有少量 feature-local copy：
  - [x] `src/features/settings/copy/storageSettingsCopy.ts`
  - [x] `src/features/about/components/AboutSupportDialog.tsx` 内的 `SUPPORT_DIALOG_COPY`
  - [x] `src/features/history/components/History.tsx` 内的 `getHistoryFeatureCopy`
  - [x] `src/features/history/components/HistoryHorizontalTimeline.tsx` 内的 `getTimelineCopy`
  - [x] `src/features/history/components/HistoryTimelineLists.tsx` 内的 `"无标题网页"` fallback
- [x] 仍有少量非 UI copy 中文字符串，应保留在原 owner：
  - [x] `src/shared/classification/defaultMappings.ts` 的真实应用显示名
  - [x] `src/shared/lib/windowTitleCleaner.ts` 的窗口标题清洗规则

本计划要解决的问题不是“把文案分散回 feature”，而是把 `shared/copy` 做成一个集中 owner：公共入口集中，内容按领域拆分。

---

## 2. 目标

### 2.1 架构目标

- [x] 所有普通 UI copy 的 source of truth 位于 `src/shared/copy/`。
- [x] 组件、service、hook 继续通过统一入口读取文案，不直接 import domain copy 文件。
- [x] `UI_TEXT.history.title`、`UI_TEXT.settings.save` 等现有调用形状保持不变。
- [x] `COPY["zh-CN"]` 与 `COPY["en-US"]` 的 key 结构继续完全一致。
- [x] `uiText.ts` 从巨型内容文件被安全退役；最终公共入口是 `src/shared/copy/index.ts`。
- [x] 每个 domain copy 文件只承载一个稳定领域，避免出现新的巨型 copy 文件。

### 2.2 可维护性目标

- [x] 修改某个页面文案时，维护者能在 1 分钟内找到对应 domain copy 文件。
- [x] 新增文案时，维护者不需要打开 1500+ 行文件定位插入位置。
- [x] 中英文文案在同一个 domain 文件中相邻维护，降低漏翻译和 key 漂移风险。
- [x] 新增 feature-local copy 前必须先判断是否应进入 `src/shared/copy/domains/*`。

### 2.3 非目标

- [x] 不重写现有文案措辞，除非迁移时发现明显错别字或 key 错位。
- [x] 不改变语言切换行为。
- [x] 不改变 UI 布局、样式、Quiet Pro token 或交互流程。
- [x] 不引入第三方 i18n 框架。
- [x] 不把真实应用名映射、窗口标题清洗规则、测试 fixture 强行迁入 UI copy。

---

## 3. 目标目录结构

建议落地结构如下：

```text
src/shared/copy/
  index.ts
  bundle.ts
  runtime.ts
  types.ts

  domains/
    accessibilityCopy.ts
    aboutCopy.ts
    appCopy.ts
    backupCopy.ts
    categoriesCopy.ts
    commonCopy.ts
    dashboardCopy.ts
    dataCopy.ts
    dateTimeCopy.ts
    dialogCopy.ts
    historyCopy.ts
    mappingCopy.ts
    settingsCopy.ts
    toastCopy.ts
    toolsCopy.ts
    updateCopy.ts
    widgetCopy.ts
```

职责说明：

- [x] `index.ts` 是唯一公共入口，导出 `UI_TEXT`、`COPY`、`getUiText`、`getUiLocale`、`setUiTextLanguage` 等公共 API。
- [x] `bundle.ts` 负责组合各 domain copy 为完整 `COPY`，不承载大段文案内容。
- [x] `uiText.ts` 不属于最终目标架构；如执行中需要兼容 shim，只能短暂存在于迁移过程，并必须在本轮完成前删除。
- [x] `runtime.ts` 承载 active language、`UI_TEXT` Proxy、语言切换函数。
- [x] `types.ts` 承载 `UiLanguage`、`UiText`、copy value widening helper、domain 定义 helper。
- [x] `domains/*Copy.ts` 只承载对应领域的中英文文案对象。
- [x] domain 文件内部同时保留 `zh-CN` 与 `en-US`，不按语言拆文件。

---

## 4. 设计约束

### 4.1 公共入口约束

- [x] 组件不得直接 import `src/shared/copy/domains/*`。
- [x] 组件只从 `src/shared/copy` import 公共 copy API。
- [x] `src/shared/copy/uiText.ts` 不作为长期兼容入口；迁移期若短暂保留，最终验收前必须清零所有引用并删除该文件。
- [x] `COPY` 的结构仍是：

```ts
COPY["zh-CN"].history.title
COPY["en-US"].history.title
```

- [x] `UI_TEXT` 仍按 active language 代理读取：

```ts
UI_TEXT.history.title
```

### 4.2 类型约束

- [x] `UiText` 仍由中文基准 copy 推导，避免手写 interface 漂移。
- [x] 函数型 copy 保持参数签名不变。
- [x] 数组型 copy 保持只读结构或兼容现有调用方式。
- [x] English copy 必须满足 `UiText`，不能漏 key。

### 4.3 文案 owner 约束

- [x] 页面级 UI 文案进入对应 domain，例如 History 文案进入 `historyCopy.ts`。
- [x] 跨页面通用按钮和状态进入 `commonCopy.ts` 或 `dialogCopy.ts`。
- [x] aria-label 优先进入 `accessibilityCopy.ts`。
- [x] toast 文案进入 `toastCopy.ts`，不复用弹窗正文。
- [x] 真实应用名映射留在 `defaultMappings.ts`。
- [x] 解析规则、清洗规则、测试数据不进入 UI copy。

---

## 5. 阶段 0：冻结基线

目标：保证拆分前后行为和 key 结构可对比。

### 步骤

- [x] 记录当前工作区状态：
  - [x] 运行 `git status --short`。
  - [x] 确认本轮只改 copy 架构和必要测试。
- [x] 记录当前 copy 文件体量：
  - [x] `src/shared/copy/uiText.ts` 行数。
  - [x] `src/features/settings/copy/storageSettingsCopy.ts` 行数。
  - [x] 组件内 feature-local copy 位置清单。
- [x] 记录当前公共 API：
  - [x] `COPY`
  - [x] `UI_TEXT`
  - [x] `getUiText`
  - [x] `getUiLocale`
  - [x] `getUiTextLanguage`
  - [x] `setUiTextLanguage`
  - [x] `type UiText`
  - [x] `type UiLanguage`
- [x] 记录当前 import 入口：
  - [x] `rg -n "shared/copy/uiText" src tests`
  - [x] `rg -n "UI_TEXT|COPY|getUiTextLanguage|getUiLocale" src tests`
- [x] 运行当前最小基线：
  - [x] `npm run test:ui-smoke`
  - [x] `npx tsc --noEmit`

### 验收

- [x] 有拆分前行数和 import 使用基线。
- [x] key 结构一致性测试在拆分前已知通过。
- [x] 没有在基线阶段改动实现。

---

## 6. 阶段 1：建立 copy 模块骨架

目标：先建立新目录和类型/runtime 边界，不急着迁移所有文案。

### 步骤

- [x] 新增 `src/shared/copy/types.ts`。
- [x] 将以下类型或 helper 从 `uiText.ts` 移入 `types.ts`：
  - [x] `UiLanguage`
  - [x] copy value widening 类型
  - [x] `UiText` 的推导入口，或用于推导的 `CopyBundle` 类型
- [x] 新增 `src/shared/copy/runtime.ts`。
- [x] 将以下运行时逻辑从 `uiText.ts` 移入 `runtime.ts`：
  - [x] active language 状态
  - [x] `getUiText`
  - [x] `getUiLocale`
  - [x] `getUiTextLanguage`
  - [x] `setUiTextLanguage`
  - [x] `UI_TEXT` Proxy
- [x] 新增 `src/shared/copy/bundle.ts`。
- [x] 新增 `src/shared/copy/index.ts`。
- [x] 让 `index.ts` 统一导出公共 API，并从 `bundle.ts` / `runtime.ts` / `types.ts` 聚合导出。
- [x] 将所有 `src/**` 与 `tests/**` 中的 `shared/copy/uiText` import 迁移到 `shared/copy`。
- [x] 如果为了分步编译需要短暂保留 `uiText.ts`，只允许作为临时 re-export shim：

```ts
export * from "./index.ts";
```

- [x] 临时 shim 不得进入最终提交；如果循环依赖导致类型推导不稳，优先调整 `bundle.ts` / `types.ts` 边界，而不是保留 `uiText.ts`。

### 验收

- [x] 所有现有 import 已迁移到 `src/shared/copy`。
- [x] `uiText.ts` 已删除，或确认不再存在于最终 diff。
- [x] `npx tsc --noEmit` 通过。

---

## 7. 阶段 2：拆分低风险 domain

目标：先迁移结构简单、依赖少的 copy 分组，验证拆分模式。

### 建议顺序

- [x] `commonCopy.ts`
- [x] `dialogCopy.ts`
- [x] `dateTimeCopy.ts`
- [x] `categoriesCopy.ts`
- [x] `toastCopy.ts`
- [x] `appCopy.ts`
- [x] `widgetCopy.ts`

### 每个 domain 的执行步骤

- [x] 在 `src/shared/copy/domains/` 下创建对应 `*Copy.ts`。
- [x] 从 `ZH_CN_UI_TEXT` 移出对应中文分组。
- [x] 从 `EN_US_UI_TEXT` 移出对应英文覆盖分组。
- [x] 在 domain 文件中同时导出：

```ts
export const domainCopy = {
  "zh-CN": { ... },
  "en-US": { ... },
} as const;
```

- [x] 如果英文当前依赖中文 spread，迁移后仍允许 domain 内局部 spread，但不得跨 domain spread。
- [x] 在 copy bundle 组合文件中接入该 domain。
- [x] 保持最终 `COPY["zh-CN"].domainKey` 和 `COPY["en-US"].domainKey` 结构不变。
- [x] 运行：
  - [x] `npm run test:ui-smoke`
  - [x] `npx tsc --noEmit`

### 验收

- [x] 低风险 domain 已离开 `uiText.ts`。
- [x] 中英文 key 结构一致性测试通过。
- [x] `UI_TEXT.common.*`、`UI_TEXT.date.*` 等调用不变。

---

## 8. 阶段 3：拆分页面与功能 domain

目标：迁移体量较大、调用面较广的领域文案。

### 建议顺序

- [x] `dashboardCopy.ts`
- [x] `historyCopy.ts`
- [x] `dataCopy.ts`
- [x] `settingsCopy.ts`
- [x] `toolsCopy.ts`
- [x] `mappingCopy.ts`
- [x] `updateCopy.ts`
- [x] `backupCopy.ts`
- [x] `accessibilityCopy.ts`

### History 迁移细节

- [x] 将 `UI_TEXT.history` 现有内容迁入 `historyCopy.ts`。
- [x] 将 `History.tsx` 内 `getHistoryFeatureCopy` 迁入 `historyCopy.ts`。
- [x] 将 `getHistoryTimelineModeActionLabel` 相关文案迁入 `historyCopy.ts`。
- [x] 将 `HistoryHorizontalTimeline.tsx` 内 `getTimelineCopy` 迁入 `historyCopy.ts`，可放在 `horizontalTimeline` 子分组。
- [x] 将 `HistoryTimelineLists.tsx` 内 `"无标题网页"` fallback 迁入 `historyCopy.ts`。
- [x] 更新调用方使用 `UI_TEXT.history.*`。
- [x] 运行：
  - [x] `npm run test:history-timeline`
  - [x] `npm run test:ui-smoke`

### Data 迁移细节

- [x] 将 `UI_TEXT.data` 迁入 `dataCopy.ts`。
- [x] 确认 `dataReadModel.ts`、`dataTrendRange.ts` 仍只通过统一入口读取文案。
- [x] 运行：
  - [x] `npm run test:data`
  - [x] `npm run test:data-range`
  - [x] `npm run test:data-chart`

### Settings 迁移细节

- [x] 将 `UI_TEXT.settings` 迁入 `settingsCopy.ts`。
- [x] 将本机目录、数据目录、缓存目录、迁移确认、缓存清理等 Storage Settings 文案视为 Settings 页面子域，而不是独立 copy domain。
- [x] 将 `src/features/settings/copy/storageSettingsCopy.ts` 合并进 `settingsCopy.ts`，作为 `settings.storage` 子分组。
- [x] 删除 feature-local `src/features/settings/copy/storageSettingsCopy.ts`，不要新增独立 `storageSettingsCopy.ts` domain。
- [x] 将调用方从 `getStorageSettingsCopy()` 迁移到 `UI_TEXT.settings.storage.*`。
- [x] 更新 Settings 组件或 hook 只从统一 copy 入口读取文案。
- [x] 运行：
  - [x] `npm run test:settings`
  - [x] `npm run test:ui-smoke`

### About 迁移细节

- [x] 新增 `aboutCopy.ts`。
- [x] 将 `AboutSupportDialog.tsx` 内 `SUPPORT_DIALOG_COPY` 迁入 `aboutCopy.ts`。
- [x] 检查 About 页其他文案是否已经在 `UI_TEXT.about`。
- [x] 更新 `AboutSupportDialog.tsx` 使用 `UI_TEXT.about.supportDialog.*` 或等价结构。
- [x] 运行：
  - [x] `npm run test:ui-smoke`
  - [x] `npm run test:ui-browser-smoke`

### Tools / Mapping / Update / Backup 迁移细节

- [x] `toolsCopy.ts` 保持 reminder/timer/pomodoro/status 子分组清楚。
- [x] `mappingCopy.ts` 保持分类、对象模式、卡片操作、危险操作文案清楚。
- [x] `updateCopy.ts` 保持状态标题、按钮、dialog detail、fallback error 分离。
- [x] `backupCopy.ts` 保持 preview、compatibility、restore confirm 分离。
- [x] 运行命中专项：
  - [x] `npm run test:tools`
  - [x] `npm run test:classification`
  - [x] `npm run test:update`
  - [x] `npm run test:settings`

### 验收

- [x] `uiText.ts` 已退役，不再作为 copy 内容文件或公共入口存在。
- [x] 各页面文案都有明确 domain owner。
- [x] History / About / Storage Settings 的局部 copy 已收口到 `shared/copy`。
- [x] key 结构一致性测试继续通过。

---

## 9. 阶段 4：组合层瘦身与旧入口退役

目标：让公共入口稳定、薄、可读。

### 步骤

- [x] 新增或整理 copy bundle 组合逻辑，例如：

```ts
const ZH_CN_UI_TEXT = {
  common: commonCopy["zh-CN"],
  history: historyCopy["zh-CN"],
  ...
};

const EN_US_UI_TEXT: UiText = {
  common: commonCopy["en-US"],
  history: historyCopy["en-US"],
  ...
};
```

- [x] 确认 `COPY` 只在 `bundle.ts` 中组合。
- [x] 确认 `UI_TEXT` Proxy 不依赖 domain 文件细节。
- [x] 将所有代码的 copy import 入口改为：

```ts
import { UI_TEXT } from "../../../shared/copy";
```

- [x] 批量迁移旧 import：
  - [x] `src/**` 中的 `shared/copy/uiText` import 迁移到 `shared/copy`。
  - [x] `tests/**` 中的 `shared/copy/uiText` import 迁移到 `shared/copy`。
- [x] 删除 `src/shared/copy/uiText.ts`。
- [x] 确认测试 fixture、静态 smoke 读取路径和 browser smoke 常量不再依赖 `uiText.ts`。
- [x] 运行 `rg -n "shared/copy/uiText|uiText\\.ts" src tests docs/archive/copy-module-split-execution-plan.md`，仅允许本文档历史说明命中。

### 验收

- [x] `index.ts` 是唯一公共入口。
- [x] `uiText.ts` 已从最终架构中退役。
- [x] 没有组件直接 import `domains/*Copy.ts`。

---

## 10. 阶段 5：散落文案复查

目标：确认没有新的组件局部文案仓库。

### 必查命令

- [x] 查中文字符串：

```powershell
rg -n "[\p{Han}]" src -g "*.ts" -g "*.tsx"
```

- [x] 查局部 copy 对象：

```powershell
rg -n "COPY|copy =|const .*Copy|const .*COPY|get.*Copy" src -g "*.ts" -g "*.tsx"
```

- [x] 查直接 domain import：

```powershell
rg -n "shared/copy/domains" src tests
```

### 允许保留项

- [x] `src/shared/classification/defaultMappings.ts`：真实应用默认显示名。
- [x] `src/shared/lib/windowTitleCleaner.ts`：窗口标题清洗规则。
- [x] 测试 fixture 中用于模拟真实窗口、应用名、用户数据的中文。
- [x] 文档、changelog、archive 中的中文。

### 不允许保留项

- [x] 新增组件级 `SUPPORT_DIALOG_COPY` 这类局部 UI copy 仓库。
- [x] 新增页面内 `getXxxCopy()` 中英文切换函数。
- [x] 新增只存在于组件内的用户可见中文 fallback。
- [x] 新增绕过 `UI_TEXT` 的英文/中文双语对象。

### 验收

- [x] 所有 UI copy 都有 `src/shared/copy` owner。
- [x] 保留的中文字符串都有明确非 UI copy 理由。
- [x] 没有 domain copy 被组件直接 import。

---

## 11. 阶段 6：测试与验证

### 必跑验证

- [x] `npx tsc --noEmit`
- [x] `npm run test:ui-smoke`
- [x] `npm run test:settings`
- [x] `npm run test:history-timeline`
- [x] `npm run test:data`
- [x] `npm run test:data-range`
- [x] `npm run test:tools`
- [x] `npm run test:classification`
- [x] `npm run test:update`
- [x] `npm run test:widget`

### 浏览器验证

- [x] `npm run test:ui-browser-smoke`

重点确认：

- [x] 中文默认界面正常。
- [x] 英文界面仍能加载。
- [x] History 时间轴、Data 范围选择、Settings WebDAV/Storage、Tools 弹窗文案不丢失。
- [x] About sponsor dialog 文案可显示。

### 最终门禁

- [x] `npm run check`
- [x] 如本轮同时触碰 release/update/backup 文案：
  - [x] `npm run release:check`

### 验收

- [x] 所有命中文案路径测试通过。
- [x] 中英文 key 结构一致。
- [x] TypeScript 能正确推导 `UI_TEXT` 的函数型 copy。

---

## 12. 阶段 7：文档与规则回写

目标：让长期规则进入长期文档，执行单完成后归档。

### 步骤

- [x] 判断是否需要更新 `docs/engineering-quality.md`：
  - [x] 如果新增了“copy owner 必须在 `src/shared/copy`”的长期规则，则回写。
  - [x] 如果只是执行一次拆分，不改变长期规则，则不回写。
- [x] 判断是否需要更新 `docs/architecture.md`：
  - [x] 如果 `shared/copy` 的 owner 语义需要长期明确，则回写到 shared 层规则。
  - [x] 如果现有 shared 规则已经足够，则不回写。
- [x] 完成实现后将本文件移动到 `docs/archive/`。
- [x] 在归档记录中写明：
  - [x] 实际创建的 copy domain 文件。
- [x] `uiText.ts` 删除记录和 import 迁移结果。
  - [x] 保留的散落中文字符串及理由。
  - [x] 最终验证命令和结果。

### 验收

- [x] 顶层长期文档只记录长期规则，不记录一次性执行细节。
- [x] `docs/working/` 不残留已完成执行单。
- [x] 归档文档不保留悬空待办。

---

## 13. 停止条件

本次执行未触发停止条件：

- 未触发：拆分后 `UI_TEXT` 类型推导变弱，调用方失去 key 自动补全。
- 未触发：domain 文件之间出现复杂交叉 import。
- 未触发：为了拆 copy 需要改 UI 行为或布局。
- 未触发：`COPY["zh-CN"]` 与 `COPY["en-US"]` key 结构不再一致。
- 未触发：新结构导致组件需要知道语言包内部组合方式。
- 未触发：`uiText.ts` 被保留为长期兼容壳。
- 未触发：`index.ts` 或 `bundle.ts` 变成新的 1500 行巨型文件。
- 未触发：文案迁移后浏览器 smoke 出现可见文案缺失或 fallback key。


## 14. 完成标准

- [x] `src/shared/copy/uiText.ts` 已删除，不作为长期兼容入口。
- [x] `src/shared/copy/index.ts` 是唯一公共入口。
- [x] `src/shared/copy/bundle.ts` 是唯一语言包组合层。
- [x] `src/shared/copy/domains/` 承载所有普通 UI copy。
- [x] History、About、Storage Settings 的局部 copy 已迁入统一 copy owner。
- [x] 真实应用名、窗口标题清洗规则等非 UI copy 保留在原 owner，并在归档记录中说明。
- [x] 所有现有 `UI_TEXT.xxx` 调用形状保持兼容。
- [x] 中英文 key 结构一致性测试通过。
- [x] `npm run check` 通过。
- [x] 本执行方案完成后移动到 `docs/archive/`。

---

## 15. 提交状态

- [x] 本轮用户请求为执行、验证、勾选与归档；未额外创建提交或推送。
- [x] 原建议提交分组已完成其规划作用，实际变更可按 copy 架构拆分、局部文案收口、测试更新、执行单归档四类审阅。
- [x] 未在提交信息、文档或测试中使用 issue-closing keywords。
