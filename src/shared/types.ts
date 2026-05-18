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

export interface GenerateResponse {
  ok: boolean;
  status: number;
  data?: ApiResult;
  multiData?: MultiPresetResult[];
  error?: string;
}
