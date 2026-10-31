"use client";
import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

interface Msg { role: "user" | "assistant"; text: string }

export default function DirectorPage() {
  const { id } = useParams<{ id: string }>();
  const [provider, setProvider] = useState<"openai" | "gemini">("openai");
  const [msgs, setMsgs] = useState<Msg[]>([
    { role: "assistant", text: "Chào bạn, mình là TV Director. Gửi ý tưởng hoặc kịch bản, mình giúp viết/bóc thành các shot 4–8 giây để gen bằng Veo. Hoặc dán kịch bản vào ô bên dưới rồi bấm “Bóc kịch bản thành shots” — các shot sẽ tự hiện lên Canvas." },
  ]);
  const [input, setInput] = useState("");
  const [script, setScript] = useState("");
  const [busy, setBusy] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");

  async function send() {
    if (!input.trim()) return;
    const text = input;
    setMsgs((m) => [...m, { role: "user", text }]);
    setInput(""); setBusy("chat"); setError("");
    const res = await fetch("/api/director", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId: id, mode: "chat", message: text, provider }),
    });
    const data = await res.json();
    setBusy("");
    if (!res.ok) { setError(data.error ?? "Director lỗi"); return; }
    setMsgs((m) => [...m, { role: "assistant", text: data.reply }]);
  }

  async function breakdown() {
    setBusy("break"); setError(""); setNote("");
    const res = await fetch("/api/director", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId: id, mode: "breakdown", script, provider }),
    });
    const data = await res.json();
    setBusy("");
    if (!res.ok) { setError(data.error ?? "Bóc kịch bản thất bại"); return; }
    setNote(`Đã tạo ${data.shots.length} shot (${data.shots.map((s: { code: string }) => s.code).join(", ")})${data.usedFallback ? " — không gọi được LLM nên đã bóc thô theo đoạn văn, hãy sửa prompt từng shot trên Canvas" : ""}. Mở Canvas để xem và gen.`);
  }

  return (
    <div>
      <div className="spread">
        <h1>TV Director</h1>
        <Link className="btn btn-sm" href={`/projects/${id}/canvas`}>← Về Canvas</Link>
      </div>
      <div className="row" style={{ margin: "8px 0 14px" }}>
        <span className="muted small">Model Director:</span>
        <button className={`tag ${provider === "openai" ? "active" : ""}`} onClick={() => setProvider("openai")}>OpenAI GPT</button>
        <button className={`tag ${provider === "gemini" ? "active" : ""}`} onClick={() => setProvider("gemini")}>Google Gemini</button>
      </div>
      {note && <div className="ok">{note}</div>}
      {error && <div className="error">{error}</div>}

      <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 16, alignItems: "start" }}>
        <div className="panel">
          <div className="chatbox">
            {msgs.map((m, i) => <div key={i} className={`msg ${m.role}`}>{m.text}</div>)}
            {busy === "chat" && <div className="msg assistant muted">Director đang nghĩ…</div>}
          </div>
          <div className="row" style={{ marginTop: 12 }}>
            <input className="input" style={{ flex: 1 }} value={input} onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && send()}
              placeholder="VD: Viết cho tôi kịch bản 9 shot về mèo hiệp sĩ đánh rồng…" />
            <button className="btn btn-primary" onClick={send} disabled={busy === "chat"}>Gửi</button>
          </div>
        </div>

        <div className="panel">
          <strong>Bóc kịch bản → Shots</strong>
          <p className="small muted">Dán kịch bản vào đây. Director (LLM) sẽ chia thành các shot kèm prompt gen video; shot tự xuất hiện trên Canvas với dây nối sẵn từ Vai trò/Môi trường. Chưa có API key thì hệ thống bóc thô theo đoạn văn để dùng tạm.</p>
          <textarea className="textarea" style={{ minHeight: 220 }} value={script} onChange={(e) => setScript(e.target.value)} placeholder={"Cảnh 1: Đồng cỏ lúc hoàng hôn, mèo hiệp sĩ con bước đi…\n\nCảnh 2: Rồng sữa đáp xuống…"} />
          <div style={{ marginTop: 12 }}>
            <button className="btn btn-primary" onClick={breakdown} disabled={busy === "break" || !script.trim()}>
              {busy === "break" ? "Đang bóc…" : "Bóc kịch bản thành shots"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
