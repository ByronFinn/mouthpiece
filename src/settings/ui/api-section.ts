import { fetchModels, testConnection } from "../../shared/api";
import { saveSettings } from "../../shared/storage";
import type { Settings } from "../../shared/types";
import { createFormGroup, createInput, showToast } from "./helpers";

export function renderApiSection(settings: Settings): HTMLDivElement {
  const apiSection = document.createElement("div");
  apiSection.innerHTML = `<h2>API 配置</h2>`;

  apiSection.appendChild(createFormGroup("API Key", createInput("password", settings.apiKey, "sk-...", async (v) => {
    settings.apiKey = v;
    await saveSettings({ apiKey: v });
    showToast("已保存");
  })));

  apiSection.appendChild(createFormGroup("Base URL", createInput("text", settings.baseUrl, "https://api.openai.com/v1", async (v) => {
    settings.baseUrl = v;
    await saveSettings({ baseUrl: v });
    showToast("已保存");
  })));

  let cachedModels: string[] = [];

  const modelWrapper = document.createElement("div");
  modelWrapper.className = "model-dropdown";

  const modelInput = document.createElement("input");
  modelInput.type = "text";
  modelInput.value = settings.model;
  modelInput.placeholder = "gpt-4o";

  const dropdownList = document.createElement("div");
  dropdownList.className = "model-dropdown-list";

  function renderModelDropdown(filter: string) {
    dropdownList.innerHTML = "";
    if (cachedModels.length === 0) { dropdownList.classList.remove("open"); return; }
    const q = filter.toLowerCase();
    const filtered = cachedModels.filter((m) => m.toLowerCase().includes(q));
    if (filtered.length === 0) { dropdownList.classList.remove("open"); return; }
    for (const id of filtered) {
      const opt = document.createElement("div");
      opt.className = "model-option";
      if (id === modelInput.value) opt.classList.add("active");
      opt.textContent = id;
      opt.addEventListener("mousedown", (e) => {
        e.preventDefault();
        modelInput.value = id;
        settings.model = id;
        saveSettings({ model: id });
        showToast("已保存");
        dropdownList.classList.remove("open");
      });
      dropdownList.appendChild(opt);
    }
    dropdownList.classList.add("open");
  }

  let modelSaveTimeout: ReturnType<typeof setTimeout>;
  modelInput.addEventListener("input", () => {
    clearTimeout(modelSaveTimeout);
    modelSaveTimeout = setTimeout(async () => {
      settings.model = modelInput.value;
      await saveSettings({ model: modelInput.value });
      showToast("已保存");
    }, 500);
    renderModelDropdown(modelInput.value);
  });
  modelInput.addEventListener("focus", () => renderModelDropdown(modelInput.value));
  modelInput.addEventListener("blur", () => dropdownList.classList.remove("open"));

  modelWrapper.appendChild(modelInput);
  modelWrapper.appendChild(dropdownList);
  apiSection.appendChild(createFormGroup("模型", modelWrapper));

  const btnRow = document.createElement("div");
  btnRow.className = "btn-row";

  const fetchBtn = document.createElement("button");
  fetchBtn.className = "btn btn-primary btn-sm";
  fetchBtn.textContent = "获取模型";

  const testBtn = document.createElement("button");
  testBtn.className = "btn btn-ghost btn-sm";
  testBtn.textContent = "测试连接";

  const errorDiv = document.createElement("div");
  errorDiv.className = "inline-error";
  errorDiv.style.display = "none";

  function clearError() { errorDiv.style.display = "none"; errorDiv.textContent = ""; }
  function showError(msg: string) { errorDiv.textContent = msg; errorDiv.style.display = "block"; }

  fetchBtn.addEventListener("click", async () => {
    clearError();
    fetchBtn.disabled = true;
    fetchBtn.textContent = "获取中...";
    const result = await fetchModels(settings);
    if (!result.ok) {
      showError(result.error);
    } else {
      cachedModels = result.models;
      showToast(`已获取 ${cachedModels.length} 个模型`);
      renderModelDropdown(modelInput.value);
    }
    fetchBtn.disabled = false;
    fetchBtn.textContent = "获取模型";
  });

  testBtn.addEventListener("click", async () => {
    clearError();
    testBtn.disabled = true;
    testBtn.textContent = "测试中...";
    const result = await testConnection(settings);
    if (!result.ok) {
      showError(result.error);
    } else {
      showToast("连接成功");
    }
    testBtn.disabled = false;
    testBtn.textContent = "测试连接";
  });

  btnRow.appendChild(fetchBtn);
  btnRow.appendChild(testBtn);
  apiSection.appendChild(btnRow);
  apiSection.appendChild(errorDiv);

  return apiSection;
}