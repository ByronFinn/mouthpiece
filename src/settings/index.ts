import { loadSettings } from "../shared/storage";
import { SettingsState } from "./state";
import { renderApiSection } from "./ui/api-section";
import { renderGenerationSection } from "./ui/generation-section";
import { renderPresetsSection } from "./ui/presets-section";

const state = new SettingsState();

(async () => {
  const settings = await loadSettings();
  state.setSettings(settings);
  render();
})();

function render() {
  if (!state.settings) return;
  const container = document.getElementById("settings-content")!;
  container.innerHTML = "";

  // Bind a non-null snapshot for the render closures below.
  const settings = state.settings;

  container.appendChild(renderApiSection(settings));
  container.appendChild(renderGenerationSection(settings));
  container.appendChild(renderPresetsSection({
    settings,
    getEditingPresetId: () => state.editingPresetId,
    setEditingPresetId: (id) => {
      if (id === null) state.stopEditing();
      else state.startEditing(id);
    },
    rerender: render,
  }));
}
