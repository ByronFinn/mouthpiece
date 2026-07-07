import contentCss from "../content.css?inline";

const HOST_ID = "mp-shadow-host";

let host: HTMLDivElement | null = null;
let root: ShadowRoot | null = null;

/**
 * Lazily creates the Shadow DOM host and returns its shadow root. All Mouthpiece
 * UI (floating button, result layer, overlay) mounts inside this shadow root so
 * the host page's CSS cannot leak in.
 *
 * The CSS is injected via Vite's `?inline` import as a string and attached to
 * the shadow root — keeping styling bundled with the JS payload that the
 * Service Worker dynamically registers (no separate css file in manifest).
 */
export function getShadowRoot(): ShadowRoot {
  if (host && root) return root;

  host = document.createElement("div");
  host.id = HOST_ID;
  // The host itself carries no styles — everything lives in the shadow root.
  host.style.all = "initial";
  document.body.appendChild(host);

  root = host.attachShadow({ mode: "open" });

  const style = document.createElement("style");
  style.textContent = contentCss;
  root.appendChild(style);

  return root;
}

/** Remove the shadow host (and all its UI) from the document. */
export function destroyShadowHost(): void {
  if (host) {
    host.remove();
    host = null;
    root = null;
  }
}
