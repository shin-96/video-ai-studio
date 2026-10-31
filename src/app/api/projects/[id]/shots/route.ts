import { readDb, writeDb, id as newId } from "@/lib/store";
import { err } from "@/lib/refs";
import { formatShotCode } from "@/lib/pure.js";
import type { Shot } from "@/lib/types";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Ctx) {
  try {
    const { id: projectId } = await params;
    const { title = "", prompt = "", durationSec = 8 } = await req.json();
    const db = await readDb();
    const count = db.shots.filter((s) => s.projectId === projectId).length;
    const shot: Shot = {
      id: newId(), projectId, code: formatShotCode(count),
      title, prompt, durationSec, createdAt: new Date().toISOString(),
    };
    db.shots.push(shot);
    await writeDb(db);
    return Response.json({ shot });
  } catch (e) { return err(e); }
}

export async function PATCH(req: Request, { params }: Ctx) {
  try {
    const { id: projectId } = await params;
    const { shotId, ...patch } = await req.json();
    const db = await readDb();
    const shot = db.shots.find((s) => s.id === shotId && s.projectId === projectId);
    if (!shot) throw new Error("Không thấy shot.");
    Object.assign(shot, patch);
    await writeDb(db);
    return Response.json({ shot });
  } catch (e) { return err(e); }
}
