import { readDb, writeDb, id as newId } from "@/lib/store";
import { chat } from "@/lib/providers";
import { err } from "@/lib/refs";
import { formatShotCode, splitScriptOffline } from "@/lib/pure.js";
import type { Project, Shot } from "@/lib/types";

export const maxDuration = 300;

const DIRECTOR_SYSTEM = `Bạn là TV Director trong một studio làm phim AI kiểu LibTV.
Bạn giúp viết kịch bản, bóc kịch bản thành các shot ngắn (mỗi shot 4–8 giây để gen bằng Veo),
tối ưu prompt gen ảnh/video. Trả lời bằng tiếng Việt, ngắn gọn, đi thẳng vào việc.`;

interface ShotDraft { title: string; prompt: string; durationSec: number }

function parseShotsJson(text: string): ShotDraft[] | null {
  const start = text.indexOf("[");
  const end = text.lastIndexOf("]");
  if (start < 0 || end <= start) return null;
  try {
    const arr = JSON.parse(text.slice(start, end + 1));
    if (!Array.isArray(arr)) return null;
    return arr.filter((x) => x && typeof x.prompt === "string").map((x) => ({
      title: String(x.title ?? x.prompt.slice(0, 60)),
      prompt: String(x.prompt),
      durationSec: [4, 6, 8].includes(x.durationSec) ? x.durationSec : 8,
    }));
  } catch { return null; }
}

/** Rebuild the shot nodes on the canvas from the shot list, keeping every other node. */
function rebuildShotNodes(project: Project, shots: Shot[]) {
  const kept = project.canvas.nodes.filter((n) => n.data.kind !== "shot");
  const keptEdges = project.canvas.edges.filter((e) => {
    const gone = (id: string) => !kept.some((n) => n.id === id) && id.startsWith("shot-");
    return !gone(e.source) && !gone(e.target);
  });
  const nodes = [...kept];
  const edges = [...keptEdges];
  shots.forEach((shot, i) => {
    const nodeId = `shot-${shot.id}`;
    nodes.push({
      id: nodeId, type: "studio",
      position: { x: 560, y: i * 190 },
      data: {
        label: shot.code, kind: "shot", prompt: shot.prompt,
        durationSec: shot.durationSec, provider: "gemini", shotId: shot.id,
      },
    });
    for (const src of ["char", "env"]) {
      if (kept.some((n) => n.id === src)) edges.push({ id: `e-${src}-${shot.id}`, source: src, target: nodeId });
    }
    if (kept.some((n) => n.id === "final")) edges.push({ id: `e-${shot.id}-final`, source: nodeId, target: "final" });
  });
  project.canvas = { nodes, edges };
}

export async function POST(req: Request) {
  try {
    const { projectId, mode = "chat", message = "", script = "", provider = "openai" } = await req.json();
    const db = await readDb();
    const project = db.projects.find((p) => p.id === projectId);
    if (!project) throw new Error("Không thấy project.");

    if (mode === "chat") {
      const reply = await chat(provider, DIRECTOR_SYSTEM, message);
      return Response.json({ reply });
    }

    if (mode === "breakdown") {
      const text = (script || message || "").trim();
      if (!text) throw new Error("Chưa có kịch bản để bóc.");
      let drafts: ShotDraft[] | null = null;
      let usedFallback = false;
      try {
        const raw = await chat(provider,
          DIRECTOR_SYSTEM + `\nKhi được yêu cầu bóc kịch bản, CHỈ trả về JSON array, không thêm chữ nào khác. Mỗi phần tử: {"title": "...", "prompt": "...", "durationSec": 8}. Prompt phải mô tả hình ảnh chuyển động chi tiết cho 1 shot duy nhất và tự chứa đủ thông tin nhân vật/bối cảnh.`,
          `Bóc kịch bản sau thành các shot:\n\n${text}`);
        drafts = parseShotsJson(raw);
      } catch { /* no key or LLM error -> offline fallback below */ }
      if (!drafts?.length) { drafts = splitScriptOffline(text); usedFallback = true; }
      const finalDrafts: ShotDraft[] = drafts ?? [];
      if (!finalDrafts.length) throw new Error("Không bóc được shot nào từ kịch bản này.");

      // Replace untouched starter shots; otherwise append.
      const existing = db.shots.filter((s) => s.projectId === projectId);
      const startersOnly = existing.length > 0 && existing.every((s) => !s.prompt);
      if (startersOnly) db.shots = db.shots.filter((s) => s.projectId !== projectId);
      const base = startersOnly ? 0 : existing.length;
      const shots: Shot[] = finalDrafts.map((d, i) => ({
        id: newId(), projectId, code: formatShotCode(base + i),
        title: d.title, prompt: d.prompt, durationSec: d.durationSec,
        createdAt: new Date().toISOString(),
      }));
      db.shots.push(...shots);
      const allShots = db.shots.filter((s) => s.projectId === projectId);
      rebuildShotNodes(project, allShots);
      project.updatedAt = new Date().toISOString();
      await writeDb(db);
      return Response.json({ shots, usedFallback });
    }

    throw new Error("Mode không hợp lệ.");
  } catch (e) { return err(e); }
}
