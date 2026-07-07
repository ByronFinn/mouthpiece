import { saveSettings } from "../../shared/storage";
import type { Settings } from "../../shared/types";
import { createFormGroup, createInput, createFilterableDropdown, showToast } from "./helpers";

const LANGUAGES = [
  "中文", "English", "日本語", "한국어", "Français", "Deutsch",
  "Español", "Português", "Русский", "العربية", "ไทย",
  "Tiếng Việt", "Bahasa Indonesia", "Italiano", "Nederlands",
  "Polski", "Türkçe", "हिन्दी", "বাংলা", "فارسی",
];

export function renderGenerationSection(settings: Settings): HTMLDivElement {
  const genSection = document.createElement("div");
  genSection.innerHTML = `<h2>生成设置</h2>`;

  const modeSelect = document.createElement("select");
  const singleOpt = document.createElement("option");
  singleOpt.value = "single";
  singleOpt.textContent = "单风格（一个预设，多条回复）";
  const multiOpt = document.createElement("option");
  multiOpt.value = "multi";
  multiOpt.textContent = "多风格（多个预设，各一条回复）";
  modeSelect.appendChild(singleOpt);
  modeSelect.appendChild(multiOpt);
  modeSelect.value = settings.generationMode;
  modeSelect.addEventListener("change", async () => {
    settings.generationMode = modeSelect.value as "single" | "multi";
    await saveSettings({ generationMode: settings.generationMode });
    showToast("已保存");
  });
  genSection.appendChild(createFormGroup("生成模式", modeSelect));

  genSection.appendChild(createFormGroup("每种风格回复数", createInput("number", String(settings.repliesPerStyle), "3", async (v) => {
    const n = parseInt(v, 10);
    if (n >= 1 && n <= 10) {
      settings.repliesPerStyle = n;
      await saveSettings({ repliesPerStyle: n });
      showToast("已保存");
    }
  })));

  let langSaveTimeout: ReturnType<typeof setTimeout>;
  const langDropdown = createFilterableDropdown({
    value: settings.translationLang,
    placeholder: "中文",
    options: LANGUAGES,
    onInput: (value) => {
      clearTimeout(langSaveTimeout);
      langSaveTimeout = setTimeout(async () => {
        settings.translationLang = value;
        await saveSettings({ translationLang: value });
        showToast("已保存");
      }, 500);
    },
    onSelect: (value) => {
      settings.translationLang = value;
      saveSettings({ translationLang: value });
      showToast("已保存");
    },
    shouldHideWhen: (filter, filtered) =>
      filtered.length === 0 || (filtered.length === 1 && filtered[0] === filter),
  });

  genSection.appendChild(createFormGroup("我的语言", langDropdown.wrapper));

  const langNote = document.createElement("div");
  langNote.className = "note";
  langNote.textContent = "评论和原文会翻译成你设置的语言。如果原文已经是这个语言，则不翻译。";
  genSection.appendChild(langNote);

  return genSection;
}