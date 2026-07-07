# OpenAI: Prompt Engineering

> **Stack**: openai@gpt-4o  | **Major**: 4  | **Verified**: 2026-07-07  | **Status**: verified

## TL;DR

面向 Mouthpiece 这类「系统提示词 + 用户选区 + JSON 输出」的扩展：系统消息放角色/安全/格式，用户消息放可变内容；静态段在前、变量段在后以利 Prompt Caching；用结构化 JSON 说明 + 解析兜底，而非仅靠强硬措辞；防注入需在 system 声明边界，并在 user 内容前加内容标记前缀。

## Question

在 OpenAI Chat Completions API（gpt-4o 及兼容端点）下，为社交媒体评论生成场景编写系统提示词时，应遵循哪些官方最佳实践？

## Approach

阅读 OpenAI 官方文档中 Prompting、Prompt Caching、Structured Outputs、Safety best practices 四节；对照 Mouthpiece 现有 `presets.ts` 的 SAFETY_PREFIX、buildSystemPrompt 拼装顺序、以及 user message 中是否附加内容边界标记，提炼可落地的结构建议。

## Findings

| 做法 | 优点 | 缺点 | 适用场景 |
|---|---|---|---|
| 系统消息承载角色 + 输出约束 | 与官方「tone/role 放 system」一致；便于复用 | 系统提示过长时成本上升 | 固定人设 + 固定输出 schema |
| 用户消息承载选中文本/图片 | 可变内容与指令分离，降低注入面 | 需在 user 侧加边界标记 | 用户任意选区输入 |
| 静态前缀 + 变量后缀拼装 | 命中 Prompt Caching，降延迟/成本 | 需刻意拆分模板变量 | 同一 Preset 多次生成 |
| Prompt 内嵌 JSON schema 说明 | 兼容非 OpenAI 端点；配合 parseResponse 兜底 | 不如 `response_format` 硬约束可靠 | BYOK 多供应商 |
| Structured Outputs (`response_format`) | 输出类型安全、少重试 | 部分兼容 API 不支持 | 仅 OpenAI 官方端点时可选 |
| 少量高质量 few-shot 示例 | 显著稳定语气与格式 | 增加 token | 风格化评论生成 |

## Verdict & Rationale

Mouthpiece 应采用四层 system 拼装：**安全边界（静态）→ 风格人设（静态）→ 共享任务规则（静态）→ 含变量的翻译/输出段（末尾）**；用户选区文本与图片仅出现在 user message，并在文本前附加内容边界前缀。输出格式保留 JSON schema 文字说明（兼容 BYOK），并强调 `comments` 数组长度与多样性。此结构与 OpenAI Prompt Caching「静态在前、变量在后」及 Safety「prompt engineering 约束话题与语气」一致。

## Boundary Conditions

适用于 gpt-4o 及更新模型的 Chat Completions 调用。项目默认 `gpt-4o`，无 openai SDK 依赖；兼容端点可能不支持 Structured Outputs，故不以 `response_format` 为唯一保障。对 minor 版本不敏感。若迁移至 Responses API 或全面启用 JSON Schema 硬约束，可另开 `-5` 研究记录评估是否简化 OUTPUT_FORMAT 文案。

## Sources

**Tier 1 (maintainer-authored, required)**
- [OpenAI API: Prompting overview](https://developers.openai.com/api/docs/guides/prompting) — 角色放 system、提示词版本化管理、评测驱动迭代
- [OpenAI API: Prompt caching](https://developers.openai.com/api/docs/guides/prompt-caching) — 静态内容置前、可变内容置后
- [OpenAI API: Structured outputs](https://developers.openai.com/api/docs/guides/structured-outputs) — JSON schema 约束可减少对强硬格式措辞的依赖
- [OpenAI API: Safety best practices](https://developers.openai.com/api/docs/guides/safety-best-practices) — prompt engineering 约束输出；限制用户输入；对抗性测试