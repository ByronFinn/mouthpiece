# 生成请求关闭模型思考（档案 + 自定义）

> **Status**: In Progress | **PRD**: PRD-0002 | **Created**: 2026-07-09 | **Last updated**: 2026-07-09

## Goal

嘴替通过 OpenAI 兼容 `/chat/completions` 调用用户自带模型（BYOK）。大量模型默认开启 thinking/reasoning，评论生成无需深度推理却被拖慢。提供**默认关闭思考**能力：用户按模型生态选择**预制关思考档案**注入对应参数；不在预制范围时用**二级自定义 JSON**（附填写说明）。不绑定单一厂商，不喷射全量方言字段。

## What I already know

* 当前 `buildChatBody`（`src/shared/api.ts`）只发 `model` / `messages` / `stream` / 可选 `response_format`。
* Settings 可自定义 `baseUrl` + `model`；单/多风格与图片 fallback 均经 `callWithImageFallback` → `callOpenAI`。
* 已有 `response_format: json_object` 遇 400/422 去掉重试；与关思考档案解耦后仍可保留。
* 各家关思考参数不统一（见 Technical Notes）；全量叠加方案在 grill 中否决。
* 父 Issue #17；ADR [0002](../adr/0002-thinking-disable-profiles.md)。

## Assumptions (resolved)

* ~~全量方言包可安全合并~~ → **否决**；改为单档案注入。
* 用户能根据自己的模型选对档案或填写自定义；选错可能导致 400 或仍思考 → **已知限制**，靠 UI 说明与错误提示。
* 评论生成默认不需要 reasoning；主开关可关闭关思考行为 → **已确认**。

## Open Questions

* （全部已在 grill 中决议，见下「Grill 决议摘要」。）

### Grill 决议摘要

1. **废弃**默认全量喷射多方言包。
2. **配置模型**：主开关「关闭模型思考（加速）」默认开 + 一级档案下拉 + 二级自定义 JSON（必附简短说明与示例）。
3. **`testConnection`** 与生成使用同一字段解析结果。
4. **预制档案**（默认 **`deepseek_glm`**）：`openai_openrouter` | `deepseek_glm` | `qwen_cloud` | `qwen_glm_local` | `ollama` | `custom`。
5. **自定义**：top-level 浅合并；丢弃保留键 `model` / `messages` / `stream` / `response_format`。
6. **不做** `none`→`minimal` 二级 effort；**不**因关思考 400 自动换档案。
7. **json_object** 降级独立保留。
8. **`/no_think` soft switch** 不作主路径（Out of Scope）。

## Requirements

* **R1 — 默认关思考**：`disableModelThinking` 默认 `true`；开启时按档案向生成与 `testConnection` 注入字段。
* **R2 — 一级档案**：Settings 下拉；预制 +「自定义」；默认 `deepseek_glm`。
* **R3 — 二级自定义**：`custom` 时展示 JSON 编辑区 + **简短说明与示例**；非法 JSON 不可静默生效。
* **R4 — 主开关关**：不注入任何关思考扩展字段。
* **R5 — 预制映射**（单档案，非叠加）：见下表。
* **R6 — 合并规则**：扩展字段浅合并进 body；自定义路径丢弃保留键。
* **R7 — 存储**：`disableModelThinking`、`thinkingDisableProfile`、`thinkingDisableExtra`；旧数据缺省兼容。
* **R8 — 错误**：关思考相关 400/422 提示检查档案/自定义；不自动切换档案。
* **R9 — 测试与文档**：单测覆盖注入/开关/自定义/保留键；CONTEXT 已含术语。

## Acceptance Criteria

* [ ] 新安装：主开关默认开、默认档案 `deepseek_glm`；生成与 testConnection body 含 `thinking: { type: "disabled" }`，不含其它档案字段。
* [ ] 关闭主开关后，body 无关思考扩展字段。
* [ ] 切换各预制档案时，注入字段与映射表一致。
* [ ] 自定义合法 JSON merge 生效；设置页有说明与示例；非法 JSON 保存拦截或明确错误。
* [ ] 自定义中的 `model`/`messages`/`stream`/`response_format` 被忽略。
* [ ] `json_object` 400/422 降级仍可用，且只剥 json、不动档案字段。
* [ ] 设置持久化；刷新后状态保持。
* [ ] unit test + lint/typecheck 绿。

## Definition of Done

* Tests added/updated（`api.test.ts`、storage/settings）。
* Lint / typecheck / CI green。
* CONTEXT.md 术语已更新；设置页说明文案到位。
* ADR 0002 Accepted。

## Out of Scope

* 按 baseUrl/模型名**自动猜测**档案（可未来增强）。
* 全量多方言叠加 + 自动剥离阶梯。
* 原生 Anthropic / Gemini 非 OpenAI 兼容协议。
* 解析/剥离响应中的 `<think>` / `reasoning_content`。
* 提示词 soft switch（`/no_think`）作主方案。
* 保证所有型号 API 层绝对零思考。
* 通用「任意 extra body」编辑器（本 PRD 的自定义**仅**服务关思考场景的二级配置）。

## Technical Approach

### 解析

