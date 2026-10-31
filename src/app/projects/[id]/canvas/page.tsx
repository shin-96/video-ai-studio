"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import CanvasClient, { type AssetLike } from "@/components/CanvasClient";

export default function CanvasPage() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<{ project: never; assets: AssetLike[] } | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`/api/projects/${id}`).then(async (r) => {
      const d = await r.json();
      if (!r.ok) { setError(d.error ?? "Không tải được project"); return; }
      setData(d);
    });
  }, [id]);

  if (error) return <div className="error">{error}</div>;
  if (!data) return <p className="muted">Đang tải canvas…</p>;
  const project = data.project as { name: string };

  return (
    <div>
      <div className="spread">
        <h1>{project.name} — Canvas</h1>
        <div className="row">
          <Link className="btn btn-sm" href={`/projects/${id}/director`}>Director (bóc kịch bản → shots)</Link>
          <Link className="btn btn-sm" href={`/projects/${id}/assets`}>Thư viện tài sản</Link>
        </div>
      </div>
      <p className="muted small">Kéo thả node, kéo từ chấm phải của node này sang chấm trái của node kia để nối dây — asset Vai trò/Môi trường cấp reference cho các Shot, Shot cấp clip cho Phim hoàn chỉnh, đúng sơ đồ LibTV.</p>
      <CanvasClient project={data.project as never} initialAssets={data.assets} />
    </div>
  );
}
