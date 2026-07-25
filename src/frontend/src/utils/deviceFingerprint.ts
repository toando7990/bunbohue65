// Device fingerprint — frontend-only, never sent to the backend.
// Combines stable browser Web APIs into a djb2 hash string, memoized at
// module scope so repeated calls within a session return the same value.
// SSR-safe: returns a fallback constant when running outside a browser.

const SSR_FALLBACK = "ssr-no-device";

let cachedFingerprint: string | null = null;

/**
 * djb2 string hash → unsigned 32-bit base36 string. Deterministic, no deps.
 */
function djb2(input: string): string {
  let hash = 5381;
  for (let i = 0; i < input.length; i++) {
    hash = ((hash << 5) + hash + input.charCodeAt(i)) >>> 0;
  }
  return hash.toString(36);
}

/**
 * Build a stable fingerprint from browser-only Web APIs. Returns the empty
 * string when any required API is unavailable (SSR / restricted environment).
 */
function buildFingerprint(): string {
  if (typeof navigator === "undefined" || typeof screen === "undefined") {
    return "";
  }
  const parts: string[] = [];
  try {
    parts.push(navigator.userAgent ?? "");
  } catch {
    parts.push("");
  }
  try {
    parts.push(navigator.language ?? "");
  } catch {
    parts.push("");
  }
  try {
    parts.push(String(screen.width ?? ""));
    parts.push(String(screen.height ?? ""));
    parts.push(String(screen.colorDepth ?? ""));
  } catch {
    parts.push("");
  }
  try {
    parts.push(Intl.DateTimeFormat().resolvedOptions().timeZone ?? "");
  } catch {
    parts.push("");
  }
  return djb2(parts.join("|"));
}

/**
 * Returns a stable per-session device fingerprint string. Memoized at module
 * scope. SSR-safe: returns a constant fallback when not in a browser.
 */
export function getDeviceFingerprint(): string {
  if (cachedFingerprint !== null) return cachedFingerprint;
  if (typeof window === "undefined") {
    cachedFingerprint = SSR_FALLBACK;
    return cachedFingerprint;
  }
  const fp = buildFingerprint();
  cachedFingerprint = fp === "" ? SSR_FALLBACK : fp;
  return cachedFingerprint;
}
