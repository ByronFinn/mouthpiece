# 0001 - 动态 Content Script 注册

Date: 2026-07-07

> 注：本 ADR 从 issue #6 回填重建（原始文件未提交至仓库）。Context/Decision 摘自 issue 描述与 PRD-0000 的核心决策。

## Status

Accepted

## Context

Mouthpiece 的 Content Script 当前通过 `manifest.json` 的 `content_scripts` 静态注册，在所有页面无条件注入。这带来两个问题：

1. **隐私感知**：用户即使未启用插件、未配置 API Key，扩展代码也在每个页面运行，引发"插件窥探浏览"的疑虑。
2. **资源浪费**：未使用时仍占用页面运行时，监听 `mouseup` 等事件，影响宿主页面的轻微性能与事件流。

Chrome MV3 提供了 `chrome.scripting` API，允许 Service Worker 在运行时按需注册 / 注销 Content Script。这给"启用才注入、关闭即失效"的精确控制提供了官方路径。

## Decision

采用**动态 Content Script 注册**方案：

- `Settings.enabled` 字段控制注入开关；新装默认 `false`，老用户（已配置 Key）自动迁移为 `true`。
- 首次保存 API Key 时自动置 `enabled = true` 并显示一次性提示。
- `manifest.json` **不声明任何 `content_scripts`**；新增 `scripting` 权限。
- Content script 由**独立的 Vite build**（`vite.content.config.ts`，IIFE 格式、`inlineDynamicImports`）输出到固定路径 `dist/content.js`。它**不**经过 `@crxjs/vite-plugin` 管理，因为 CRXJS 的 content loader（dynamic `import()` + `onExecute` HMR 包装）与 `chrome.scripting.registerContentScripts` 不兼容——后者只接受 classic（非 ES module）脚本。`npm run build` 串行执行两次 build（主扩展 + content bundle）。
- Service Worker 仅在 `enabled && apiKey` 时用 `chrome.scripting.registerContentScripts` 注册 `content.js`（匹配 `<all_urls>`、`document_idle`），否则 `unregisterContentScripts`。
- 设置页提供「启用嘴替」开关；Popup/Settings 在无 Key 或未启用时显示引导文案。
- Content Script 监听 `chrome.storage.onChanged`：`enabled = false` 或 `apiKey` 清空时立即清理 UI 并解绑事件。

## Consequences

### Positive

* 默认不注入，降低隐私顾虑，提升用户信任。
* 关闭后立即失效，用户对扩展的运行边界有强控制感。
* 资源按需消耗，宿主页面性能影响最小化。

### Negative

* 增加状态同步复杂度：SW、Settings、Popup、已注入 Content 之间需围绕 `enabled` + `apiKey` 协同。
* 需要可靠的 storage 变更监听与事件解绑，否则出现"已关闭但仍在响应选区"的脏状态。
* 迁移逻辑需要为老用户兜底，避免已可用功能无声退化。
* Content script 必须用独立 build（IIFE + inlineDynamicImports），CRXJS 的 HMR/loader 不能用；shared 模块在 content bundle 中重复打包（可接受，content 是该 bundle 唯一消费者）。
* Dev 模式下 content script 无 HMR（独立 build），改动需重新 build + 刷新扩展。

## Alternatives Considered

* **维持静态 `content_scripts`**：实现简单，但无法满足隐私与按需控制诉求，且未来增加域名白名单等能力时仍需迁移。
* **基于 host_permissions 的清单过滤**：颗粒度只到域名，无法表达"启用开关"这一用户意图；且权限提示更激进。
* **declarativeContent + action**：适合基于页面状态控制 action，不能替代内容脚本的按需注入。

## References

* PRD-0000 `docs/prd/PRD-0000-chrome-extension-optimization.md`
* Issue #6 — `[PRD-0000] 动态 Content Script 注册`
* [chrome.scripting - Chrome Developers](https://developer.chrome.com/docs/extensions/reference/api/scripting)
* CONTEXT.md — `enabled`、动态注册
