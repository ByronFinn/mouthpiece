const MAX_IMAGES = 9;
const MAX_SIZE = 5 * 1024 * 1024;

function isEmojiImage(img: HTMLImageElement): boolean {
  const w = img.naturalWidth || parseInt(img.getAttribute("width") || "0", 10);
  const h = img.naturalHeight || parseInt(img.getAttribute("height") || "0", 10);
  if (w > 0 && h > 0 && w <= 72 && h <= 72) return true;

  const cls = (img.className || "").toLowerCase();
  if (/emoji|twemoji|emojione|emoji-/.test(cls)) return true;

  const alt = img.getAttribute("alt") || "";
  if (alt && /\p{Emoji_Presentation}/u.test(alt)) return true;

  const src = img.src || "";
  if (/twemoji|emoji|emojione|openmoji/i.test(src)) return true;

  return false;
}

export function extractImages(range: Range): string[] {
  const images: string[] = [];
  const fragment = range.cloneContents();
  const imgElements = fragment.querySelectorAll("img");

  for (let i = 0; i < imgElements.length; i++) {
    const img = imgElements[i];
    if (isEmojiImage(img)) continue;
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

export async function convertImagesToBase64(imageSrcs: string[]): Promise<string[]> {
  const result: string[] = [];

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
        resolve(canvas.toDataURL("image/png"));
      } catch {
        resolve("");
      }
    };
    img.onerror = () => resolve("");
    img.src = src;
  });
}