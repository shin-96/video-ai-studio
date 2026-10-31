import { promises as fs } from "fs";
import path from "path";
import { readDb } from "./store";
import type { RefImage } from "./providers";

/** Load stored assets as in-memory reference images for generation calls. */
export async function loadRefImages(assetIds: string[]): Promise<RefImage[]> {
  if (!assetIds?.length) return [];
  const db = await readDb();
  const out: RefImage[] = [];
  for (const assetId of assetIds) {
    const asset = db.assets.find((a) => a.id === assetId);
    if (!asset?.url || !asset.mime.startsWith("image/")) continue;
    const file = path.join(process.cwd(), "public", asset.url);
    out.push({ buffer: await fs.readFile(file), mime: asset.mime });
  }
  return out;
}

export const err = (e: unknown) =>
  Response.json({ error: e instanceof Error ? e.message : String(e) }, { status: 400 });
