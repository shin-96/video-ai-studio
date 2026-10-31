# Video AI Studio

Studio làm phim AI có cấu trúc làm việc như **LibTV** (canvas node vô hạn: Tải lên → Vai trò / Môi trường → các Shot S01… → Bìa → Phim hoàn chỉnh, thư viện tài sản, TV Director), nhưng chạy bằng **API key của chính bạn**:

- **Google Gemini** — gen video bằng **Veo 3.1**, gen/sửa ảnh bằng Nano Banana, chat Director
- **OpenAI** — chat Director (GPT), gen ảnh GPT Image 2.5, lồng tiếng TTS

> ⚠️ **OpenAI không còn API video**: Sora 2 đã bị tắt ngày 24/09/2026, không có model thay thế. Vì vậy node video chạy bằng Veo; lớp provider (`src/lib/providers.ts`) được thiết kế dạng interface chung — sau này OpenAI ra lại API video, hoặc bạn muốn thêm Kling/Runway, chỉ cần thêm một nhánh trong file đó, không phải sửa canvas.

Thiết kế chi tiết và lý do từng quyết định: xem [BLUEPRINT.md](./BLUEPRINT.md).

## Chạy local

```bash
npm install
npm run dev        # http://localhost:3000
```

Mở app → vào **Settings** → dán 2 key của bạn (hoặc copy `.env.example` thành `.env.local` rồi điền key):

- `OPENAI_API_KEY` — lấy ở platform.openai.com
- `GEMINI_API_KEY` — lấy ở Google AI Studio. **Lưu ý:** muốn gọi Veo thì project Google phải gắn billing — Veo không có free tier, tính tiền theo giây video.

Key nhập trong Settings được lưu ở `data/settings.json` phía server (đã gitignore), chỉ hiển thị dạng che (`sk-…abcd`), không bao giờ gửi về trình duyệt hay commit lên Git.

Kiểm tra nhanh logic lõi: `npm run check` · Build production: `npm run build && npm run start`

## Cách dùng

1. **Tạo project** ở trang chủ: tên phim + *style block* (khóa nguyên văn — hệ thống tự chèn vào đầu mọi prompt gen, không diễn đạt lại, để giữ nhất quán phong cách như quy trình LibTV).
2. **Director**: dán kịch bản → *Bóc kịch bản thành shots* (LLM chia thành S01, S02… kèm prompt; chưa có key thì bóc thô theo đoạn văn). Chat với Director để viết/sửa kịch bản.
3. **Canvas**: các node Vai trò / Môi trường / Shot đã nối dây sẵn. Chọn node → nhập prompt → chọn ảnh reference (sheet nhân vật, bối cảnh) → **Gen ảnh** / **Gen video (Veo)** / **Gen thoại TTS**. Node *Phim hoàn chỉnh* → ghép các bản video đã chọn của từng shot bằng ffmpeg.
4. **Thư viện tài sản**: mọi bản gen đều được giữ (kể cả bản hỏng — chuyển vào *Phế thải* thay vì xóa). Ở đây bạn chọn bản video tốt nhất cho từng shot, bản đó sẽ được dùng khi ghép phim.

Quy tắc sản xuất đi kèm: nhân vật chưa có sheet khóa thì chưa gen shot có nhân vật đó; mỗi clip Veo tối đa 8 giây nên phim dài = nhiều shot ngắn rồi ghép, đúng cách project mẫu 猫咪骑士 ghép 9 cảnh S01–S09.

## Cấu trúc repo

```
src/
  app/                  # trang: projects, canvas, assets, director, settings + API routes
    api/                # projects, assets, shots, generate/{image,video,audio}, director, export, settings
  components/           # CanvasClient (React Flow), TopBar
  lib/
    providers.ts        # REST tới OpenAI + Gemini (không dùng SDK), Veo poll long-running
    store.ts            # DB dạng 1 file JSON trong data/ + lưu media vào public/media/
    pure.js             # logic thuần có self-check: mã shot, style block, mask key, thời lượng Veo
scripts/self-check.mjs  # npm run check
```

## Đã bỏ qua ở MVP (có chủ đích)

- Multi-user / đăng nhập / thanh toán — đây là studio cá nhân chạy local.
- DB là 1 file JSON (`data/db.json`), chưa phải SQLite/Postgres — nâng cấp khi cần nhiều người dùng.
- Timeline editor kiểu Premiere — bản MVP chỉ ghép shot theo thứ tự + cắt ở mức file.

## Giới hạn phải biết

- Veo mỗi clip 4/6/8 giây, gen mất ~1–5 phút/clip (server poll tối đa 280 giây — quá hạn hãy đổi model sang Veo Fast/Lite trong Settings).
- Tiền gen tính thẳng vào tài khoản API của bạn; app không lưu trữ key ở nơi nào khác ngoài máy bạn chạy app.
