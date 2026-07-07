import { loadSettings } from "../shared/storage";
import type { Settings } from "../shared/types";
import { renderApiSection } from "./ui/api-section";
import { renderGenerationSection } from "./ui/generation-section";
import { renderPresetsSection } from "./ui/presets-section";

let settings: Settings;
let editingPresetId: string | null = null;

(async () => {
  settings = await loadSettings();
  render();
})();

function render() {
  const container = document.getElementById("settings-content")!;
  container.innerHTML = "";

  container.appendChild(renderApiSection(settings));
  container.appendChild(renderGenerationSection(settings));
  container.appendChild(renderPresetsSection({
    settings,
    getEditingPresetId: () => editingPresetId,
    setEditingPresetId: (id) => { editingPresetId = id; },
    rerender: render,
  }));
}