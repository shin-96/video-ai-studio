"use client";
import { useEffect, useState } from "react";

interface SettingsView {
  hasOpenaiKey: boolean; hasGeminiKey: boolean;
  openaiKeyMasked: string; geminiKeyMasked: string;
  openaiChatModel: string; openaiImageModel: string; openaiTtsModel: string;
  geminiChatModel: string; geminiImageModel: string; geminiVideoModel: string;
}

export default function SettingsPage() {
  const [view, setView] = useState<SettingsView | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const [testing, setTesting] = useState("");

  const load = () => fetch("/api/settings").then((r) => r.json()).then((d) => {
    setView(d);
    setForm({
      openaiApiKey: "", geminiApiKey: "",
      openaiChatModel: d.openaiChatModel, openaiImageModel: d.openaiImageModel, openaiTtsModel: d.openaiTtsModel,
      geminiChatModel: d.geminiChatModel, geminiImageModel: d.geminiImageModel, geminiVideoModel: d.geminiVideoModel,
    });
  });
  useEffect(() => { load(); }, []);

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function save() {
    setMsg(""); setError("");
    const res = await fetch("/api/settings", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form),
    });
    if (!res.ok) { setError((await res.json()).error ?? "Lưu thất bại"); return; }
    setMsg("Đã lưu. Key chỉ nằm ở server local (data/settings.json, đã gitignore), không gửi về trình duyệt, không commit lên GitHub.");
    load();
  }

  async function test(provider: "openai" | "gemini") {
    setTesting(provider); setMsg(""); setError("");
    const res = await fetch("/api/settings/test", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ provider }),
    });
    const data = await res.json();
    setTesting("");
    if (!res.ok) setError(data.error ?? "Test thất bại");
    else if (data.ok) setMsg(`${provider}: ${data.detail}`);
    else setError(`${provider}: ${data.detail}`);
  }

  if (!view) return <p className="muted">Đang tải…</p>;

  return (
    <div style={{ maxWidth: 760 }}>
      <h1>Settings — API key</h1>
      <p className="muted">BYOK: tiền gen tính thẳng vào tài khoản API của bạn. Lưu ý: <strong>OpenAI không còn API video</strong> (Sora đã tắt 24/09/2026) — video chạy bằng <strong>Gemini Veo</strong>, OpenAI lo chat Director, gen ảnh GPT Image và TTS. Key Gemini muốn gọi Veo phải gắn billing (Veo không có free tier).</p>
      {msg && <div className="ok">{msg}</div>}
      {error && <div className="error">{error}</div>}

      <div className="panel">
        <h2 style={{ marginTop: 0 }}>OpenAI {view.hasOpenaiKey ? <span className="tag active">đã có key {view.openaiKeyMasked}</span> : <span className="tag">chưa có key</span>}</h2>
        <label className="lbl">OPENAI_API_KEY (để trống = giữ key cũ)</label>
        <input className="input" type="password" value={form.openaiApiKey} onChange={set("openaiApiKey")} placeholder="sk-…" autoComplete="off" />
        <label className="lbl">Model chat (Director)</label>
        <input className="input" value={form.openaiChatModel} onChange={set("openaiChatModel")} />
        <label className="lbl">Model ảnh</label>
        <input className="input" value={form.openaiImageModel} onChange={set("openaiImageModel")} />
        <label className="lbl">Model TTS</label>
        <input className="input" value={form.openaiTtsModel} onChange={set("openaiTtsModel")} />
        <div style={{ marginTop: 12 }}>
          <button className="btn btn-sm" onClick={() => test("openai")} disabled={testing === "openai"}>{testing === "openai" ? "Đang test…" : "Test key OpenAI"}</button>
        </div>
      </div>

      <div className="panel" style={{ marginTop: 16 }}>
        <h2 style={{ marginTop: 0 }}>Google Gemini {view.hasGeminiKey ? <span className="tag active">đã có key {view.geminiKeyMasked}</span> : <span className="tag">chưa có key</span>}</h2>
        <label className="lbl">GEMINI_API_KEY (lấy ở Google AI Studio, để trống = giữ key cũ)</label>
        <input className="input" type="password" value={form.geminiApiKey} onChange={set("geminiApiKey")} placeholder="AIza…" autoComplete="off" />
        <label className="lbl">Model chat</label>
        <input className="input" value={form.geminiChatModel} onChange={set("geminiChatModel")} />
        <label className="lbl">Model ảnh (Nano Banana)</label>
        <input className="input" value={form.geminiImageModel} onChange={set("geminiImageModel")} />
        <label className="lbl">Model video (Veo)</label>
        <input className="input" value={form.geminiVideoModel} onChange={set("geminiVideoModel")} />
        <p className="small muted">Đổi sang bản nhanh/rẻ hơn: <code>veo-3.1-fast-generate-preview</code> hoặc <code>veo-3.1-lite-generate-preview</code>.</p>
        <div style={{ marginTop: 12 }}>
          <button className="btn btn-sm" onClick={() => test("gemini")} disabled={testing === "gemini"}>{testing === "gemini" ? "Đang test…" : "Test key Gemini"}</button>
        </div>
      </div>

      <div style={{ marginTop: 18 }}>
        <button className="btn btn-primary" onClick={save}>Lưu settings</button>
      </div>
    </div>
  );
}
