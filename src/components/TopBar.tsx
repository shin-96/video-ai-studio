import Link from "next/link";

export default function TopBar() {
  return (
    <header className="topbar">
      <Link href="/" className="logo">🎬 Video AI Studio</Link>
      <nav>
        <Link href="/">Projects</Link>
        <Link href="/settings">Settings (API key)</Link>
      </nav>
      <span className="muted small" style={{ marginLeft: "auto" }}>
        Canvas kiểu LibTV · OpenAI + Gemini (BYOK)
      </span>
    </header>
  );
}
