import { readDb, writeDb } from "@/lib/store";
import { err } from "@/lib/refs";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    const patch = await req.json();
    const db = await readDb();
    const asset = db.assets.find((a) => a.id === id);
    if (!asset) throw new Error("Không thấy asset.");
    if (patch.name !== undefined) asset.name = patch.name;
    if (patch.trashed !== undefined) asset.trashed = patch.trashed;
    if (patch.kind !== undefined) asset.kind = patch.kind;
    await writeDb(db);
    // Selecting a video version for a shot
    if (patch.selectForShot) {
      const shot = db.shots.find((s) => s.id === patch.selectForShot);
      if (shot) { shot.selectedAssetId = asset.id; await writeDb(db); }
    }
    return Response.json({ asset });
  } catch (e) { return err(e); }
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const { id } = await params;
  const db = await readDb();
  db.assets = db.assets.filter((a) => a.id !== id);
  await writeDb(db);
  return Response.json({ ok: true });
}
