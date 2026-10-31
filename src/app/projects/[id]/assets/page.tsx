"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

interface Asset { id: string; kind: string; name: string; url: string | null; mime: string; source: string; prompt?: string; shotId?: string; trashed?: boolean; createdAt: string }
interface Shot { id: string; code: string; selectedAssetId?: string }

const TABS: { key: string; label: string; match: (a: Asset) => boolean }[] = [
  { key: "all", label: "Tất cả", match: (a) => !a.trashed },
  { key: "character", label: "Vai trò", match: (a) => a.kind === "character" && !a.trashed },
  { key: "environment", label: "Bối cảnh", match: (a) => a.kind === "environment" && !a.trashed },
  { key: "image", label: "Hình ảnh", match: (a) => a.mime.startsWith("image/") && !a.trashed },
  { key: "video", label: "Đoạn video", match: (a) => a.kind === "video" && !a.trashed },
  { key: "final", label: "Phim hoàn chỉnh", match: (a) => a.kind === "final" && !a.trashed },
  { key: "audio", label: "Âm thanh", match: (a) => a.mime.startsWith("audio/") && !a.trashed },
  { key: "trash", label: "Phế thải", match: (a) => Boolean(a.trashed) },
];

export default function AssetsPage() {
  const { id } = useParams<{ id: string }>();
  const [projectName, setProjectName] = useState("");
  const [assets, setAssets] = useState<Asset[]>([]);
  const [shots, setShots] = useState<Shot[]>([]);
  const [tab, setTab] = useState("all");
  const [msg, setMsg] = useState("");

  const load = () => fetch(`/api/projects/${id}`).then((r) => r.json()).then((d) => {
    setProjectName(d.project?.name ?? "");
    setAssets(d.assets ?? []);
    setShots(d.shots ?? []);
  });
  useEffect(() => { load(); }, [id]);

  const images = assets.filter((a) => a.mime.startsWith("image/") && !a.trashed).length;
  const videos = assets.filter((a) => a.mime.startsWith("video/") && !a.trashed).length;
  const shown = useMemo(() => {
    const t = TABS.find((x) => x.key === tab) ?? TABS[0];
    return assets.filter(t.match).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [assets, tab]);

  async function patch(asset: Asset, body: Record<string, unknown>, message: string) {
    const res = await fetch(`/api/assets/${asset.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    });
    if (res.ok) { setMsg(message); load(); }
  }

  return (
    <div>
      <div className="spread">
        <h1>{projectName} — Tài liệu dự án</h1>
        <Link className="btn btn-sm" href={`/projects/${id}/canvas`}>← Về Canvas</Link>
      </div>
      <p className="muted">hình ảnh <strong>{images}</strong> · băng hình <strong>{videos}</strong> · tổng {assets.length} tài sản. Mọi bản gen đều được giữ — bản không dùng chuyển vào Phế thải thay vì xóa.</p>
      {msg && <div className="ok">{msg}</div>}
      <div className="row" style={{ margin: "12px 0" }}>
        {TABS.map((t) => (
          <button key={t.key} className={`tag ${tab === t.key ? "active" : ""}`} onClick={() => setTab(t.key)}>{t.label}</button>
        ))}
      </div>
      <div className="grid">
        {shown.map((a) => {
          const shot = shots.find((s) => s.id === a.shotId);
          const isSelected = shot?.selectedAssetId === a.id;
          return (
            <div className="card" key={a.id} style={{ padding: 0 }}>
              {a.url && a.mime.startsWith("image/") && <img className="thumb" src={a.url} alt={a.name} />}
              {a.url && a.mime.startsWith("video/") && <video className="thumb" src={a.url} controls preload="metadata" />}
              {a.url && a.mime.startsWith("audio/") && <div style={{ padding: 12 }}><audio src={a.url} controls style={{ width: "100%" }} /></div>}
              <div style={{ padding: 12 }}>
                <div className="spread">
                  <strong className="small">{a.name}</strong>
                  {isSelected && <span className="tag active">bản được chọn{shot ? ` · ${shot.code}` : ""}</span>}
                </div>
                <p className="small muted">{a.kind} · {a.source} · {new Date(a.createdAt).toLocaleString("vi-VN")}</p>
                {a.prompt && <p className="small muted" style={{ maxHeight: 54, overflow: "hidden" }}>{a.prompt}</p>}
                <div className="row">
                  {a.url && <a className="btn btn-sm" href={a.url} download>Tải xuống</a>}
                  {a.kind === "video" && a.shotId && !isSelected && (
                    <button className="btn btn-sm" onClick={() => patch(a, { selectForShot: a.shotId }, `Đã chọn bản này cho ${shot?.code ?? "shot"}.`)}>Chọn cho shot</button>
                  )}
                  {!a.trashed
                    ? <button className="btn btn-sm" onClick={() => patch(a, { trashed: true }, "Đã chuyển vào Phế thải.")}>Vào phế thải</button>
                    : <button className="btn btn-sm" onClick={() => patch(a, { trashed: false }, "Đã khôi phục.")}>Khôi phục</button>}
                </div>
              </div>
            </div>
          );
        })}
        {!shown.length && <p className="muted">Chưa có tài sản nào ở mục này.</p>}
      </div>
    </div>
  );
}
