import { getSettings } from "./store";
import { snapVeoDuration } from "./pure.js";

// Providers are plain REST calls — no vendor SDKs to keep the repo light and
// immune to SDK breaking changes. Model names come from Settings/.env because
// both vendors retire models frequently.
//
// IMPORTANT (checked 2026-10-31): OpenAI no longer offers a video API —
// Sora 2 / sora-2-pro were shut down on 2026-09-24 with no replacement.
// Video generation therefore runs on Gemini Veo only. OpenAI covers
// chat (Director), images (GPT Image) and TTS. The generateVideo() signature
// is provider-shaped so a future OpenAI video model (or Kling/Runway)
// can be added as one more branch here without touching the canvas.

export interface RefImage { buffer: Buffer; mime: string }

const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta";

async function needKey(provider: "openai" | "gemini"): Promise<string> {
  const s = await getSettings();
  const key = provider === "openai" ? s.openaiApiKey : s.geminiApiKey;
  if (!key) throw new Error(provider === "openai"
    ? "Chưa có OPENAI_API_KEY — nhập key ở trang Settings trước."
    : "Chưa có GEMINI_API_KEY — nhập key ở trang Settings trước.");
  return key;
}

async function fail(res: Response, what: string): Promise<never> {
  const text = (await res.text()).slice(0, 600);
  throw new Error(`${what} lỗi ${res.status}: ${text}`);
}

// ---------- Images ----------

export async function generateImage(
  provider: "openai" | "gemini", prompt: string, refs: RefImage[] = [],
): Promise<{ buffer: Buffer; mime: string }> {
  const s = await getSettings();
  const key = await needKey(provider);

  if (provider === "gemini") {
    const parts: unknown[] = [{ text: prompt }];
    for (const r of refs.slice(0, 4)) {
      parts.push({ inlineData: { mimeType: r.mime, data: r.buffer.toString("base64") } });
    }
    const res = await fetch(`${GEMINI_BASE}/models/${s.geminiImageModel}:generateContent`, {
      method: "POST",
      headers: { "x-goog-api-key": key, "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ parts }], generationConfig: { responseModalities: ["TEXT", "IMAGE"] } }),
    });
    if (!res.ok) await fail(res, "Gemini gen ảnh");
    const data = await res.json();
    for (const part of data?.candidates?.[0]?.content?.parts ?? []) {
      if (part.inlineData?.data) {
        return { buffer: Buffer.from(part.inlineData.data, "base64"), mime: part.inlineData.mimeType || "image/png" };
      }
    }
    throw new Error("Gemini không trả về ảnh (model có thể không hỗ trợ xuất ảnh với prompt này).");
  }

  // OpenAI — with reference images use the edits endpoint, otherwise generations.
  if (refs.length) {
    const form = new FormData();
    form.set("model", s.openaiImageModel);
    form.set("prompt", prompt);
    refs.slice(0, 4).forEach((r, i) => {
      form.append("image[]", new Blob([new Uint8Array(r.buffer)], { type: r.mime }), `ref-${i}.png`);
    });
    const res = await fetch("https://api.openai.com/v1/images/edits", {
      method: "POST", headers: { Authorization: `Bearer ${key}` }, body: form,
    });
    if (!res.ok) await fail(res, "OpenAI sửa ảnh");
    const data = await res.json();
    return imageFromOpenAI(data);
  }
  const res = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: s.openaiImageModel, prompt, size: "1536x1024" }),
  });
  if (!res.ok) await fail(res, "OpenAI gen ảnh");
  return imageFromOpenAI(await res.json());
}

async function imageFromOpenAI(data: { data?: { b64_json?: string; url?: string }[] }): Promise<{ buffer: Buffer; mime: string }> {
  const first = data?.data?.[0];
  if (first?.b64_json) return { buffer: Buffer.from(first.b64_json, "base64"), mime: "image/png" };
  if (first?.url) {
    const r = await fetch(first.url);
    return { buffer: Buffer.from(await r.arrayBuffer()), mime: r.headers.get("content-type") || "image/png" };
  }
  throw new Error("OpenAI không trả về ảnh.");
}

// ---------- Video (Gemini Veo only — see note at top) ----------

