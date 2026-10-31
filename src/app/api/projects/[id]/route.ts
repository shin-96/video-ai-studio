import { readDb, writeDb } from "@/lib/store";
import { err } from "@/lib/refs";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  const { id } = await params;
  const db = await readDb();
  const project = db.projects.find((p) => p.id === id);
  if (!project) return Response.json({ error: "Không thấy project." }, { status: 404 });
  return Response.json({
    project,
    assets: db.assets.filter((a) => a.projectId === id),
    shots: db.shots.filter((s) => s.projectId === id),
  });
}

export async function PATCH(req: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    const patch = await req.json();
    const db = await readDb();
    const project = db.projects.find((p) => p.id === id);
    if (!project) throw new Error("Không thấy project.");
    if (patch.name !== undefined) project.name = patch.name;
    if (patch.description !== undefined) project.description = patch.description;
    if (patch.styleBlock !== undefined) project.styleBlock = patch.styleBlock;
    if (patch.aspectRatio !== undefined) project.aspectRatio = patch.aspectRatio;
    if (patch.canvas !== undefined) project.canvas = patch.canvas;
    project.updatedAt = new Date().toISOString();
    await writeDb(db);
    return Response.json({ project });
  } catch (e) { return err(e); }
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const { id } = await params;
  const db = await readDb();
  db.projects = db.projects.filter((p) => p.id !== id);
  db.assets = db.assets.filter((a) => a.projectId !== id);
  db.shots = db.shots.filter((s) => s.projectId !== id);
  await writeDb(db);
  return Response.json({ ok: true });
}
