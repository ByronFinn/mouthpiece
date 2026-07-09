# 0002 - 关思考：预制档案 + 自定义，而非全量方言喷射

Date: 2026-07-09

## Status

Accepted

## Context

BYOK 场景下，用户使用的 OpenAI 兼容模型（OpenAI、DeepSeek、智谱 GLM、Qwen 本地、Ollama 等）关闭 thinking 的请求参数互不兼容。评论生成不需要深度推理，默认开思考会显著拖慢响应。

曾考虑在每次请求中**叠加全量「关思考方言包」**（多字段同时注入）并在 400 时剥离重试。问题：

1. 未知字段可能 400 或被静默忽略，行为难诊断；
2. 400 时无法区分是 `json_object` 还是某一思考字段导致；
3. 与 BYOK「用户知道自己的模型」假设不符——用户更适合自己选对参数，而不是客户端猜。

## Decision

采用 **主开关 + 一级预制档案 + 二级自定义 JSON**：

1. **`disableModelThinking`**（默认 `true`）：关闭时不注入任何关思考扩展字段。
2. **`thinkingDisableProfile`**：从预制档案中选择与模型生态匹配的字段集；默认 **`deepseek_glm`**。
3. **`thinkingDisableExtra`**：档案为 `custom` 时，用户提供 JSON；设置页必须提供简短填写说明与示例。
4. 自定义与基础 body **浅合并**，并**丢弃保留键**（`model`、`messages`、`stream`、`response_format`），防止覆盖核心请求。
5. **不**因关思考参数 400 自动切换档案；可提示用户检查档案。`json_object` 降级与档案解耦，可单独保留。
6. `testConnection` 与生成使用同一套字段解析结果。

MVP 预制档案见 PRD-0002。

## Consequences

### Positive

* 请求体干净、可预期，便于排错。
* 覆盖常见生态，长尾靠自定义 + 说明文案。
* 与「用户选模型」心智一致。

### Negative

* 用户需选对档案；默认 `deepseek_glm` 与仓库默认 OpenAI baseUrl 不完全对齐，用 OpenAI 的用户可能需改一次档案。
* 需维护预制表与设置 UI。
* 静默忽略未知字段的网关上，选错档案仍可能「看起来成功但很慢」——靠文档与档案切换解决。

## Alternatives Considered

* **全量方言包 + 400 降级**：零配置面广，但冲突与诊断成本高，grill 中否决。
* **仅自定义 JSON**：最通用，默认体验差。
* **按 baseUrl 自动猜档案**：脆弱、误判成本高；可作未来增强，非 MVP。
