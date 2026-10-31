import { readDb, writeDb, id as newId, saveMedia } from "@/lib/store";
import { generateSpeech } from "@/lib/providers";
import { err } from "@/lib/refs";
import type { Asset } from "@/lib/types";

export const maxDuration = 120;

export async function POST(req: Request) {
  try {
    const { projectId, text, voice = "alloy", shotId } = await req.json();
    if (!projectId || !text?.trim()) throw new Error("Thiếu project hoặc nội dung thoại.");
    const { buffer, mime } = await generateSpeech(text, voice);
    const url = await saveMedia(projectId, `${Date.now()}-${newId()}.mp3`, buffer);
    const db = await readDb();
    const asset: Asset = {
      id: newId(), projectId, kind: "audio",
      name: text.slice(0, 60), url, mime, source: "openai", shotId,
      createdAt: new Date().toISOString(),
    };
    db.assets.push(asset);
    await writeDb(db);
    return Response.json({ asset });
  } catch (e) { return err(e); }
}
