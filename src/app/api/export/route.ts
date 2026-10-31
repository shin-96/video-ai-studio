import { execFile } from "child_process";
import { promisify } from "util";
import { promises as fs } from "fs";
import path from "path";
import { readDb, writeDb, id as newId, MEDIA_DIR } from "@/lib/store";
import { err } from "@/lib/refs";
import type { Asset } from "@/lib/types";

export const maxDuration = 300;
const run = promisify(execFile);

/** Stitch the selected video version of every shot (in shot order) into one final film with ffmpeg. */
export async function POST(req: Request) {
  try {
    const { projectId } = await req.json();
    const db = await readDb();
    const project = db.projects.find((p) => p.id === projectId);
    if (!project) throw new Error("Không thấy project.");
    const shots = db.shots.filter((s) => s.projectId === projectId)
      .sort((a, b) => a.code.localeCompare(b.code));
    const files: string[] = [];
    const missing: string[] = [];
    for (const shot of shots) {
      const asset = db.assets.find((a) => a.id === shot.selectedAssetId && a.kind === "video" && a.url)
        ?? db.assets.filter((a) => a.shotId === shot.id && a.kind === "video" && a.url && !a.trashed)
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
      if (asset?.url) files.push(path.join(process.cwd(), "public", asset.url));
      else if (shot.prompt) missing.push(shot.code);
    }
    if (!files.length) throw new Error("Chưa có shot nào có video để ghép. Hãy gen video cho ít nhất 1 shot trước.");
    const dir = path.join(MEDIA_DIR, projectId);
    await fs.mkdir(dir, { recursive: true });
    const listFile = path.join(dir, `concat-${Date.now()}.txt`);
    await fs.writeFile(listFile, files.map((f) => `file '${f.replace(/'/g, "'\\''")}'`).join("\n"));
    const outName = `final-${Date.now()}.mp4`;
    const outFile = path.join(dir, outName);
    const base = ["-y", "-f", "concat", "-safe", "0", "-i", listFile];
    try {
      await run("ffmpeg", [...base, "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", outFile], { timeout: 280_000 });
    } catch {
      // Some clips have no audio track — retry video-only.
      await run("ffmpeg", [...base, "-c:v", "libx264", "-pix_fmt", "yuv420p", "-an", outFile], { timeout: 280_000 });
    }
    const asset: Asset = {
      id: newId(), projectId, kind: "final", name: "Phim hoàn chỉnh",
      url: `/media/${projectId}/${outName}`, mime: "video/mp4", source: "export",
      createdAt: new Date().toISOString(),
    };
    db.assets.push(asset);
    const finalNode = project.canvas.nodes.find((n) => n.data.kind === "final");
    if (finalNode) { finalNode.data.assetUrl = asset.url ?? undefined; finalNode.data.assetId = asset.id; }
    await writeDb(db);
    return Response.json({ asset, usedClips: files.length, missingShots: missing });
  } catch (e) { return err(e); }
}
