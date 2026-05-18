# Mouthpiece / 嘴替

A Chrome extension (Manifest V3) that generates multi-style social media comments for selected text and images. Calls OpenAI-compatible APIs directly — no backend required.

## Architecture

```
Chrome Extension (MV3)
├── Content Script → selection detection, floating button, result layer
├── Background Worker → API calls to OpenAI-compatible endpoints
├── Popup → style selection (single/multi mode)
└── Settings Page → API config, generation settings, preset management
```

## Key concepts

- **BYOK (Bring Your Own Key)**: User provides their own OpenAI-compatible API key and endpoint
- **Preset**: A named system prompt template with `{{count}}` and `{{translation_lang}}` variables. Built-in presets (Cynic, Wholesome) are editable but not deletable. Custom presets can be added/edited/deleted.
- **Generation Mode**: Single Style (multiple replies from one preset) or Multi Style (one reply per selected preset)
- **Safety Prefix**: Prepended to user text to prevent prompt injection
- **Output Sanitization**: Detects prompt leakage in AI responses

## Project structure

```
src/
├── background/index.ts      # Service Worker — handles API calls
├── content/
│   ├── index.ts              # Selection detection, floating button, result layer
│   └── content.css           # Content script styles (mp- prefixed)
├── popup/
│   ├── index.html            # 320px popup UI
│   └── index.ts              # Style selection logic
├── settings/
│   ├── index.html            # Full settings page (options_page)
│   └── index.ts              # Settings management
├── shared/
│   ├── types.ts              # Shared TypeScript types
│   ├── presets.ts            # Built-in presets, defaults, prompt builder
│   ├── storage.ts            # chrome.storage.local wrapper
│   └── api.ts                # OpenAI API call + response parsing
└── manifest.json             # Chrome Manifest V3
```

## Storage (chrome.storage.local)

All settings stored under key `mouthpiece_settings`:
- `apiKey` — user's OpenAI-compatible API key
- `baseUrl` — default `https://api.openai.com/v1`
- `model` — default `gpt-4o`
- `translationLang` — default `Chinese`
- `generationMode` — `"single"` or `"multi"`
- `repliesPerStyle` — default 3
- `presets` — array of preset objects
- `selectedPresetIds` — currently selected preset IDs

## Message protocol

Content → Background:
```ts
{ type: "generate", text: string, images: string[], presetId: string }
```

Background → Content:
```ts
{ ok: boolean, status: number, data?: ApiResult, error?: string }
```

## API output format

```json
{
  "translation": "translated text (null if same language)",
  "comments": [
    { "content": "comment in target lang", "translation": "translated comment (null if same)" }
  ]
}
```
