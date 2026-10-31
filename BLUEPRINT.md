# Video AI Studio — Blueprint (bản nháp để duyệt, 2026-10-31)

Mục tiêu: 1 repo web studio có cấu trúc làm việc giống LibTV trong 2 ảnh user gửi
(canvas node + thư viện tài sản + các shot S01–S09 + bìa), nhưng chạy bằng
API key của chính user: OpenAI + Google Gemini (BYOK), không dùng credit LibTV,
không dùng model Seedance/Kling/Wan của LiblibAI.

## 1. Cấu trúc LibTV đối chiếu từ ảnh

| Bên LibTV (trong ảnh) | Bên repo này |
|---|---|
| Cột trái: Tải lên / Sản phẩm / Bảng phân cảnh thử / Tạo màng phế thải | Asset Library: Upload, Character, Environment, Prop, Storyboard thử, Thùng bản hỏng (giữ mọi version, không ghi đè) |
| Nhóm "Vai trò" (sheet nhân vật 3 góc, rồng, mèo hiệp sĩ, chuối...) | CharacterNode: sheet khóa mặt + 3 góc toàn thân, dùng làm reference cho mọi shot |
| Nhóm "môi trường" (cảnh đồng cỏ / núi) | EnvironmentNode: ảnh bối cảnh trống |
| Các cụm S01, S02, S03, S04, S05, S06, S07–S09, mỗi cụm nhiều thumbnail nối tiếp | ShotGroup / ShotNode: kịch bản bóc thành shot đánh số, mỗi shot có prompt, thời lượng, ảnh đầu/cuối, các version video |
| Cột phải: 封面 (bìa) | CoverNode + FinalNode: bìa và phim hoàn chỉnh ghép từ các shot đã chọn |
| Trang "Tài liệu dự án": hình ảnh 34, băng hình 53, tab Vai trò / Bối cảnh / khác, Đoạn video / Phim hoàn chỉnh | Project Assets page: đếm + lọc theo loại, giống bố cục ảnh 2 |
| Panel trái "TV Director / Đạo diễn truyền hình" | Director Chat: LLM hỗ trợ viết kịch bản, bóc storyboard, tối ưu prompt (chọn GPT hoặc Gemini) |
| Dây nối asset -> rất nhiều shot | Canvas vô hạn (React Flow): kéo-thả node, nối edge, 1 asset cấp cho nhiều shot |

Quy tắc sản xuất giữ nguyên từ skill ai_video_production hiện có:
style block nguyên văn trong mọi prompt, nhân vật chưa có sheet khóa thì chưa gen shot,
giữ mọi version kể cả bản hỏng, tách lớp tiếng khỏi lớp hình, quay thừa ~3x.

## 2. Điểm khác quyết định: OpenAI KHÔNG còn API video (đã kiểm tra 2026-10-31)

- Sora 2 API (sora-2 / sora-2-pro) đã bị OpenAI tắt ngày 24/09/2026, không có model thay thế.
  => Không thể hứa "video bằng key OpenAI". Nếu code chết Sora vào thì repo hỏng ngay từ đầu.
- Gemini API vẫn còn video: Veo 3.1 / Veo 3.1 Fast / Veo 3.1 Lite (veo-3.1-generate-preview),
  clip 4/6/8 giây, có tiếng native, nhận tối đa 3 ảnh reference, là API trả phí (không có free tier cho Veo).
- Ảnh phía Gemini: dùng họ Gemini Image (Nano Banana: gemini-3.1-flash-image, gemini-3-pro-image);
  Imagen đã rút khỏi Gemini API ngày 17/08/2026.
- Ảnh phía OpenAI: GPT Image 2.5 (gpt-image-2.5-flare = nhanh/mặc định, gpt-image-2.5-sunburst = sửa chi tiết);
  gpt-image-1 đã tắt 23/10/2026.

### Phân công provider (thiết kế để không phụ thuộc 1 hãng)

