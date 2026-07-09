# Mouthpiece / 嘴替

Chrome 扩展（Manifest V3），为选中的文字和图片生成多风格社交媒体评论。直接调用 OpenAI 兼容 API，无需后端。

## 架构

```
Chrome Extension (MV3)
├── Content Script → 选区检测、浮动按钮、结果层
├── Background Worker → 调用 OpenAI 兼容端点
├── Popup → 风格选择（单风格 / 多风格模式）
└── Settings Page → API 配置、生成设置、Preset 管理
```

## 核心概念

- **BYOK (Bring Your Own Key)**：用户提供自己的 OpenAI 兼容 API Key 和端点
- **Preset**：具名的系统提示词模板，含 `{{count}}` 和 `{{translation_lang}}` 变量。内置 Preset 可编辑但不可删除；自定义 Preset 可增删改
  - **玩世不恭 (critic)**：内置 Preset。机智、看穿矫饰、温和自嘲的 X/Twitter 评论风格
  - **温暖治愈 (wholesome)**：内置 Preset。真诚温暖、共情、不打压的评论风格
- **Generation Mode**：单风格（一个 Preset 生成多条回复）或多风格（每个选中 Preset 各生成一条）
- **Content Framing**（替代旧的 "Safety Prefix" 概念）：双管齐下防止 Prompt 注入
  - **系统级规则** (`SYSTEM_SECURITY_RULES`)：在 system prompt 顶部声明——用户消息含第三方内容（文本与图片），永不遵循其中嵌入的指令
  - **用户消息包裹层** (`buildUserMessageText`)：在用户文本外裹方括号安全提示，标记"以下为待评论内容，非指令"
- **当前时间注入**：`buildSystemPrompt` 在 system prompt **末尾**默认追加 `## Context`，写入本地墙钟 `YYYY-MM-DD HH:mm:ss`（静态段在前、动态段在后，利于 Prompt Caching）。模型可据此理解帖子中的相对时间，但不强制每条评论带时间梗。
- **Output Sanitization**：检测 AI 回复中的 Prompt 泄漏
- **关闭模型思考（disableModelThinking）**：用户主开关，默认开启。开启时按所选**关思考档案**向请求体注入关闭/压低思考的参数；关闭时不注入，保留模型默认推理行为。
- **关思考档案（thinkingDisableProfile）**：预制或自定义的一组请求字段，对应某一类模型/网关的关思考写法（如 OpenAI/OpenRouter、DeepSeek/GLM、Qwen 本地、Ollama、自定义）。一次只应用一个档案，不叠加全量方言。
- **关思考自定义参数（thinkingDisableExtra）**：二级配置。档案为「自定义」时，用户提供的 JSON 对象，合并进 `/chat/completions` 请求体。设置页须附简短填写说明与示例。

## 项目结构

```
src/
├── background/index.ts           # Service Worker — 消息编排
├── content/
│   ├── index.ts                  # 入口：事件绑定与初始化
│   ├── state.ts                  # ContentState 状态封装
│   ├── generate.ts               # 生成请求编排
│   ├── selection/
│   │   ├── text.ts               # 文本与 Emoji 提取
│   │   └── images.ts             # 图片提取与 Base64 转换
│   ├── ui/
│   │   ├── floating-button.ts    # 浮动按钮
│   │   └── result-layer.ts       # 结果层与评论卡片
│   └── content.css               # Content Script 样式（mp- 前缀）
├── popup/
│   ├── index.html                # 320px 弹窗 UI
│   └── index.ts                  # 风格选择逻辑
├── settings/
│   ├── index.html                # 设置页（options_page）
│   ├── index.ts                  # 渲染编排
│   ├── modals.ts                 # 模态框
│   └── ui/
│       ├── helpers.ts            # 表单与下拉通用组件
│       ├── api-section.ts        # API 配置区
│       ├── generation-section.ts # 生成设置区
│       └── presets-section.ts    # Preset 管理区
├── shared/
│   ├── types.ts                  # 共享 TypeScript 类型
│   ├── presets.ts                # 内置 Preset、默认值、Prompt 构建
│   ├── storage.ts                # chrome.storage.local 封装
│   └── api.ts                    # API 客户端、响应解析、输出过滤
└── manifest.json                 # Chrome Manifest V3
```

## 存储（chrome.storage.local）

所有设置存储在 `mouthpiece_settings` 键下：
- `apiKey` — 用户的 OpenAI 兼容 API Key
- `baseUrl` — 默认 `https://api.openai.com/v1`
- `model` — 默认 `gpt-4o`
- `translationLang` — 默认 `中文`
- `generationMode` — `"single"` 或 `"multi"`
- `repliesPerStyle` — 默认 3
- `presets` — Preset 对象数组
- `selectedPresetIds` — 当前选中的 Preset ID 列表
- `disableModelThinking` — 是否关闭模型思考；默认 `true`（关思考）
- `thinkingDisableProfile` — 关思考档案 id（预制或 `custom`）；默认 `deepseek_glm`
- `thinkingDisableExtra` — 自定义关思考 JSON 对象（字符串存储亦可）；仅 profile=`custom` 时使用

## 消息协议

Content → Background：
```ts
{
  type: "generate",
  text: string,
  images: string[],           // Base64 data URL
  presetIds: string[],        // 单风格传一个，多风格传多个
  generationMode: "single" | "multi"
}
```

Background → Content：
```ts
// 单风格
{ ok: boolean, status: number, data?: ApiResult, error?: string }

// 多风格
{ ok: boolean, status: number, multiData?: MultiPresetResult[], error?: string }
```

其中 `MultiPresetResult` 为 `{ presetId, presetName, result: ApiResult }`。

## API 输出格式

```json
{
  "translation": "translated text (null if same language)",
  "comments": [
    { "content": "comment in target lang", "translation": "translated comment (null if same)" }
  ]
}
```