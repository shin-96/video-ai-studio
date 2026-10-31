import { readDb, writeDb, id as newId, saveMedia } from "@/lib/store";
import { generateVideo } from "@/lib/providers";
import { loadRefImages, err } from "@/lib/refs";
import { withStyleBlock } from "@/lib/pure.js";
import type { Asset } from "@/lib/types";

export const maxDuration = 300;

export async function POST(req: Request) {
  try {
    const { projectId, prompt, provider = "gemini", shotId, durationSec = 8, firstFrameAssetId, referenceAssetIds = [] } = await req.json();
    if (!projectId || !prompt?.trim()) throw new Error("Thiếu project hoặc prompt.");
    const db = await readDb();
    const project = db.projects.find((p) => p.id === projectId);
    if (!project) throw new Error("Không thấy project.");
    const refs = await loadRefImages(referenceAssetIds);
    const firstFrames = firstFrameAssetId ? await loadRefImages([firstFrameAssetId]) : [];
    const fullPrompt = withStyleBlock(project.styleBlock, prompt);
    const { buffer, mime } = await generateVideo(provider, fullPrompt, {
      durationSec, aspectRatio: project.aspectRatio,
      firstFrame: firstFrames[0], refs,
    });
    const url = await saveMedia(projectId, `${Date.now()}-${newId()}.mp4`, buffer);
    const asset: Asset = {
      id: newId(), projectId, kind: "video",
      name: prompt.slice(0, 60), url, mime,
      source: provider, prompt: fullPrompt, shotId,
      createdAt: new Date().toISOString(),
    };
    db.assets.push(asset);
    // Auto-select as the shot's current version if none selected yet (all versions stay in the library).
    if (shotId) {
      const shot = db.shots.find((s) => s.id === shotId);
      if (shot && !shot.selectedAssetId) shot.selectedAssetId = asset.id;
    }
    await writeDb(db);
    return Response.json({ asset });
  } catch (e) { return err(e); }
}