| Việc | OpenAI (OPENAI_API_KEY) | Gemini (GEMINI_API_KEY) |
|---|---|---|
| Director chat, viết kịch bản, bóc shot, sửa prompt | GPT (Responses API) | Gemini Flash/Pro (chọn qua lại được) |
| Sheet nhân vật, storyboard, bìa | GPT Image 2.5 Flare/Sunburst | Gemini Image (Nano Banana) — mạnh ở sửa ảnh giữ nhân vật |
| Gen video từng shot | (không có — để trống adapter) | Veo 3.1 / Fast / Lite |
| Thoại TTS | OpenAI TTS | Gemini TTS |
| Lồng phụ đề / chép lời | Whisper | — |

Lớp provider là interface chung (generateImage / generateVideo / chat / tts).
Sau này OpenAI ra lại API video, hoặc user muốn thêm Kling/Runway/fal.ai,
chỉ cần thêm 1 adapter, không sửa canvas hay dữ liệu shot.

## 3. Cây repo đề xuất (1 app Next.js duy nhất — ponytail: không tách backend)

```
video-ai-studio/
  .env.example            # OPENAI_API_KEY=  GEMINI_API_KEY=  (key chỉ ở server, không commit)
  README.md
  package.json            # next, react, @xyflow/react, prisma, openai, @google/genai
  prisma/schema.prisma    # SQLite: Project, Asset, Character, Shot, Generation, Job
  storage/                # file ảnh/video gen ra (local, theo project/shot/version)
  src/
    app/
      page.tsx            # danh sách project
      projects/[id]/canvas/page.tsx    # canvas node kiểu LibTV
      projects/[id]/assets/page.tsx    # thư viện tài sản kiểu ảnh 2
      settings/page.tsx                # nhập 2 key, nút test key
      api/  projects/ assets/ shots/ generate/image|video/ jobs/[id]/ director/ export/
    components/canvas/    # UploadNode, CharacterNode, EnvironmentNode, ShotNode, CoverNode, FinalNode
    components/assets/    # lưới tài sản + lọc Vai trò/Bối cảnh/Đạo cụ/Khác
    lib/providers/        # types.ts, openai.ts, gemini.ts, index.ts (chọn provider theo node)
    lib/jobs.ts           # hàng đợi đơn giản trong DB + poll Veo long-running, không Redis
    lib/export.ts         # ghép shot đã chọn bằng ffmpeg -> phim hoàn chỉnh + bìa
    lib/style-block.ts    # style block khóa nguyên văn, chèn đầu mọi prompt
```

DB: SQLite cho bản cá nhân (0 cấu hình). Lên multi-user/deploy thật mới đổi Prisma sang Postgres.

## 4. Lộ trình MVP

- Pha 1 (dùng được): tạo project -> canvas + node Upload/Character/Environment/Shot ->
  nối dây -> gen ảnh (2 provider) -> gen video Veo -> xem version, chọn bản tốt -> lưu asset library.
- Pha 2: Director chat bóc kịch bản thành S01.. tự động + style block + sheet nhân vật khóa.
- Pha 3: Export ffmpeg (ghép shot đã chọn, cắt đuôi, gắn phụ đề/TTS) + CoverNode + trang Assets đếm/lọc.
- Để sau (YAGNI, chưa làm ở MVP): multi-user/login, thanh toán, 3D-BOX, timeline editor đầy đủ như Premiere.

## 5. Chi phí & giới hạn phải biết trước

- Tiền gen tính thẳng vào tài khoản API của user (Veo tính theo giây, ảnh tính theo ảnh/token), không qua credit của repo.
- Veo mỗi clip tối đa 8s: phim dài làm đúng kiểu LibTV trong ảnh — nhiều shot ngắn rồi ghép, không gen 1 phát dài.
- Key để ở .env.local phía server; Settings chỉ hiển thị dạng che (sk-...abcd), không trả key về trình duyệt.