export async function generateVideo(
  provider: "openai" | "gemini",
  prompt: string,
  opts: { durationSec?: number; aspectRatio?: string; firstFrame?: RefImage; refs?: RefImage[] } = {},
): Promise<{ buffer: Buffer; mime: string }> {
  if (provider === "openai") {
    throw new Error("OpenAI không còn API video (Sora đã tắt 24/09/2026). Hãy chọn Gemini (Veo) cho node video.");
  }
  const s = await getSettings();
  const key = await needKey("gemini");
  const instance: Record<string, unknown> = { prompt };
  if (opts.firstFrame) {
    instance.image = { bytesBase64Encoded: opts.firstFrame.buffer.toString("base64"), mimeType: opts.firstFrame.mime };
  }
  if (opts.refs?.length) {
    instance.referenceImages = opts.refs.slice(0, 3).map((r) => ({
      referenceType: "asset",
      image: { bytesBase64Encoded: r.buffer.toString("base64"), mimeType: r.mime },
    }));
  }
  const res = await fetch(`${GEMINI_BASE}/models/${s.geminiVideoModel}:predictLongRunning`, {
    method: "POST",
    headers: { "x-goog-api-key": key, "Content-Type": "application/json" },
    body: JSON.stringify({
      instances: [instance],
      parameters: { aspectRatio: opts.aspectRatio || "16:9", durationSeconds: snapVeoDuration(opts.durationSec ?? 8), sampleCount: 1 },
    }),
  });
  if (!res.ok) await fail(res, "Veo tạo job");
  const op = await res.json();
  if (!op.name) throw new Error("Veo không trả về operation name.");

  // Poll the long-running operation (Veo clips typically take 1–5 minutes).
  const deadline = Date.now() + 280_000;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 10_000));
    const poll = await fetch(`${GEMINI_BASE}/${op.name}`, { headers: { "x-goog-api-key": key } });
    if (!poll.ok) await fail(poll, "Veo poll");
    const data = await poll.json();
    if (data.error) throw new Error("Veo lỗi: " + JSON.stringify(data.error).slice(0, 400));
    if (!data.done) continue;
    const uri = data.response?.generateVideoResponse?.generatedSamples?.[0]?.video?.uri;
    if (!uri) throw new Error("Veo xong nhưng không có link video trong response.");
    const file = await fetch(uri, { headers: { "x-goog-api-key": key } });
    if (!file.ok) await fail(file, "Tải video Veo");
    return { buffer: Buffer.from(await file.arrayBuffer()), mime: "video/mp4" };
  }
  throw new Error("Veo quá 280 giây chưa xong — thử lại hoặc giảm xuống Veo Fast/Lite trong Settings.");
}

// ---------- Chat / Director ----------

export async function chat(provider: "openai" | "gemini", system: string, user: string): Promise<string> {
  const s = await getSettings();
  const key = await needKey(provider);
  if (provider === "gemini") {
    const res = await fetch(`${GEMINI_BASE}/models/${s.geminiChatModel}:generateContent`, {
      method: "POST",
      headers: { "x-goog-api-key": key, "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ parts: [{ text: user }] }],
      }),
    });
    if (!res.ok) await fail(res, "Gemini chat");
    const data = await res.json();
    return (data?.candidates?.[0]?.content?.parts ?? []).map((p: { text?: string }) => p.text ?? "").join("");
  }
  const res = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: s.openaiChatModel, instructions: system, input: user }),
  });
  if (!res.ok) await fail(res, "OpenAI chat");
  const data = await res.json();
  if (typeof data.output_text === "string") return data.output_text;
  const texts: string[] = [];
  for (const item of data.output ?? []) {
    for (const c of item.content ?? []) if (c.text) texts.push(c.text);
  }
  return texts.join("\n");
}

// ---------- TTS (OpenAI) ----------

export async function generateSpeech(text: string, voice = "alloy"): Promise<{ buffer: Buffer; mime: string }> {
  const s = await getSettings();
  const key = await needKey("openai");
  const res = await fetch("https://api.openai.com/v1/audio/speech", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: s.openaiTtsModel, voice, input: text }),
  });
  if (!res.ok) await fail(res, "OpenAI TTS");
  return { buffer: Buffer.from(await res.arrayBuffer()), mime: "audio/mpeg" };
}

// ---------- Key check ----------

export async function testKey(provider: "openai" | "gemini"): Promise<{ ok: boolean; detail: string }> {
  const key = await needKey(provider).catch((e: Error) => { throw e; });
  const res = provider === "openai"
    ? await fetch("https://api.openai.com/v1/models", { headers: { Authorization: `Bearer ${key}` } })
    : await fetch(`${GEMINI_BASE}/models`, { headers: { "x-goog-api-key": key } });
  if (!res.ok) return { ok: false, detail: `HTTP ${res.status}: ${(await res.text()).slice(0, 300)}` };
  const data = await res.json();
  const count = (data.data ?? data.models ?? []).length;
  return { ok: true, detail: `Key dùng được — thấy ${count} model.` };
}
