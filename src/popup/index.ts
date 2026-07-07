import { loadSettings, saveSettings } from "../shared/storage";
import type { Settings } from "../shared/types";

let settings: Settings;

(async () => {
  settings = await loadSettings();

  // Settings button
  document.getElementById("settings-btn")!.addEventListener("click", () => {
    chrome.runtime.openOptionsPage();
  });

  render();
})();

function render() {
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
      settings.selectedPresetIds = [select.value];
      await saveSettings({ selectedPresetIds: settings.selectedPresetIds });
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
        if (checkbox.checked) {
          if (!settings.selectedPresetIds.includes(preset.id)) {
            settings.selectedPresetIds.push(preset.id);
          }
        } else {
          settings.selectedPresetIds = settings.selectedPresetIds.filter(id => id !== preset.id);
        }
        await saveSettings({ selectedPresetIds: settings.selectedPresetIds });
      });

      li.appendChild(checkbox);
      li.appendChild(label);
      ul.appendChild(li);
    }

    body.appendChild(ul);
  }
}
