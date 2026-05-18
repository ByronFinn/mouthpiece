import { loadSettings } from "../shared/storage";
import type { Settings, ApiResult, MultiPresetResult } from "../shared/types";

// ===== State =====
let floatingBtn: HTMLButtonElement | null = null;
let resultLayer: HTMLDivElement | null = null;
let overlay: HTMLDivElement | null = null;
let currentText = "";
let currentImages: string[] = [];
let currentRect: DOMRect | null = null;
let currentPresetId = "";
let isLoading = false;
let settings: Settings | null = null;

// ===== Init =====
(async () => {
  settings = await loadSettings();
  if (!settings.apiKey) return;

  currentPresetId = settings.selectedPresetIds[0] || "critic";
  createFloatingButton();
  document.addEventListener("mouseup", onMouseUp, { capture: true });
})();

// Listen for settings changes from popup/settings page
chrome.storage.onChanged.addListener((_changes, area) => {
  if (area === "local") {
    loadSettings().then((newSettings) => {
      settings = newSettings;
      currentPresetId = settings.selectedPresetIds[0] || "critic";
    });
  }
});

// ===== Floating Button =====
function createFloatingButton() {
  if (floatingBtn) return;
  const btn = document.createElement("button");
  btn.id = "mp-floating-btn";
  btn.textContent = "生成评论";
  btn.addEventListener("click", onFloatingBtnClick);
  document.body.appendChild(btn);
  floatingBtn = btn;
}

function showFloatingButton(rect: DOMRect) {
  if (!floatingBtn) return;
  floatingBtn.style.top = `${window.scrollY + rect.bottom + 6}px`;
  floatingBtn.style.left = `${window.scrollX + rect.right + 6}px`;
  floatingBtn.style.display = "block";
}

function hideFloatingButton() {
  if (floatingBtn) floatingBtn.style.display = "none";
}

// ===== Selection Detection =====
function onMouseUp(e: MouseEvent) {
  if (
    e.target instanceof HTMLElement &&
    (e.target.closest("#mp-floating-btn") ||
      e.target.closest("#mp-result-layer") ||
      e.target.closest("#mp-overlay"))
  ) {
    return;
  }

  const selection = window.getSelection();
  if (!selection || selection.isCollapsed) {
    hideFloatingButton();
    return;
  }

  const range = selection.getRangeAt(0);
  const rect = range.getBoundingClientRect();
  const clonedRange = range.cloneRange();

  // Extract text with emoji preserved (selection.toString() drops <img alt="...">)
  const text = extractTextWithEmoji(clonedRange).trim();
  if (text.length < 2) {
    hideFloatingButton();
    return;
  }

  currentText = text;
  currentImages = extractImages(clonedRange);
  currentRect = rect;

  showFloatingButton(rect);
}

// ===== Text Extraction with Emoji =====
function extractTextWithEmoji(range: Range): string {
  const fragment = range.cloneContents();
  return fragmentToText(fragment);
}

function fragmentToText(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) {
    return node.textContent || "";
  }
  if (node.nodeType === Node.ELEMENT_NODE) {
    const el = node as HTMLElement;
    const tag = el.tagName.toLowerCase();
    // Convert <img> with alt text back to text (handles emoji rendered as <img>)
    if (tag === "img") {
      const alt = el.getAttribute("alt");
      if (alt) return alt;
      return "";
    }
    // Recurse into children
    let result = "";
    for (const child of Array.from(node.childNodes)) {
      result += fragmentToText(child);
    }
    // Preserve line breaks
    if (tag === "br" || tag === "p" || tag === "div") {
      result += "\n";
    }
    return result;
  }
  return "";
}

// ===== Image Extraction =====
function isEmojiImage(img: HTMLImageElement): boolean {
  // Small size (emoji are typically ≤ 72px)
  const w = img.naturalWidth || parseInt(img.getAttribute("width") || "0", 10);
  const h = img.naturalHeight || parseInt(img.getAttribute("height") || "0", 10);
  if (w > 0 && h > 0 && w <= 72 && h <= 72) return true;

  // Class-based detection (twemoji, emoji, emojione, etc.)
  const cls = (img.className || "").toLowerCase();
  if (/emoji|twemoji|emojione|emoji-/.test(cls)) return true;

  // alt contains emoji unicode characters
  const alt = img.getAttribute("alt") || "";
  if (alt && /\p{Emoji_Presentation}/u.test(alt)) return true;

  // Known emoji CDN paths
  const src = img.src || "";
  if (/twemoji|emoji|emojione|openmoji/i.test(src)) return true;

  return false;
}