```ts
function resolveThinkingDisableFields(settings: Settings): Record<string, unknown> {
  if (!settings.disableModelThinking) return {};
  if (settings.thinkingDisableProfile === "custom") {
    return stripReserved(parseObjectOrEmpty(settings.thinkingDisableExtra));
  }
  return { ...PRESET_PROFILES[settings.thinkingDisableProfile] };
}
// buildChatBody / testConnection: { ...base, ...resolveThinkingDisableFields(settings) }
```

保留键：`model` | `messages` | `stream` | `response_format`。

### json_object 降级

现有：有 `json_object` → 400/422 → 无 `json_object`。与档案无关。

### UI（建议 API 配置区，紧邻模型）

* 主开关：「关闭模型思考（加速）」默认开  
* 档案下拉（主开关开时启用）  
* 自定义区 + 说明：

  > 将额外 JSON 字段合并进 Chat Completions 请求体（与 model、messages 同级）。  
  > 只写服务文档里「关闭思考」的字段。示例：  
  > `{"thinking":{"type":"disabled"}}`  
  > `{"enable_thinking":false}`  
  > `{"chat_template_kwargs":{"enable_thinking":false}}`  
  > 须为单个 JSON 对象。不要填写 model / messages / stream / response_format（插件会忽略）。

### 存储默认

| 字段 | 默认 |
|------|------|
| `disableModelThinking` | `true` |
| `thinkingDisableProfile` | `deepseek_glm` |
| `thinkingDisableExtra` | `{}`（或 `"{}"` 字符串） |

### MVP 预制档案

| id | 显示名 | 注入 |
|----|--------|------|
| `openai_openrouter` | OpenAI / OpenRouter | `reasoning: { effort: "none" }`, `reasoning_effort: "none"` |
| `deepseek_glm` | DeepSeek / 智谱 GLM | `thinking: { type: "disabled" }` |
| `qwen_cloud` | Qwen 云（百炼等） | `enable_thinking: false` |
| `qwen_glm_local` | Qwen / GLM 本地（vLLM·SGLang·llama.cpp） | `chat_template_kwargs: { enable_thinking: false }` |
| `ollama` | Ollama | `think: false` |
| `custom` | 自定义… | 解析后的 `thinkingDisableExtra` |

## Research References

* （暂无正式 `/research` 记录；对照表见 Technical Notes。可选后续补 research 固化权威链接。）

## Feasible Approaches

**Approach A: 全量方言包 + 降级** — grill **否决**（冲突、难诊断）。

**Approach B: 仅自定义 JSON** — 默认体验差，仅作二级。

**Approach C: 预制档案 + 自定义 + 主开关** — **采用**（见 ADR 0002）。

## Decision (ADR-lite)

**Context / Decision / Consequences**: 升格为 [ADR 0002](../adr/0002-thinking-disable-profiles.md)。

## Implementation Plan (small PRs)

* **PR1**: Settings 字段 + 默认值 + `PRESET_PROFILES` / `resolveThinkingDisableFields` / `stripReserved` 纯函数 + unit tests。
* **PR2**: `buildChatBody` + `testConnection` 接入；json 降级与档案并存；api tests。
* **PR3**: Settings UI（开关、档案、自定义说明）+ 错误文案 + 文档核对。

## Technical Notes

### 代码落点

* `src/shared/api.ts`、`types.ts`、`storage.ts`、`presets.ts`（DEFAULT_SETTINGS）
* `src/settings/ui/api-section.ts`（或 generation-section）
* `src/shared/api.test.ts` 等

### 厂商对照

| 生态 | 关思考字段 |
|------|------------|
| OpenAI / OpenRouter | `reasoning.effort` / `reasoning_effort`: `none` |
| DeepSeek / 智谱 GLM | `thinking: { type: "disabled" }` |
| Qwen 云 | `enable_thinking: false` |
| Qwen/GLM 本地 | `chat_template_kwargs: { enable_thinking: false }` |
| Ollama | `think: false` |

## Domain Terms

* **关闭模型思考（disableModelThinking）**
* **关思考档案（thinkingDisableProfile）**
* **关思考自定义参数（thinkingDisableExtra）**

（定义见 `CONTEXT.md`。）

## Traceability

- **Created by**: `/think` (2026-07-09)
- **Prototyped by**: —
- **Grilled by**: `/grill` (completed 2026-07-09) — 否决全量方言包；锁定档案+自定义；默认 deepseek_glm；浅合并丢弃保留键；ADR 0002
- **Sliced into**:
  - #18 — [PRD-0002] 关思考字段解析与请求注入 — 默认档案接通生成与测试连接 (AFK) — Done
  - #19 — [PRD-0002] 设置页主开关与档案 UI — 切换档案并持久化 (AFK, blocked by #18) — Done
  - #20 — [PRD-0002] 自定义关思考 JSON 与错误提示 — 二级配置与说明 (AFK, blocked by #19) — Done
- **Implemented by**: `/implement` (2026-07-09) — #18–#20
- **Reviewed by**: —
- **New terms**: disableModelThinking, thinkingDisableProfile, thinkingDisableExtra
- **New decisions**: ADR 0002

## Child Issues

| # | Title | Type | Blocked by |
|---|--------|------|------------|
| #18 | 关思考字段解析与请求注入 | AFK | — |
| #19 | 设置页主开关与档案 UI | AFK | #18 |
| #20 | 自定义关思考 JSON 与错误提示 | AFK | #19 |

## Issue

#17
