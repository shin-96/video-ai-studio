import type { Metadata } from "next";
import "./globals.css";
import TopBar from "@/components/TopBar";

export const metadata: Metadata = {
  title: "Video AI Studio",
  description: "Studio làm phim AI kiểu LibTV — chạy bằng key OpenAI + Gemini của chính bạn",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      <body>
        <TopBar />
        <main>{children}</main>
      </body>
    </html>
  );
}
