# Chrome 插件架构优化

> **Status**: Sliced | **PRD**: PRD-0000 | **Created**: 2026-07-07 | **Last updated**: 2026-07-07

## Goal

对 Mouthpiece Chrome 扩展进行架构、设计与开发流程的整体优化，确保开发快、体验好、易扩展。本 PRD 是 issue #4 的拆分母文档，覆盖类型化消息基线、动态注册、Service Worker 可靠性、Shadow DOM 隔离、UX 打磨五条垂直切片。

## What I already know

* 项目为 Manifest V3 扩展，分层为 content / background / popup / settings / shared。
* 现状：Content Script 静态注册、SW 长任务易被回收、UI 与宿主页面 CSS 不隔离、generate 通信未类型化。
* 已通过 `/grill` 确认核心决策（见 ADR 0001）。

## Requirements

* 类型化 content ↔ background 通信 + CI/Lint 工程基线。
* 按 `enabled` 开关动态注入 Content Script。
* Service Worker 在并行生成期间保持存活，并支持请求中止。
* Content UI 迁移至 Shadow DOM，免疫宿主页面样式。
* Content/Popup 交互细节打磨（滚动跟随、storage 实时同步）。

## Acceptance Criteria

* [ ] generate 请求/响应有编译期类型约束，ESLint/Prettier 基线就绪，CI 在 master push/PR 跑 build + test。
* [ ] 未配置 API Key 或未启用时，任意网页无 Content Script 注入。
* [ ] 3 个 Preset 并行生成期间 SW 不被回收；「换一批」与关闭开关都能正确中止请求。
* [ ] 浮动按钮/结果层在 Shadow DOM 内渲染，宿主 CSS 不改变其外观。
* [ ] 页面滚动/resize 后浮动按钮位置合理；Popup 在 Settings 修改后实时刷新。

## Definition of Done

* Tests added/updated（unit/integration where appropriate）。
* Lint / typecheck / CI green。
* Docs/notes 更新（CONTEXT.md、ADR 如有新决策）。

## Out of Scope

* Phase 3 架构拆分（generation 策略、shared/ui 复用）—— 见 PRD-0001 架构债清理。

## Technical Approach

* 消息层：新增类型化 `sendMessage` 包装，迁移 generate 流程。
* 动态注册：`chrome.scripting` API + `mouthpiece.invalid` 占位（见 ADR 0001）。
* SW 可靠性：heartbeat 保活 + `AbortController`。
* 样式隔离：Shadow Host + Vite `?inline` 注入 css。
* 实时同步：`chrome.storage.onChanged` 监听。

## Traceability

- **Created by**: 回填重建（原始文件未提交，从 issue #4 内容恢复）
- **Sliced by**: `/story` → Child Issues below
- **Arch reviewed by**: `/improve-architecture` (2026-07-07) — Phase 3 架构拆分已转入 PRD-0001
- **Sliced into**:
  - #5 — [PRD-0000] 类型化消息与工程基线 (AFK) — In Progress（待合入 F-02/F-04）
  - #6 — [PRD-0000] 动态 Content Script 注册 (AFK, blocked by #5)
  - #7 — [PRD-0000] Service Worker 可靠性 (AFK, blocked by #6)
  - #8 — [PRD-0000] Content UX 打磨 (AFK, blocked by #8)
  - #9 — [PRD-0000] Shadow DOM UI 隔离 (AFK, blocked by #6)

## Issue

#4
