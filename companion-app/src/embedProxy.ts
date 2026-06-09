/** Local companion bridge (Rust `import_bridge` module). */
export const IMPORT_BRIDGE_ORIGIN = "http://127.0.0.1:17321";

/**
 * Remote prod sites are wrapped in a local relay page so postMessage / fetch
 * from the iframe reaches the companion (Tauri WebView2 blocks direct parent messages).
 */
export function shouldUseEmbedProxy(targetUrl: string): boolean {
  try {
    const target = new URL(targetUrl);
    if (target.origin === IMPORT_BRIDGE_ORIGIN) return false;
    if (target.protocol === "https:") return true;
    return false;
  } catch {
    return false;
  }
}

export function wrapWithEmbedProxy(targetUrl: string): string {
  if (!shouldUseEmbedProxy(targetUrl)) return targetUrl;
  return `${IMPORT_BRIDGE_ORIGIN}/embed?url=${encodeURIComponent(targetUrl)}`;
}
