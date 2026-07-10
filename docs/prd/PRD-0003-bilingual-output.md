# 生成结果始终双语（原文语言 + 中文）

> **Status**: Done | **PRD**: PRD-0003 | **Created**: 2026-07-10 | **Last updated**: 2026-07-10

## Goal

让嘴替**评论结果**在选区语言 ≠ `translationLang` 时，**始终同时给出可发帖的原文语言评论与目标语言（默认中文）翻译**，避免只返回中文一侧。通过收紧 system prompt 的语言与输出格式规则落实，不改 schema、不做语种检测库。

## What I already know

* 用户诉求：返回内容始终是「选中原始语言 + 中文翻译」，而不是只返回中文。
* 产品：Chrome MV3 扩展；Content 选区 → Background 调 OpenAI 兼容 API → 结果层展示。
* 数据模型已支持双语：帖子译文 `ApiResult.translation`、评论文本/评论译文 `Comment.content` / `Comment.translation`。
* Prompt / UI / 解析现状与 think 阶段一致；UI 在评论译文非空时已双行。
* **Q1**：MVP 仅评论双语；帖子区不变。
* **Q2**：Approach A — 仅收紧 Prompt。
* **Q3 / Grill #5**：纯图/混排不新增语种识别。
* **Grill #1**：评论译文 null **仅以选区语言** vs `translationLang` 判定。
* **Grill #2**：不改内置 Preset `## Examples`。
* **Grill #3**：仅 Prompt、无运行时校验 = 已知限制。
* **Grill #4**：术语已写入 `CONTEXT.md`；修正 content≠target lang。
* **Grill #6**：Approach B/C 为**延期**（deferred），非永久否定。

## Assumptions (resolved)

* 「中文」跟随 `translationLang`，不硬编码 → **已确认**。
* 同语言单行可接受 → **已确认**。
* 不新增 schema → **已确认**。
* 模型服从作 MVP、客户端不校验 → **已知限制**（Grill #3）。
* 选区语言由模型判定 → **已确认**。
* 风格 few-shot 与 JSON 输出格式分离 → **已确认**（Grill #2）。

## Open Questions

* （无）

## Requirements

* **R1 — 评论文本对齐原始语言**：有可选中文本时，每条 `comments[].content` 须与选区同语言与语域（不得因 `translationLang` 改写成目标语言）。
* **R2 — 跨语言强制评论译文**：当**选区语言** ≠ `translationLang` 时，每条 `comments[].translation` **必须**非空（目标语言意译）；与 content 是否漂移无关。
* **R3 — 同语言可单行**：当**选区语言** = `translationLang` 时，允许 `translation: null`。
* **R3b — null 判定基准**：Prompt 须写明 null 基于 **original/selection language**，不得写成「若 content 已是 translation_lang 则可 null」。
* **R4 — 帖子译文不变**：顶层 `ApiResult.translation` 与帖子摘要 UI 不改语义。
* **R5 — 多风格一致**：`multi` 下各组遵守 R1–R3（共享 `buildSystemPrompt`）。
* **R6 — Prompt 契约可测**：`presets.test.ts` 锁定语言/双语/null 基准相关句子。
* **R7 — 文档**：`CONTEXT.md` 术语与 API 输出/语言策略（grill 已修正 glossary + API 段；实现后若 Prompt 措辞微调再对齐一次即可）。

## Acceptance Criteria

* [x] 非 `translationLang` 选区：Prompt 要求评论文本为选区语言，且评论译文必须非空；null 条件绑定选区语言。
* [x] 中文选区且 `translationLang=中文`：允许评论译文 null。
* [x] 结果层：有评论译文则双行（现有 UI，无需为展示单独改代码除非回归）。
* [x] `presets.test.ts` 断言含：选区同语言 content、跨语言 translation 非空、禁止 translation_lang 覆盖 content、null 基于 selection/original language。
* [x] `CONTEXT.md` 描述双语策略且不再将 content 写成 target lang（grill 已完成）。
* [x] 不引入语种检测依赖、不增加生成请求次数。
* [x] 不把多模型 E2E 双语成功率列为 DoD。

## Definition of Done

* `presets` 契约测试更新并通过
* Lint / typecheck / CI green
* `CONTEXT.md` 与最终 Prompt 语义一致（术语已在 grill 写入）
* 已知限制已文档化（PRD + CONTEXT）