function extractImages(range: Range): string[] {
  const images: string[] = [];
  const fragment = range.cloneContents();
  const imgElements = fragment.querySelectorAll("img");

  const MAX_IMAGES = 9;

  for (let i = 0; i < imgElements.length; i++) {
    const img = imgElements[i];
    if (isEmojiImage(img)) continue; // Skip emoji
    const src = img.src;
    if (!src) continue;

    try {
      images.push(src);
    } catch {
      continue;
    }

    if (images.length >= MAX_IMAGES) break;
  }

  return images;
}

async function convertImagesToBase64(imageSrcs: string[]): Promise<string[]> {
  const result: string[] = [];
  const MAX_SIZE = 5 * 1024 * 1024;

  for (const src of imageSrcs) {
    try {
      const dataUrl = await imageToDataURL(src);
      if (dataUrl && dataUrl.length < MAX_SIZE) {
        result.push(dataUrl);
      }
    } catch {
      // Skip images that fail
    }
  }

  return result;
}

function imageToDataURL(src: string): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext("2d");
        if (!ctx) { resolve(""); return; }
        ctx.drawImage(img, 0, 0);
        const dataUrl = canvas.toDataURL("image/png");
        resolve(dataUrl);
      } catch {
        resolve("");
      }
    };
    img.onerror = () => resolve("");
    img.src = src;
  });
}

// ===== Floating Button Click =====
async function onFloatingBtnClick(e: MouseEvent) {
  e.stopPropagation();
  hideFloatingButton();
  showResultLayer();
  await generateComments();
}

// ===== Result Layer =====
function showResultLayer() {
  // Remove existing
  onCloseLayer();

  // Create overlay
  overlay = document.createElement("div");
  overlay.id = "mp-overlay";
  overlay.addEventListener("click", onCloseLayer);

  // Create result layer
  resultLayer = document.createElement("div");
  resultLayer.id = "mp-result-layer";

  // Header
  const header = document.createElement("div");
  header.id = "mp-layer-header";

  const isMulti = settings?.generationMode === "multi";

  if (isMulti) {
    // Show summary instead of dropdown in multi mode
    const summary = document.createElement("span");
    summary.id = "mp-style-summary";
    const count = settings?.selectedPresetIds.length || 0;
    summary.textContent = `${count} 种风格`;
    header.appendChild(summary);
  } else {
    const select = document.createElement("select");
    select.id = "mp-style-select";
    if (settings) {
      for (const preset of settings.presets) {
        const option = document.createElement("option");
        option.value = preset.id;
        option.textContent = preset.name;
        if (preset.id === currentPresetId) option.selected = true;
        select.appendChild(option);
      }
    }
    select.addEventListener("change", (e) => {
      currentPresetId = (e.target as HTMLSelectElement).value;
      generateComments();
    });
    header.appendChild(select);
  }

  const closeBtn = document.createElement("button");
  closeBtn.id = "mp-close-btn";
  closeBtn.textContent = "×";
  closeBtn.addEventListener("click", onCloseLayer);

  header.appendChild(closeBtn);

  // Body
  const body = document.createElement("div");
  body.id = "mp-layer-body";
  body.appendChild(createLoadingEl());

  // Footer
  const footer = document.createElement("div");
  footer.id = "mp-layer-footer";
  const regenBtn = document.createElement("button");
  regenBtn.id = "mp-regenerate-btn";
  regenBtn.textContent = "换一批";
  regenBtn.disabled = true;
  regenBtn.addEventListener("click", () => generateComments());
  footer.appendChild(regenBtn);

  resultLayer.appendChild(header);
  resultLayer.appendChild(body);
  resultLayer.appendChild(footer);

  // Position near selection
  if (currentRect) {
    const top = window.scrollY + currentRect.bottom + 10;
    const left = Math.min(
      window.scrollX + currentRect.right - 380,
      window.scrollX + window.innerWidth - 400
    );
    resultLayer.style.top = `${Math.max(top, window.scrollY + 10)}px`;
    resultLayer.style.left = `${Math.max(left, window.scrollX + 10)}px`;
  }

  document.body.appendChild(overlay);
  document.body.appendChild(resultLayer);

  overlay.classList.add("visible");
  resultLayer.classList.add("visible");
}

function createLoadingEl(): HTMLDivElement {
  const div = document.createElement("div");
  div.className = "mp-loading";
  const spinner = document.createElement("div");
  spinner.className = "mp-loading-spinner";
  const text = document.createElement("div");
  text.textContent = "生成中...";
  div.appendChild(spinner);
  div.appendChild(text);
  return div;
}

function onCloseLayer() {
  if (resultLayer) {
    resultLayer.remove();
    resultLayer = null;
  }
  if (overlay) {
    overlay.remove();
    overlay = null;
  }
}

