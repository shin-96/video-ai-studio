import { getSettings, saveSettings } from "@/lib/store";
import { maskKey } from "@/lib/pure.js";
import { err } from "@/lib/refs";

export async function GET() {
  const s = await getSettings();
  return Response.json({
    hasOpenaiKey: Boolean(s.openaiApiKey),
    hasGeminiKey: Boolean(s.geminiApiKey),
    openaiKeyMasked: maskKey(s.openaiApiKey),
    geminiKeyMasked: maskKey(s.geminiApiKey),
    openaiChatModel: s.openaiChatModel,
    openaiImageModel: s.openaiImageModel,
    openaiTtsModel: s.openaiTtsModel,
    geminiChatModel: s.geminiChatModel,
    geminiImageModel: s.geminiImageModel,
    geminiVideoModel: s.geminiVideoModel,
  });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const patch: Record<string, string> = {};
    for (const field of ["openaiChatModel", "openaiImageModel", "openaiTtsModel", "geminiChatModel", "geminiImageModel", "geminiVideoModel"]) {
      if (typeof body[field] === "string" && body[field].trim()) patch[field] = body[field].trim();
    }
    // Only overwrite a key when a new non-empty value was typed.
    if (typeof body.openaiApiKey === "string" && body.openaiApiKey.trim()) patch.openaiApiKey = body.openaiApiKey.trim();
    if (typeof body.geminiApiKey === "string" && body.geminiApiKey.trim()) patch.geminiApiKey = body.geminiApiKey.trim();
    await saveSettings(patch as never);
    return Response.json({ ok: true });
  } catch (e) { return err(e); }
}
