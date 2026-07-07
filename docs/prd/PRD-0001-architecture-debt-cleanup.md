# 架构债清理

> **Status**: In Progress | **PRD**: PRD-0001 | **Created**: 2026-07-07 | **Last updated**: 2026-07-07

## Goal

清理 `/improve-architecture`（2026-07-07）在代码扫描中发现的 9 项设计债（F-01 ~ F-09），让代码模块更"深"、类型契约更严、跨文件重复消除。这是 PRD-0000 的 Phase 3 后续工作，独立成线，不阻塞 PRD-0000 的功能性切片。

## What I already know

* 项目规模约 2700 行 TS，分层合理（content/background/popup/settings/shared），命名一致（`mp-` 前缀、camelCase）。
* 扫描发现：2 项 High、4 项 Medium、3 项 Low；无 Blocking。
* 两项 High 与 PRD-0000 #5 有交集：
  - F-02（GenerateResponse 判别联合）+ F-04（消息协议类型强制）→ 决策**合入 #5**，本 PRD 不再独立立项。
* F-09（settings/popup 模块级状态）与 #8 部分重叠 → 作为 #8 下游独立切片。
* 无 ADR 漂移（ADR 0001 在 PRD-0000 范围内，与本 PRD 无直接关联）。

## Requirements

* **F-01**：消除 `api-section.ts` 与 `helpers.ts` 的下拉组件重复实现。
* **F-03**：`mergePresets` 纯化为不修改入参的函数。
* **F-05**："防抖 + 保存 + Toast" 模式统一到 `createFilterableDropdown`（与 F-01 协同）。
* **F-06**：修正 `CONTEXT.md` 中 "Safety Prefix" 概念漂移，补充内置 Preset 术语。
* **F-07**：错误消息字符串集中到 `shared/errors`。
* **F-08**：`generateId` 从 `presets.ts` 挪到更合适的模块。
* **F-09**：settings/popup 模块级 `let settings` 封装为状态类（对齐 `ContentState` 风格）。

## Acceptance Criteria

* [ ] 模型选择字段复用通用下拉组件，行为与现版一致（过滤、防抖保存、获取按钮）。
* [ ] `mergePresets` 不修改入参数组，新增/更新测试覆盖"返回新数组"契约。
* [ ] `createFilterableDropdown` 支持 `onSelect` 立即提交 + `onInput` 防抖提交双回调。
* [ ] `CONTEXT.md` 的"内容包裹"概念与代码一致；内置 Preset 列入术语表。
* [ ] 错误消息统一在 `shared/errors` 导出，调用方不再内联硬编码。
* [ ] `generateId` 不再位于 `presets.ts`。
* [ ] settings/popup 状态以类封装，行为不变。

## Definition of Done

* Tests added/updated（`storage.test.ts`、`api.test.ts`、`presets.test.ts` 视范围）。
* `npm test` + typecheck green。
* CONTEXT.md / 必要的 ADR 更新。

## Out of Scope

* F-02/F-04 → 转入 #5（PRD-0000），不在本 PRD 立项。
* PRD-0000 的功能性切片（动态注册、SW 可靠性、Shadow DOM、UX 打磨）。

## Technical Approach

* **重复消除（F-01/F-05）**：扩展 `FilterableDropdownOptions`，新增 `onCommit` 钩子统一处理 `onSelect`（立即）与 `onInput`（防抖）。删除 `api-section.ts` 内联实现。
* **纯函数化（F-03）**：`mergePresets` 内 `[...stored]` 后再 push。
* **错误集中（F-07）**：新建 `shared/errors.ts`，导出 `mapHttpError`、`generationFailedPrefix`、`requestFailedPrefix` 等常量与 `errorFromResponse` 工具。
* **状态封装（F-09）**：新增 `SettingsState` 类（参考 `ContentState`），settings/popup 用其实例替换模块级 `let`。
* **文档（F-06）**：CONTEXT.md 改名 "Safety Prefix" → "Content Framing"，补 `SYSTEM_SECURITY_RULES` 层与内置 Preset 列表。

## Traceability

- **Created by**: `/story` (minimal PRD from `/improve-architecture` report)
- **Arch reviewed by**: `/improve-architecture` (2026-07-07) — 9 findings (Blocking: 0, High: 2, Medium: 4, Low: 3); F-02/F-04 转入 #5
- **Sliced by**: `/story` → Child Issues below
- **Implemented by**: `/implement` (2026-07-07) — #11-#15 完成；#16 blocked by #8
- **Reviewed by**: `/review` (2026-07-07) — 三视角审查（Test/Code/Impact），Approve；Test Review major（dropdown 测试缺口）经补测解决，minor 全部处理
- **Sliced into**:
  - #11 — [PRD-0001] mergePresets 副作用纯化 (AFK) — Done
  - #12 — [PRD-0001] CONTEXT.md 概念漂移修正 (AFK) — Done
  - #13 — [PRD-0001] generateId 模块归属 (AFK) — Done
  - #14 — [PRD-0001] 通用下拉组件复用 (AFK, blocked by #11) — Done
  - #15 — [PRD-0001] 错误消息集中 (AFK, blocked by #14) — Done
  - #16 — [PRD-0001] settings/popup 状态封装 (AFK, blocked by #8) — 待 #8 完成后启动
- **New terms**: Content Framing（替代 Safety Prefix）

## Issue

#10