## Out of Scope

* 帖子区双语 / 结果层回显选中原文
* 同语言强制第二行
* **Approach B/C（延期）**：客户端语种启发校验、解析失败重试、自动二次纠错 — 本 PRD 不做；跨语言仍大量失败时**另开 PRD**，非永久不做
* 第三方翻译 API、离线词典、流式输出
* 纯图/混排智能语种识别增强（沿用现规则；无字图单行属预期）
* 修改 `translationLang` 设置 UX
* 内置 Preset persona `## Examples` 双语化

## Technical Approach

在 `src/shared/presets.ts` 收紧共享片段（一次改全局生效）：

1. **`INPUT_LANGUAGE_RULES`**：有文本时 content 必须与选区同语言；禁止因 `{{translation_lang}}` 改写评论语言；保留纯图无字 → `{{translation_lang}}`。
2. **`OUTPUT_FORMAT`**：content = 选区语言；comment translation 仅当**选区语言** = `{{translation_lang}}` 可为 null，否则必须非空。
3. **`TRANSLATION_RULES`（按需）**：评论译文与 content 对应，跨语言不得省略。
4. **共享段短正反例**（非 persona Examples）：英文帖 → 英 content + 中 translation；禁止外文帖全中文 content 或跨语言 translation null。
5. **`presets.test.ts` 契约断言**。
6. **`CONTEXT.md`**：grill 已更新；实现 PR 复核即可。

**不改**：内置 Examples、`types.ts`、`result-layer.ts`、`api.ts` 校验、请求次数。

## Research References

* [openai prompt-engineering](../research/openai-prompt-engineering-4.md) — 系统消息放角色/安全/格式；静态段在前、变量段在后

## Feasible Approaches

**Approach A: 仅收紧 Prompt** ✅ 已选  

**Approach B / C** — 未选；**延期**待证据另开 PRD

## Decision (ADR-lite)

**Context**: 跨语言评论需稳定双语，并控制成本与复杂度。  
**Decision**: Approach A — 仅 `buildSystemPrompt` 共享规则；null 以选区语言为准；不改 schema/校验/Examples。  
**Consequences**: 实现面小；依赖模型服从（已知限制）；B/C 延期。  
**ADR**: 不升格正式 ADR — 易逆转（改 Prompt 即可），不满足「难逆转」条件。

## Implementation Plan (small PRs)

* **PR1（主）**：`presets.ts` 语言/输出格式 + `presets.test.ts`
* **PR2（轻）**：复核 `CONTEXT.md` 与最终 Prompt 措辞一致（术语与 API 段 grill 已改）

可单 PR 合并。

## Technical Notes

* 主改：`src/shared/presets.ts`、`src/shared/presets.test.ts`
* UI 双行已存在：`createCommentCard`
* 现 `OUTPUT_FORMAT` 写的是 “null if the original text language matches” — 方向接近 Grill #1，但仍需禁止 “content 已是目标语言则可 null” 的歧义，并强化禁止 translation_lang 覆盖 content

## Domain Terms

* 原始语言 / 目标翻译语言 / 帖子译文 / 评论文本 / 评论译文 / 双语评论结果 — 见 `CONTEXT.md`

## Traceability

- **Created by**: `/think`（父 Issue 于 2026-07-10 Step 10 补建）
- **Prototyped by**: —
- **Grilled by**: `/grill` (completed 2026-07-10) — null 以选区为准；不改 Examples；已知限制接受；术语入 CONTEXT；纯图不增强；B/C 延期；无新 ADR
- **Sliced by**: `/story` → Child Issues below
- **Sliced into**:
  - #22 — [PRD-0003] 评论双语 Prompt 契约 — 选区语言 content + 跨语言强制评论译文 (AFK) — Done
- **Implemented by**: `/implement` (2026-07-10) — #22
- **Debugged by**: —
- **Arch reviewed by**: —
- **Reviewed by**: `/review` (2026-07-10) — 三视角 Approve（初审 Comments 后收紧契约测试 re-review Approve）；83 tests + lint + typecheck + build green
- **New terms**: 原始语言、目标翻译语言、帖子译文、评论文本、评论译文、双语评论结果
- **New decisions**: 见 Decision (ADR-lite)；无独立 ADR 文件

## Issue

#21
