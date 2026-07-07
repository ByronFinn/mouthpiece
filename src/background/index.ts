import { loadSettings } from "../shared/storage";
import { callWithImageFallback } from "../shared/api";
import { errorFromResponse, GENERATION_FAILED_PREFIX, UNKNOWN_ERROR } from "../shared/errors";
import { syncContentScriptRegistration } from "./registration";
import { startRequest, completeRequest, abortCurrent } from "./lifecycle";
import type { GenerateRequest, GenerateResponse, MultiPresetResult, Settings } from "../shared/types";

// SW startup: sync registration to current enabled/apiKey state.
syncContentScriptRegistration().catch((err: unknown) => {
  console.error("[mouthpiece] content-script sync failed:", err);
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local") return;
  if (!("mouthpiece_settings" in changes)) return;

  // Disabled or key cleared → abort any in-flight request immediately.
  const next = changes.mouthpiece_settings?.newValue as Partial<Settings> | undefined;
  if (next && (!next.enabled || !next.apiKey)) {
    abortCurrent();
  }

  syncContentScriptRegistration().catch((err: unknown) => {
    console.error("[mouthpiece] content-script sync failed:", err);
  });
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === "generate") {
    handleMessage(message)
      .then(sendResponse)
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : String(err);
        sendResponse({ ok: false, status: 0, error: `内部错误：${message}` });
      });
    return true;
  }
});

async function handleMessage(message: GenerateRequest): Promise<GenerateResponse> {
  const settings = await loadSettings();

  if (!settings.apiKey) {
    return { ok: false, status: 0, error: "请先在设置中配置 API Key" };
  }

  // Each generate starts a new request context — aborts any prior in-flight one.
  const controller = startRequest();
  const signal = controller.signal;

  try {
    if (message.generationMode === "multi") {
      return await handleMultiMode(settings, message.text, message.images, message.presetIds, signal);
    }
    return await handleSingleMode(settings, message.text, message.images, message.presetIds[0], signal);
  } finally {
    completeRequest();
  }
}

async function handleSingleMode(
  settings: Settings,
  text: string,
  images: string[],
  presetId: string,
  signal: AbortSignal
): Promise<GenerateResponse> {
  return callWithImageFallback(settings, text, images, presetId, signal);
}

async function handleMultiMode(
  settings: Settings,
  text: string,
  images: string[],
  presetIds: string[],
  signal: AbortSignal
): Promise<GenerateResponse> {
  const results = await Promise.all(
    presetIds.map(async (presetId) => {
      const preset = settings.presets.find((p) => p.id === presetId);
      const presetName = preset ? preset.name : presetId;

      try {
        const response = await callWithImageFallback(settings, text, images, presetId, signal);

        if (!response.ok) {
          return {
            presetId,
            presetName,
            result: {
              translation: null,
              comments: [{ content: errorFromResponse(response), translation: null }],
            },
          } as MultiPresetResult;
        }

        // response.ok narrowed; single-mode variant carries `data`.
        const result = "data" in response ? response.data : { translation: null, comments: [] };
        return {
          presetId,
          presetName,
          result,
        } as MultiPresetResult;
      } catch (err: unknown) {
        // Aborted by a newer request or a disable — surface a cancelled comment.
        if (err instanceof DOMException && err.name === "AbortError") {
          return {
            presetId,
            presetName,
            result: { translation: null, comments: [{ content: "已取消", translation: null }] },
          } as MultiPresetResult;
        }
        const message = err instanceof Error ? err.message : String(err);
        return {
          presetId,
          presetName,
          result: {
            translation: null,
            comments: [{ content: `${GENERATION_FAILED_PREFIX}${message || UNKNOWN_ERROR}`, translation: null }],
          },
        } as MultiPresetResult;
      }
    })
  );

  return { ok: true, status: 200, multiData: results };
}
