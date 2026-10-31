// Pure helpers shared by the app and scripts/self-check.mjs. Plain JS on purpose.

/** "S01", "S02", ... "S123" */
export function formatShotCode(index) {
  return "S" + String(index + 1).padStart(2, "0");
}

/**
 * Prepend the project's locked style block to a prompt, verbatim, exactly once.
 * The style block must never be paraphrased between generations (see ai_video_production skill).
 */
export function withStyleBlock(styleBlock, prompt) {
  const style = (styleBlock || "").trim();
  const body = (prompt || "").trim();
  if (!style) return body;
  if (body.startsWith(style)) return body;
  return style + "\n\n" + body;
}

/** "sk-abc...wxyz" — safe to show in the UI. */
export function maskKey(key) {
  if (!key) return "";
  if (key.length <= 8) return "••••";
  return key.slice(0, 3) + "…" + key.slice(-4);
}

/** Veo only accepts 4, 6 or 8 second clips — snap anything else to the nearest legal value. */
export function snapVeoDuration(seconds) {
  const s = Number(seconds) || 8;
  if (s <= 5) return 4;
  if (s <= 7) return 6;
  return 8;
}

/** Split a script into rough shots when no LLM key is available (offline fallback). */
export function splitScriptOffline(script) {
  return (script || "")
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block, i) => {
      const firstLine = block.split("\n")[0].slice(0, 80);
      return { title: firstLine, prompt: block, durationSec: 8 };
    });
}
