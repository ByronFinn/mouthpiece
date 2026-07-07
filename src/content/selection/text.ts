export function extractTextWithEmoji(range: Range): string {
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
    if (tag === "img") {
      const alt = el.getAttribute("alt");
      if (alt) return alt;
      return "";
    }
    let result = "";
    for (const child of Array.from(node.childNodes)) {
      result += fragmentToText(child);
    }
    if (tag === "br" || tag === "p" || tag === "div") {
      result += "\n";
    }
    return result;
  }
  return "";
}