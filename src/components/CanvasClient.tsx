"use client";
import { useCallback, useMemo, useRef, useState } from "react";
import {
  ReactFlow, Background, Controls, MiniMap, addEdge,
  useNodesState, useEdgesState, Handle, Position,
  type Node, type Edge, type Connection,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

export interface AssetLike { id: string; kind: string; name: string; url: string | null; mime: string; shotId?: string }
interface ProjectLike {
  id: string; name: string; styleBlock: string; aspectRatio: string;
  canvas: { nodes: never[]; edges: never[] };
}

const KIND_COLORS: Record<string, string> = {
  upload: "#a3a3ad", character: "#f59e0b", environment: "#84cc16", prop: "#e879f9",
  shot: "#14b8a6", image: "#60a5fa", storyboard: "#60a5fa", cover: "#f472b6", final: "#facc15", audio: "#c084fc",
};
const KIND_LABELS: Record<string, string> = {
  upload: "Tải lên", character: "Vai trò", environment: "Môi trường", prop: "Đạo cụ",
  shot: "Shot", image: "Ảnh", cover: "Bìa", final: "Phim hoàn chỉnh", audio: "Tiếng",
};

function StudioNode({ data, selected }: { data: Record<string, unknown>; selected?: boolean }) {
  const kind = String(data.kind ?? "shot");
  const assetUrl = data.assetUrl as string | undefined;
  const isVideo = typeof assetUrl === "string" && assetUrl.endsWith(".mp4");
  return (
    <div className={`studio-node ${selected ? "selected" : ""}`}>
      <Handle type="target" position={Position.Left} />
      <div className="kind" style={{ color: KIND_COLORS[kind] ?? "#14b8a6" }}>{KIND_LABELS[kind] ?? kind}</div>
      <div><strong>{String(data.label ?? "")}</strong></div>
      {assetUrl && (isVideo
        ? <video src={assetUrl} muted loop playsInline onMouseOver={(e) => (e.target as HTMLVideoElement).play()} onMouseOut={(e) => (e.target as HTMLVideoElement).pause()} />
        : <img src={assetUrl} alt="" />)}
      {typeof data.prompt === "string" && data.prompt && <div className="prompt">{data.prompt}</div>}
      <Handle type="source" position={Position.Right} />
    </div>
  );
}

const nodeTypes = { studio: StudioNode };

export default function CanvasClient({ project, initialAssets }: { project: ProjectLike; initialAssets: AssetLike[] }) {
  const [nodes, setNodes, onNodesChange] = useNodesState(project.canvas.nodes as unknown as Node[]);
  const [edges, setEdges, onEdgesChange] = useEdgesState(project.canvas.edges as unknown as Edge[]);
  const [assets, setAssets] = useState<AssetLike[]>(initialAssets);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [styleBlock, setStyleBlock] = useState(project.styleBlock);
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const [refIds, setRefIds] = useState<string[]>([]);
  const counter = useRef(100);

  const selected = useMemo(() => nodes.find((n) => n.id === selectedId) ?? null, [nodes, selectedId]);
  const imageAssets = useMemo(() => assets.filter((a) => a.mime?.startsWith("image/") && a.url), [assets]);

  const onConnect = useCallback((c: Connection) => setEdges((eds) => addEdge(c, eds)), [setEdges]);

  function updateSelected(patch: Record<string, unknown>) {
    if (!selectedId) return;
    setNodes((nds) => nds.map((n) => n.id === selectedId ? { ...n, data: { ...n.data, ...patch } } : n));
  }

  function addNode(kind: string) {
    counter.current += 1;
    const nid = `${kind}-${Date.now()}`;
    const labels: Record<string, string> = { shot: "Shot mới", character: "Vai trò mới", environment: "Môi trường mới", image: "Ảnh mới", cover: "Bìa mới" };
    setNodes((nds) => [...nds, {
      id: nid, type: "studio",
      position: { x: 300 + (counter.current % 5) * 40, y: 120 + (counter.current % 7) * 60 },
      data: { label: labels[kind] ?? kind, kind, prompt: "", provider: "gemini", durationSec: 8 },
    } as Node]);
    setSelectedId(nid);
  }

  async function saveCanvas() {
    setBusy("save"); setError(""); setMsg("");
    const cleanNodes = nodes.map((n) => ({
      id: n.id, type: "studio", position: n.position,
      data: {
        label: n.data.label, kind: n.data.kind, prompt: n.data.prompt ?? "",
        provider: n.data.provider ?? "gemini", durationSec: n.data.durationSec ?? 8,
        assetUrl: n.data.assetUrl, assetId: n.data.assetId, shotId: n.data.shotId,
        assetKind: n.data.assetKind, dialogue: n.data.dialogue ?? "",
      },
    }));
    const res = await fetch(`/api/projects/${project.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ canvas: { nodes: cleanNodes, edges }, styleBlock }),
    });
    setBusy("");
    if (!res.ok) { setError((await res.json()).error ?? "Lưu thất bại"); return; }
    setMsg("Đã lưu canvas + style block.");
  }

  async function callGen(url: string, body: Record<string, unknown>, kindLabel: string) {
    if (!selected) return;
    setBusy(url); setError(""); setMsg("");
    const res = await fetch(url, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    });
    const data = await res.json();
    setBusy("");
    if (!res.ok) { setError(data.error ?? "Gen thất bại"); return; }
    const asset = data.asset as AssetLike;
    setAssets((a) => [...a, asset]);
    updateSelected({ assetUrl: asset.url, assetId: asset.id, assetKind: asset.kind });
    setMsg(`Đã tạo ${kindLabel}: ${asset.name}${data.usedClips ? ` (ghép ${data.usedClips} clip${data.missingShots?.length ? `, thiếu video ở: ${data.missingShots.join(", ")}` : ""})` : ""}`);
  }

  const data = (selected?.data ?? {}) as Record<string, unknown>;
  const provider = (data.provider as string) ?? "gemini";
  const prompt = (data.prompt as string) ?? "";
  const kind = (data.kind as string) ?? "shot";
  const imageKindForNode: Record<string, string> = { character: "character", environment: "environment", cover: "cover", shot: "image" };

  return (
    <div>
      <div className="spread">
        <div className="row">
          <button className="btn btn-sm" onClick={() => addNode("shot")}>+ Shot</button>
          <button className="btn btn-sm" onClick={() => addNode("character")}>+ Vai trò</button>
          <button className="btn btn-sm" onClick={() => addNode("environment")}>+ Môi trường</button>
          <button className="btn btn-sm" onClick={() => addNode("image")}>+ Ảnh</button>
          <button className="btn btn-sm" onClick={() => addNode("cover")}>+ Bìa</button>
        </div>
        <button className="btn btn-primary" onClick={saveCanvas} disabled={busy === "save"}>{busy === "save" ? "Đang lưu…" : "Lưu canvas"}</button>
      </div>

      <details style={{ margin: "12px 0" }}>
        <summary className="muted" style={{ cursor: "pointer" }}>Style block của project (khóa nguyên văn, tự chèn vào mọi prompt gen)</summary>
        <textarea className="textarea" style={{ marginTop: 8 }} value={styleBlock} onChange={(e) => setStyleBlock(e.target.value)} />
      </details>

      {msg && <div className="ok">{msg}</div>}
      {error && <div className="error">{error}</div>}

      <div style={{ display: "grid", gridTemplateColumns: selected ? "1fr 330px" : "1fr", gap: 14, alignItems: "start" }}>
        <div className="canvas-wrap">
          <ReactFlow
            nodes={nodes} edges={edges}
            onNodesChange={onNodesChange} onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={(_, n) => setSelectedId(n.id)}
            onPaneClick={() => setSelectedId(null)}
            nodeTypes={nodeTypes} fitView colorMode="dark"
          >
            <Background /> <Controls /> <MiniMap />
          </ReactFlow>
        </div>

        {selected && (
          <div className="panel">
            <div className="spread">
              <strong>{KIND_LABELS[kind] ?? kind}</strong>
              <button className="btn btn-danger btn-sm" onClick={() => { setNodes((nds) => nds.filter((n) => n.id !== selectedId)); setSelectedId(null); }}>Xóa node</button>
            </div>
            <label className="lbl">Tên node</label>
            <input className="input" value={(data.label as string) ?? ""} onChange={(e) => updateSelected({ label: e.target.value })} />
            <label className="lbl">Prompt</label>
            <textarea className="textarea" value={prompt} onChange={(e) => updateSelected({ prompt: e.target.value })} placeholder="Mô tả cảnh: nhân vật, hành động theo khoảng giây, góc máy, ánh sáng…" />
            <label className="lbl">Provider</label>
            <select className="input" value={provider} onChange={(e) => updateSelected({ provider: e.target.value })}>
              <option value="gemini">Gemini (ảnh Nano Banana / video Veo)</option>
              <option value="openai">OpenAI (ảnh GPT Image — video không khả dụng)</option>
            </select>
            {kind === "shot" && (
              <>
                <label className="lbl">Thời lượng clip Veo (giây)</label>
                <select className="input" value={String(data.durationSec ?? 8)} onChange={(e) => updateSelected({ durationSec: Number(e.target.value) })}>
                  <option value="4">4</option><option value="6">6</option><option value="8">8</option>
                </select>
                <label className="lbl">Thoại cho shot này (gen TTS bằng OpenAI)</label>
                <input className="input" value={(data.dialogue as string) ?? ""} onChange={(e) => updateSelected({ dialogue: e.target.value })} placeholder="VD: Tiến lên! Đừng sợ con rồng đó!" />
              </>
            )}
            {!!imageAssets.length && (
              <>
                <label className="lbl">Ảnh reference (giữ nhân vật/bối cảnh — tối đa 3–4 ảnh)</label>
                <div style={{ maxHeight: 130, overflowY: "auto" }}>
                  {imageAssets.map((a) => (
                    <label key={a.id} className="small" style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 4 }}>
                      <input type="checkbox" checked={refIds.includes(a.id)}
                        onChange={(e) => setRefIds((r) => e.target.checked ? [...r, a.id] : r.filter((x) => x !== a.id))} />
                      <img src={a.url!} alt="" style={{ width: 44, height: 26, objectFit: "cover", borderRadius: 4 }} />
                      <span>{a.name}</span>
                    </label>
                  ))}
                </div>
              </>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 16 }}>
              {kind !== "final" && kind !== "upload" && (
                <button className="btn" disabled={!!busy} onClick={() => callGen("/api/generate/image", {
                  projectId: project.id, prompt, provider,
                  kind: imageKindForNode[kind] ?? "image",
                  shotId: data.shotId, referenceAssetIds: refIds,
                }, "ảnh")}>{busy.includes("image") ? "Đang gen ảnh…" : "Gen ảnh"}</button>
              )}
              {kind === "shot" && (
                <>
                  <button className="btn btn-primary" disabled={!!busy} onClick={() => callGen("/api/generate/video", {
                    projectId: project.id, prompt, provider: "gemini",
                    durationSec: data.durationSec ?? 8, shotId: data.shotId,
                    firstFrameAssetId: data.assetKind === "image" || kind === "shot" ? data.assetId : undefined,
                    referenceAssetIds: refIds,
                  }, "video")}>{busy.includes("video") ? "Đang gen video Veo (1–5 phút)…" : "Gen video (Veo)"}</button>
                  <button className="btn" disabled={!!busy || !(data.dialogue as string)} onClick={() => callGen("/api/generate/audio", {
                    projectId: project.id, text: data.dialogue, shotId: data.shotId,
                  }, "thoại")}>Gen thoại TTS</button>
                </>
              )}
              {kind === "upload" && (
                <label className="btn" style={{ textAlign: "center" }}>
                  Tải file lên
                  <input type="file" hidden accept="image/*,video/*,audio/*" onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    setBusy("upload"); setError("");
                    const form = new FormData();
                    form.set("file", file); form.set("kind", "upload");
                    const res = await fetch(`/api/projects/${project.id}/assets`, { method: "POST", body: form });
                    const d = await res.json();
                    setBusy("");
                    if (!res.ok) { setError(d.error ?? "Upload thất bại"); return; }
                    setAssets((a) => [...a, d.asset]);
                    updateSelected({ assetUrl: d.asset.url, assetId: d.asset.id, assetKind: d.asset.kind });
                    setMsg("Đã tải lên: " + d.asset.name);
                  }} />
                </label>
              )}
              {kind === "final" && (
                <button className="btn btn-primary" disabled={!!busy} onClick={() => callGen("/api/export", { projectId: project.id }, "phim hoàn chỉnh")}>
                  {busy.includes("export") ? "Đang ghép phim bằng ffmpeg…" : "Ghép phim hoàn chỉnh (ffmpeg)"}
                </button>
              )}
            </div>
            <p className="small muted" style={{ marginTop: 12 }}>Mọi bản gen đều được giữ trong Thư viện tài sản (kể cả bản hỏng) — vào đó để chọn bản tốt nhất cho từng shot. Nhớ bấm Lưu canvas sau khi sắp xếp node.</p>
          </div>
        )}
      </div>
    </div>
  );
}