// ===== Generate =====
async function generateComments() {
  if (isLoading || !resultLayer) return;
  isLoading = true;

  const body = resultLayer.querySelector("#mp-layer-body") as HTMLDivElement;
  const regenBtn = resultLayer.querySelector("#mp-regenerate-btn") as HTMLButtonElement;
  const closeBtn = resultLayer.querySelector("#mp-close-btn") as HTMLButtonElement;
  const styleSelect = resultLayer.querySelector("#mp-style-select") as HTMLSelectElement;

  // Show loading
  body.innerHTML = "";
  body.appendChild(createLoadingEl());
  regenBtn.disabled = true;
  closeBtn.style.pointerEvents = "none";
  if (styleSelect) styleSelect.disabled = true;

  if (styleSelect) {
    currentPresetId = styleSelect.value;
  }

  const isMulti = settings?.generationMode === "multi";

  try {
    // Convert images to base64
    const base64Images = await convertImagesToBase64(currentImages);

    const response = await chrome.runtime.sendMessage({
      type: "generate",
      text: currentText,
      images: base64Images,
      presetIds: isMulti ? settings!.selectedPresetIds : [currentPresetId],
      generationMode: isMulti ? "multi" : "single",
    });

    if (!response.ok) {
      renderError(body, response.error || "生成失败");
    } else if (isMulti && response.multiData) {
      renderMultiComments(body, response.multiData);
    } else if (!isMulti && response.data?.comments?.length) {
      renderComments(body, response.data);
    } else {
      renderError(body, "没有生成评论");
    }
  } catch (err: any) {
    renderError(body, `请求失败：${err.message}`);
  } finally {
    isLoading = false;
    regenBtn.disabled = false;
    closeBtn.style.pointerEvents = "";
    if (styleSelect) styleSelect.disabled = false;
  }
}

function renderComments(body: HTMLDivElement, data: ApiResult) {
  body.innerHTML = "";

  // Show original translation if needed
  if (data.translation) {
    const transDiv = document.createElement("div");
    transDiv.className = "mp-translation";
    transDiv.textContent = data.translation;
    body.appendChild(transDiv);
  }

  // Comment cards
  for (const comment of data.comments) {
    const card = createCommentCard(comment.content, comment.translation);
    body.appendChild(card);
  }
}

function renderMultiComments(body: HTMLDivElement, multiData: MultiPresetResult[]) {
  body.innerHTML = "";

  for (const group of multiData) {
    // Preset name header
    const header = document.createElement("div");
    header.className = "mp-preset-header";
    header.textContent = group.presetName;
    body.appendChild(header);

    // Show translation from first group that has one
    if (group.result.translation) {
      const transDiv = document.createElement("div");
      transDiv.className = "mp-translation";
      transDiv.textContent = group.result.translation;
      body.appendChild(transDiv);
    }

    // Comment cards
    for (const comment of group.result.comments) {
      const card = createCommentCard(comment.content, comment.translation);
      body.appendChild(card);
    }
  }
}

function createCommentCard(content: string, translation: string | null): HTMLDivElement {
  const card = document.createElement("div");
  card.className = "mp-comment-card";

  if (translation) {
    const contentRow = createCommentRow(content);
    const transRow = createCommentRow(translation, true);
    card.appendChild(contentRow);
    card.appendChild(transRow);
  } else {
    const contentRow = createCommentRow(content);
    card.appendChild(contentRow);
  }

  return card;
}

function createCommentRow(text: string, isTranslation = false): HTMLDivElement {
  const row = document.createElement("div");
  row.className = "mp-comment-row" + (isTranslation ? " mp-comment-trans" : "");

  const span = document.createElement("span");
  span.className = "mp-comment-text";
  span.textContent = text;

  const copyBtn = document.createElement("button");
  copyBtn.className = "mp-copy-btn";
  copyBtn.textContent = "复制";
  copyBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    navigator.clipboard.writeText(text).then(() => {
      copyBtn.textContent = "已复制 ✓";
      copyBtn.classList.add("copied");
      setTimeout(() => {
        copyBtn.textContent = "复制";
        copyBtn.classList.remove("copied");
      }, 1500);
    });
  });

  row.appendChild(span);
  row.appendChild(copyBtn);
  return row;
}

function renderError(body: HTMLDivElement, message: string) {
  body.innerHTML = "";
  const div = document.createElement("div");
  div.className = "mp-error";

  const msg = document.createElement("div");
  msg.textContent = message;

  const retryBtn = document.createElement("button");
  retryBtn.className = "mp-retry-btn";
  retryBtn.textContent = "重试";
  retryBtn.addEventListener("click", () => generateComments());

  div.appendChild(msg);
  div.appendChild(retryBtn);
  body.appendChild(div);
}
