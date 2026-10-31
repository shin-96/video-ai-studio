import { readDb, createProject } from "@/lib/store";
import { err } from "@/lib/refs";

export async function GET() {
  const db = await readDb();
  return Response.json({ projects: db.projects });
}

export async function POST(req: Request) {
  try {
    const { name, description = "", styleBlock = "" } = await req.json();
    if (!name?.trim()) throw new Error("Thiếu tên project.");
    const project = await createProject(name.trim(), description, styleBlock);
    return Response.json({ project });
  } catch (e) { return err(e); }
}
