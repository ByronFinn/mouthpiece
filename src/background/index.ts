import { loadSettings } from "../shared/storage";
import { callWithImageFallback } from "../shared/api";
import { errorFromResponse, GENERATION_FAILED_PREFIX, UNKNOWN_ERROR } from "../shared/errors";
import type { GenerateRequest, GenerateResponse, MultiPresetResult, Settings } from "../shared/types";

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

  if (message.generationMode === "multi") {
    return handleMultiMode(settings, message.text, message.images, message.presetIds);
  }

  return handleSingleMode(settings, message.text, message.images, message.presetIds[0]);
}

async function handleSingleMode(
  settings: Settings,
  text: string,
  images: string[],
  presetId: string
): Promise<GenerateResponse> {
  return callWithImageFallback(settings, text, images, presetId);
}

async function handleMultiMode(
  settings: Settings,
  text: string,
  images: string[],
  presetIds: string[]
): Promise<GenerateResponse> {
  const results = await Promise.all(
    presetIds.map(async (presetId) => {
      const preset = settings.presets.find((p) => p.id === presetId);
      const presetName = preset ? preset.name : presetId;

      try {
        const response = await callWithImageFallback(settings, text, images, presetId);

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