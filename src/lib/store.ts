import { promises as fs } from "fs";
import path from "path";
import crypto from "crypto";
import type { Db, Project, Settings } from "./types";
import { formatShotCode } from "./pure.js";

// shortcut: single JSON file as the DB. Fine for a personal, single-user studio;
// upgrade to SQLite/Postgres when this ever becomes multi-user.

const ROOT = process.cwd();
const DATA_DIR = path.join(ROOT, "data");
const DB_FILE = path.join(DATA_DIR, "db.json");
const SETTINGS_FILE = path.join(DATA_DIR, "settings.json");
export const MEDIA_DIR = path.join(ROOT, "public", "media");

export const id = () => crypto.randomUUID().slice(0, 12);
const now = () => new Date().toISOString();

async function readJson<T>(file: string, fallback: T): Promise<T> {
  try { return JSON.parse(await fs.readFile(file, "utf8")) as T; }
  catch { return fallback; }
}

export async function readDb(): Promise<Db> {
  return readJson<Db>(DB_FILE, { projects: [], assets: [], shots: [] });
}

export async function writeDb(db: Db): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(DB_FILE, JSON.stringify(db, null, 2));
}

export async function getSettings(): Promise<Settings> {
  const saved = await readJson<Partial<Settings>>(SETTINGS_FILE, {});
  return {
    openaiApiKey: saved.openaiApiKey || process.env.OPENAI_API_KEY || "",
    geminiApiKey: saved.geminiApiKey || process.env.GEMINI_API_KEY || "",
    openaiChatModel: saved.openaiChatModel || process.env.OPENAI_CHAT_MODEL || "gpt-5",
    openaiImageModel: saved.openaiImageModel || process.env.OPENAI_IMAGE_MODEL || "gpt-image-2.5-flare",
    openaiTtsModel: saved.openaiTtsModel || process.env.OPENAI_TTS_MODEL || "gpt-4o-mini-tts",
    geminiChatModel: saved.geminiChatModel || process.env.GEMINI_CHAT_MODEL || "gemini-flash-latest",
    geminiImageModel: saved.geminiImageModel || process.env.GEMINI_IMAGE_MODEL || "gemini-3.1-flash-image",
    geminiVideoModel: saved.geminiVideoModel || process.env.GEMINI_VIDEO_MODEL || "veo-3.1-generate-preview",
  };
}

export async function saveSettings(patch: Partial<Settings>): Promise<Settings> {
  const current = await readJson<Partial<Settings>>(SETTINGS_FILE, {});
  const next = { ...current, ...patch };
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(SETTINGS_FILE, JSON.stringify(next, null, 2));
  return getSettings();
}

/** Save a generated/uploaded file and return its public URL. */
export async function saveMedia(projectId: string, filename: string, data: Buffer): Promise<string> {
  const dir = path.join(MEDIA_DIR, projectId);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, filename), data);
  return `/media/${projectId}/${filename}`;
}

export function defaultCanvas(): Project["canvas"] {
  const n = (nid: string, kind: string, label: string, x: number, y: number, extra = {}) => ({
    id: nid, type: "studio", position: { x, y }, data: { label, kind, provider: "gemini" as const, ...extra },
  });
  const nodes = [
    n("upload", "upload", "Tải lên", 0, 120),
    n("char", "character", "Vai trò — sheet nhân vật", 260, 40),
    n("env", "environment", "Môi trường — bối cảnh", 260, 260),
    n("shot-1", "shot", "S01", 560, 0, { prompt: "", durationSec: 8 }),
    n("shot-2", "shot", "S02", 560, 190, { prompt: "", durationSec: 8 }),
    n("shot-3", "shot", "S03", 560, 380, { prompt: "", durationSec: 8 }),
    n("cover", "cover", "Bìa (封面)", 880, 90),
    n("final", "final", "Phim hoàn chỉnh", 880, 300),
  ];
  const edges = [
    { id: "e1", source: "upload", target: "char" },
    { id: "e2", source: "char", target: "shot-1" },
    { id: "e3", source: "char", target: "shot-2" },
    { id: "e4", source: "char", target: "shot-3" },
    { id: "e5", source: "env", target: "shot-1" },
    { id: "e6", source: "env", target: "shot-2" },
    { id: "e7", source: "env", target: "shot-3" },
    { id: "e8", source: "shot-1", target: "final" },
    { id: "e9", source: "shot-2", target: "final" },
    { id: "e10", source: "shot-3", target: "final" },
    { id: "e11", source: "shot-1", target: "cover" },
  ];
  return { nodes, edges };
}

export async function createProject(name: string, description: string, styleBlock: string): Promise<Project> {
  const db = await readDb();
  const project: Project = {
    id: id(), name, description, styleBlock,
    aspectRatio: "16:9",
    canvas: defaultCanvas(),
    createdAt: now(), updatedAt: now(),
  };
  // Seed the three starter shots to match the canvas nodes.
  for (let i = 0; i < 3; i++) {
    db.shots.push({
      id: id(), projectId: project.id, code: formatShotCode(i),
      title: "", prompt: "", durationSec: 8, createdAt: now(),
    });
  }
  db.projects.push(project);
  await writeDb(db);
  return project;
}
