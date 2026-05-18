import { loadSettings } from "../shared/storage";
import { callOpenAI, sanitizeOutput } from "../shared/api";
import type { GenerateResponse, Comment, MultiPresetResult } from "../shared/types";

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === "generate") {
    handleMessage(message)
      .then(sendResponse)
      .catch((err) => {
        sendResponse({ ok: false, status: 0, error: `内部错误：${err.message}` });
      });
    return true; // async response
  }
});

async function handleMessage(message: {
  text: string;
  images: string[];
  presetIds: string[];
  generationMode: "single" | "multi";
}): Promise<GenerateResponse> {
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
  settings: any,
  text: string,
  images: string[],
  presetId: string
): Promise<GenerateResponse> {
  let response = await callOpenAI(settings, text, images, presetId);

  // If failed with images, retry without images (model may not support vision)
  if (!response.ok && images.length > 0) {
    response = await callOpenAI(settings, text, [], presetId);
  }

  if (response.ok && response.data) {
    response.data.comments = response.data.comments.map((c: Comment) => ({
      content: sanitizeOutput(c.content),
      translation: c.translation ? sanitizeOutput(c.translation) : null,
    }));
    if (response.data.translation) {
      response.data.translation = sanitizeOutput(response.data.translation);
    }
  }

  return response;
}

async function handleMultiMode(
  settings: any,
  text: string,
  images: string[],
  presetIds: string[]
): Promise<GenerateResponse> {
  const results = await Promise.all(
    presetIds.map(async (presetId) => {
      const preset = settings.presets.find((p: any) => p.id === presetId);
      const presetName = preset ? preset.name : presetId;

      try {
        let response = await callOpenAI(settings, text, images, presetId);

        // If failed with images, retry without images
        if (!response.ok && images.length > 0) {
          response = await callOpenAI(settings, text, [], presetId);
        }

        if (!response.ok) {
          return {
            presetId,
            presetName,
            result: {
              translation: null,
              comments: [{ content: `生成失败：${response.error || "未知错误"}`, translation: null }],
            },
          } as MultiPresetResult;
        }

        if (response.data) {
          response.data.comments = response.data.comments.map((c: Comment) => ({
            content: sanitizeOutput(c.content),
            translation: c.translation ? sanitizeOutput(c.translation) : null,
          }));
          if (response.data.translation) {
            response.data.translation = sanitizeOutput(response.data.translation);
          }
        }

        return {
          presetId,
          presetName,
          result: response.data || { translation: null, comments: [] },
        } as MultiPresetResult;
      } catch (err: any) {
        return {
          presetId,
          presetName,
          result: {
            translation: null,
            comments: [{ content: `生成失败：${err.message}`, translation: null }],
          },
        } as MultiPresetResult;
      }
    })
  );

  return { ok: true, status: 200, multiData: results };
}
