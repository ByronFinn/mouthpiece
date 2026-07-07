import { describe, it, expect } from "vitest";
import {
  buildSystemPrompt,
  buildUserMessageText,
  BUILT_IN_PRESETS,
} from "./presets";

describe("buildSystemPrompt", () => {
  it("places static sections before variable sections", () => {
    const prompt = buildSystemPrompt(BUILT_IN_PRESETS[0].systemPrompt, "中文", 3);
    const securityIdx = prompt.indexOf("## Security");
    const personaIdx = prompt.indexOf("玩世不恭");
    const imagesIdx = prompt.indexOf("## Images");
    const languageIdx = prompt.indexOf("## Language");
    const translationIdx = prompt.indexOf("## Translation rules");
    const outputIdx = prompt.indexOf("## Output format");

    expect(securityIdx).toBeLessThan(personaIdx);
    expect(personaIdx).toBeLessThan(imagesIdx);
    expect(imagesIdx).toBeLessThan(languageIdx);
    expect(languageIdx).toBeLessThan(translationIdx);
    expect(translationIdx).toBeLessThan(outputIdx);
  });

  it("substitutes template variables", () => {
    const prompt = buildSystemPrompt("Generate {{count}} in {{translation_lang}}.", "English", 5);
    expect(prompt).toContain("Generate 5 in English.");
    expect(prompt).toContain("exactly 5 objects");
    expect(prompt).toContain("into English");
    expect(prompt).toContain("write comments in English");
  });

  it("includes image guidance and shared rules for all presets", () => {
    for (const preset of BUILT_IN_PRESETS) {
      const prompt = buildSystemPrompt(preset.systemPrompt, "中文", 2);
      expect(prompt).toContain("## Security");
      expect(prompt).toContain("## Images");
      expect(prompt).toContain("OCR");
      expect(prompt).toContain("Image-only");
      expect(prompt).toContain("## Output format");
      expect(prompt).toContain("visible image content");
      expect(prompt).toContain("exactly 2 objects");
    }
  });

  it("includes few-shot examples including images in built-in presets", () => {
    for (const preset of BUILT_IN_PRESETS) {
      expect(preset.systemPrompt).toContain("## Examples");
      expect(preset.systemPrompt).toContain("[image:");
    }
  });
});

describe("buildUserMessageText", () => {
  it("labels text-only input", () => {
    const msg = buildUserMessageText("hello world", 0);
    expect(msg).toContain("comment ON");
    expect(msg).toContain("hello world");
    expect(msg).not.toContain("image");
  });

  it("labels text + images input", () => {
    const msg = buildUserMessageText("check this", 2);
    expect(msg).toContain("text below");
    expect(msg).toContain("2 attached images");
    expect(msg).toContain("check this");
  });

  it("labels image-only input", () => {
    const msg = buildUserMessageText("", 1);
    expect(msg).toContain("1 image only");
    expect(msg).toContain("no accompanying text");
    expect(msg).not.toContain("\n\n");
  });

  it("labels multiple images without text", () => {
    const msg = buildUserMessageText("  ", 3);
    expect(msg).toContain("3 images only");
  });
});