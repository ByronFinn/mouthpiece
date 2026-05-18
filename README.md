# 嘴替 / Mouthpiece

> Select any text on a webpage, get witty comments ready to paste — powered by LLM.

[English](#english) | [中文](#中文)

---

## English

### What it does

Mouthpiece is a Chrome extension (Manifest V3) that generates multi-style social media comments for any selected text (and images) on a webpage. It calls OpenAI-compatible APIs directly — bring your own key.

Select a post → click the floating button → get comment cards in your chosen style → copy and paste.

### Built-in Styles

| Style | Description |
|-------|-------------|
| **Cynic** (玩世不恭) | Piercing insight wrapped in humor |
| **Wholesome** (温暖治愈) | Genuine warmth and positivity |

You can also create custom presets via the Settings page.

### Architecture

```
┌──────────────────────────────────────────────┐
│           Chrome Extension (MV3)             │
│                                              │
│  Content Script ──▶ Background Worker ──▶   │
│  (selection, UI)    (API calls)       OpenAI │
│                                              │
│  Popup ──▶ Settings Page                     │
│  (style)    (API key, presets, config)       │
└──────────────────────────────────────────────┘
```

- **No backend required** — the extension calls OpenAI-compatible APIs directly
- **BYOK** — bring your own API key (OpenAI, or any compatible endpoint)

### Features

- **Text + Image support** — select text with images, they're extracted via canvas
- **Multiple presets** — built-in Cynic + Wholesome, add your own custom presets
- **Single / Multi style** — generate multiple replies from one preset, or one reply per preset
- **Safety prefix** — prevents prompt injection from selected text
- **Output sanitization** — detects prompt leakage in AI responses
- **Smart image fallback** — if the model doesn't support vision, silently retries without images
- **Robust JSON parsing** — direct parse → code block extraction → bracket matching

### Install

1. Clone the repo
   ```bash
   git clone https://github.com/ByronFinn/mouthpiece.git
   cd mouthpiece
   npm install
   npm run build
   ```

2. Open `chrome://extensions`
3. Enable **Developer mode**
4. Click **Load unpacked** → select the `dist/` folder
5. Click the toolbar icon → click ⚙ to open Settings → enter your API key

### Development

```bash
npm run dev    # Vite dev server with HMR
npm run build  # Production build
```

### Tech Stack

- **Build**: Vite + CRXJS + TypeScript
- **Extension**: Chrome Manifest V3
- **LLM**: Any OpenAI-compatible API (BYOK)

### License

ISC

---

## 中文

### 功能简介

嘴替是一个 Chrome 浏览器扩展（Manifest V3），在任意网页上选中文字（和图片），点击浮动按钮，即可获得社交媒体风格评论，一键复制粘贴。直接调用 OpenAI 兼容 API，自带 Key 即可使用。

### 内置风格

| 风格 | 说明 |
|------|------|
| **玩世不恭** | 看透一切的幽默吐槽 |
| **温暖治愈** | 真诚温暖，传递善意 |

也可以在设置页面创建自定义预设。

### 架构

```
┌──────────────────────────────────────────────┐
│           Chrome 插件 (MV3)                  │
│                                              │
│  Content Script ──▶ Background Worker ──▶   │
│  (选区、UI)         (API 调用)       OpenAI  │
│                                              │
│  Popup ──▶ 设置页面                          │
│  (风格)     (API Key、预设、配置)             │
└──────────────────────────────────────────────┘
```

- **无需后端** — 插件直接调用 OpenAI 兼容 API
- **自带 Key** — 使用你自己的 API Key（OpenAI 或任意兼容端点）

### 安装

1. 克隆仓库
   ```bash
   git clone https://github.com/ByronFinn/mouthpiece.git
   cd mouthpiece
   npm install
   npm run build
   ```

2. 打开 `chrome://extensions`
3. 开启 **开发者模式**
4. 点击 **加载已解压的扩展程序** → 选择 `dist/` 目录
5. 点击工具栏图标 → 点击 ⚙ 打开设置 → 填入 API Key

### 开发

```bash
npm run dev    # Vite 开发服务器（支持 HMR）
npm run build  # 生产构建
```

### 技术栈

- **构建**：Vite + CRXJS + TypeScript
- **插件**：Chrome Manifest V3
- **LLM**：任意 OpenAI 兼容 API（自带 Key）

### 许可证

ISC
