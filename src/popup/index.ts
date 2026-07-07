import { loadSettings, saveSettings } from "../shared/storage";
import { PopupState } from "../settings/state";
import type { Settings } from "../shared/types";

const state = new PopupState();

(async () => {
  const settings = await loadSettings();
  state.setSettings(settings);

  // Settings button
  document.getElementById("settings-btn")!.addEventListener("click", () => {
    chrome.runtime.openOptionsPage();
  });

  render();
})();

// Live-refresh when settings change while the popup is open (e.g. user edits
// presets in the settings tab — popup updates without reopening).
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local" || !("mouthpiece_settings" in changes)) return;
  loadSettings().then((newSettings) => {
    state.setSettings(newSettings);
    render();
  });
});

function render(): void {
  const settings = state.settings;
  if (!settings) return;
  const body = document.getElementById("popup-body")!;

  if (!settings.apiKey) {
    body.innerHTML = "";
    const div = document.createElement("div");
    div.className = "no-key";
    div.textContent = "请先配置 API Key";
    const link = document.createElement("a");
    link.textContent = "打开设置";
    link.addEventListener("click", () => chrome.runtime.openOptionsPage());
    div.appendChild(document.createElement("br"));
    div.appendChild(link);
    body.appendChild(div);
    return;
  }

  if (!settings.enabled) {
    body.innerHTML = "";
    const div = document.createElement("div");
    div.className = "no-key";
    div.textContent = "嘴替未启用。在网页上选中文本后将不会显示浮动按钮。";
    const link = document.createElement("a");
    link.textContent = "打开设置启用";
    link.addEventListener("click", () => chrome.runtime.openOptionsPage());
    div.appendChild(document.createElement("br"));
    div.appendChild(link);
    body.appendChild(div);
    return;
  }

  body.innerHTML = "";

  renderPresetPicker(body, settings);
}

function renderPresetPicker(body: HTMLElement, settings: Settings): void {
  const modeLabel = document.createElement("div");
  modeLabel.className = "mode-label";
  modeLabel.textContent = settings.generationMode === "single" ? "单风格模式" : "多风格模式";
  body.appendChild(modeLabel);

  if (settings.generationMode === "single") {
    const select = document.createElement("select");
    select.className = "preset-select";

    for (const preset of settings.presets) {
      const option = document.createElement("option");
      option.value = preset.id;
      option.textContent = preset.name;
      if (settings.selectedPresetIds.includes(preset.id)) {
        option.selected = true;
      }
      select.appendChild(option);
    }

    select.addEventListener("change", async () => {
      const selected = [select.value];
      state.settings = state.settings ? { ...state.settings, selectedPresetIds: selected } : state.settings;
      await saveSettings({ selectedPresetIds: selected });
    });

    body.appendChild(select);
  } else {
    // Multi mode: checkbox list
    const ul = document.createElement("ul");
    ul.className = "checkbox-list";

    for (const preset of settings.presets) {
      const li = document.createElement("li");
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.id = `preset-${preset.id}`;
      checkbox.checked = settings.selectedPresetIds.includes(preset.id);

      const label = document.createElement("label");
      label.htmlFor = `preset-${preset.id}`;
      label.textContent = preset.name;

      checkbox.addEventListener("change", async () => {
        if (!state.settings) return;
        const current = new Set(state.settings.selectedPresetIds);
        if (checkbox.checked) current.add(preset.id);
        else current.delete(preset.id);
        const selected = Array.from(current);
        state.settings = { ...state.settings, selectedPresetIds: selected };
        await saveSettings({ selectedPresetIds: selected });
      });

      li.appendChild(checkbox);
      li.appendChild(label);
      ul.appendChild(li);
    }

    body.appendChild(ul);
  }
}
