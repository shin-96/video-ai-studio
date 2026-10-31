import { readDb, writeDb, id as newId, saveMedia } from "@/lib/store";
import { err } from "@/lib/refs";
import type { Asset, AssetKind } from "@/lib/types";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Ctx) {
  try {
    const { id: projectId } = await params;
    const form = await req.formData();
    const file = form.get("file") as File | null;
    if (!file) throw new Error("Thiếu file.");
    const kind = (form.get("kind") as string) || "upload";
    const ext = (file.name.split(".").pop() || "bin").toLowerCase();
    const filename = `${Date.now()}-${newId()}.${ext}`;
    const url = await saveMedia(projectId, filename, Buffer.from(await file.arrayBuffer()));
    const asset: Asset = {
      id: newId(), projectId, kind: kind as AssetKind,
      name: (form.get("name") as string) || file.name,
      url, mime: file.type || "application/octet-stream",
      source: "upload", createdAt: new Date().toISOString(),
    };
    const db = await readDb();
    db.assets.push(asset);
    await writeDb(db);
    return Response.json({ asset });
  } catch (e) { return err(e); }
}
