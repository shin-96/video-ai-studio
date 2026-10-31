"use client";
import { useEffect, useState } from "react";
import Link from "next/link";

interface Project { id: string; name: string; description: string; styleBlock: string; createdAt: string; updatedAt: string }

const DEFAULT_STYLE = "Một bộ phim hoạt hình máy tính (CG) chân thực, đậm chất điện ảnh, phong cách sử thi giả tưởng thời trung cổ. Ánh sáng hoàng hôn ấm, tông màu cam–xanh lục, độ chi tiết cao, chuyển động mượt.";

export default function HomePage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [styleBlock, setStyleBlock] = useState(DEFAULT_STYLE);
  const [error, setError] = useState("");

  const load = () => fetch("/api/projects").then((r) => r.json()).then((d) => setProjects(d.projects ?? []));
  useEffect(() => { load(); }, []);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const res = await fetch("/api/projects", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, description, styleBlock }),
    });
    const data = await res.json();
    if (!res.ok) { setError(data.error ?? "Tạo project thất bại"); return; }
    setName(""); setDescription("");
    load();
  }

  async function remove(id: string) {
    if (!confirm("Xóa project này? (file media đã gen vẫn nằm trong public/media)")) return;
    await fetch(`/api/projects/${id}`, { method: "DELETE" });
    load();
  }

  return (
    <div>
      <h1>Projects</h1>
      <p className="muted">Mỗi project là một phim: canvas node (Vai trò → Môi trường → Shot S01… → Bìa → Phim hoàn chỉnh), thư viện tài sản và Director chat — đúng cấu trúc LibTV trong ảnh mẫu, nhưng chạy bằng key OpenAI + Gemini của bạn. Chưa có key? Vào <Link href="/settings">Settings</Link> nhập trước.</p>
      {error && <div className="error">{error}</div>}

      <div className="grid" style={{ marginTop: 18 }}>
        {projects.map((p) => (
          <div className="card" key={p.id}>
            <div className="spread">
              <strong>{p.name}</strong>
              <button className="btn btn-danger btn-sm" onClick={() => remove(p.id)}>Xóa</button>
            </div>
            <p className="muted small">{p.description || "—"}</p>
            <p className="small muted">Cập nhật: {new Date(p.updatedAt).toLocaleString("vi-VN")}</p>
            <div className="row">
              <Link className="btn btn-primary btn-sm" href={`/projects/${p.id}/canvas`}>Canvas</Link>
              <Link className="btn btn-sm" href={`/projects/${p.id}/assets`}>Tài sản</Link>
              <Link className="btn btn-sm" href={`/projects/${p.id}/director`}>Director</Link>
            </div>
          </div>
        ))}
        {!projects.length && <p className="muted">Chưa có project nào — tạo project đầu tiên ở form bên dưới.</p>}
      </div>

      <h2>Tạo project mới</h2>
      <form className="panel" onSubmit={create} style={{ maxWidth: 720 }}>
        <label className="lbl">Tên phim / project *</label>
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="VD: Hiệp sĩ Mèo — Hàm ngục" required />
        <label className="lbl">Mô tả ngắn</label>
        <input className="input" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="VD: Mèo hiệp sĩ xung phong đánh rồng" />
        <label className="lbl">Style block (khóa nguyên văn — sẽ tự chèn vào đầu mọi prompt gen)</label>
        <textarea className="textarea" value={styleBlock} onChange={(e) => setStyleBlock(e.target.value)} />
        <div style={{ marginTop: 14 }}>
          <button className="btn btn-primary" type="submit">Tạo project + canvas mẫu</button>
        </div>
      </form>
    </div>
  );
}
