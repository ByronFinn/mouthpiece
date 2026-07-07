export interface Preset {
  id: string;
  name: string;
  systemPrompt: string;
  builtIn: boolean;
  originalPrompt?: string; // for built-in presets, the original system prompt for restore
}

export type GenerationMode = "single" | "multi";

export interface Settings {
  apiKey: string;
  baseUrl: string;
  model: string;
  translationLang: string;
  generationMode: GenerationMode;
  repliesPerStyle: number;
  presets: Preset[];
  selectedPresetIds: string[];
}

export interface Comment {
  content: string;
  translation: string | null;
}

export interface ApiResult {
  translation: string | null;
  comments: Comment[];
}

export interface GenerateRequest {
  type: "generate";
  text: string;
  images: string[]; // base64 data URLs
  presetIds: string[];
  generationMode: "single" | "multi";
}

export interface MultiPresetResult {
  presetId: string;
  presetName: string;
  result: ApiResult;
}

/**
 * Discriminated union over `ok`. Constructors must set exactly one of the
 * success payloads (`data` for single-mode, `multiData` for multi-mode);
 * consumers narrow with `"multiData" in response` after checking `ok`.
 */
export type GenerateResponse =
  | { ok: true; status: number; data: ApiResult }
  | { ok: true; status: number; multiData: MultiPresetResult[] }
  | { ok: false; status: number; error: string };

/** Type guard: narrows a GenerateResponse to its failure variant. */
export function isFailedResponse(r: GenerateResponse): r is Extract<GenerateResponse, { ok: false }> {
  return !r.ok;
}
