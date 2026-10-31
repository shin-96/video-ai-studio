import { readDb, writeDb, id as newId, saveMedia } from "@/lib/store";
import { generateImage } from "@/lib/providers";
import { loadRefImages, err } from "@/lib/refs";
import { withStyleBlock } from "@/lib/pure.js";
import type { Asset, AssetKind } from "@/lib/types";

export const maxDuration = 300;

export async function POST(req: Request) {
  try {
    const { projectId, prompt, provider = "gemini", kind = "image", shotId, referenceAssetIds = [] } = await req.json();
    if (!projectId || !prompt?.trim()) throw new Error("Thiếu project hoặc prompt.");
    const db = await readDb();
    const project = db.projects.find((p) => p.id === projectId);
    if (!project) throw new Error("Không thấy project.");
    const refs = await loadRefImages(referenceAssetIds);
    const fullPrompt = withStyleBlock(project.styleBlock, prompt);
    const { buffer, mime } = await generateImage(provider, fullPrompt, refs);
    const ext = mime.includes("jpeg") ? "jpg" : "png";
    const url = await saveMedia(projectId, `${Date.now()}-${newId()}.${ext}`, buffer);
    const asset: Asset = {
      id: newId(), projectId, kind: kind as AssetKind,
      name: prompt.slice(0, 60), url, mime,
      source: provider, prompt: fullPrompt, shotId,
      createdAt: new Date().toISOString(),
    };
    db.assets.push(asset);
    await writeDb(db);
    return Response.json({ asset });
  } catch (e) { return err(e); }
}
