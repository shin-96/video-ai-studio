export type AssetKind =
  | "upload" | "character" | "environment" | "prop"
  | "storyboard" | "image" | "video" | "audio" | "cover" | "final";

export interface Asset {
  id: string;
  projectId: string;
  kind: AssetKind;
  name: string;
  /** Public path under /media/... or null while pending */
  url: string | null;
  mime: string;
  source: "upload" | "openai" | "gemini" | "export";
  prompt?: string;
  shotId?: string;
  trashed?: boolean;
  createdAt: string;
}

export interface Shot {
  id: string;
  projectId: string;
  code: string;
  title: string;
  prompt: string;
  durationSec: number;
  selectedAssetId?: string;
  createdAt: string;
}

export interface CanvasNode {
  id: string;
  type: string;
  position: { x: number; y: number };
  data: {
    label: string;
    kind: string;
    prompt?: string;
    provider?: "openai" | "gemini";
    durationSec?: number;
    assetUrl?: string;
    assetId?: string;
    shotId?: string;
  };
}

export interface CanvasEdge { id: string; source: string; target: string }

export interface Project {
  id: string;
  name: string;
  description: string;
  styleBlock: string;
  aspectRatio: string;
  canvas: { nodes: CanvasNode[]; edges: CanvasEdge[] };
  createdAt: string;
  updatedAt: string;
}

export interface Db { projects: Project[]; assets: Asset[]; shots: Shot[] }

export interface Settings {
  openaiApiKey: string;
  geminiApiKey: string;
  openaiChatModel: string;
  openaiImageModel: string;
  openaiTtsModel: string;
  geminiChatModel: string;
  geminiImageModel: string;
  geminiVideoModel: string;
}
