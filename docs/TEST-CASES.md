# Test Cases — Offline Task Board

Bộ test case cho toàn bộ tính năng của ứng dụng, bám theo đặc tả
[`KE-HOACH-TRIEN-KHAI.md`](KE-HOACH-TRIEN-KHAI.md) (mục 6 – đặc tả chức năng,
mục 13 – checklist nghiệm thu).

> **Lưu ý thiết kế thực tế của app (khác bản đặc tả đầu):**
> - **Cột là global** — dùng chung mọi đầu mục, `code` unique toàn DB (kể cả trash chưa purge).
> - Khi **chạy lần đầu**, app tự seed 2 cột global mặc định: `Đang chạy`/`running`, `Chờ chạy`/`pending` (`seed_default_columns`).
> - Tạo đầu mục mới **không** sinh cột riêng cho đầu mục đó (dùng cột global).
> - Export hiện dùng **version 2** (columns ở top-level), import chấp nhận **v1 và v2**.

**Ký hiệu loại test:**
- `[AUTO]` — test tự động (Vitest cho UI/logic TS, `cargo test` cho Rust backend).
- `[MANUAL]` — test thủ công trên app thật (`npm run tauri dev`), bao gồm cả test cần môi trường Tauri/WebView2.

**Ký hiệu ưu tiên:** P1 = chặn release, P2 = quan trọng, P3 = nên có.

---

## 1. Database & khởi tạo (Rust)

| ID | Tiêu đề | Loại | Ưu tiên |
| --- | --- | --- | --- |
| TC-DB-01 | Mở DB mới → migrate tạo đủ 3 bảng `categories`, `columns`, `items` + index | [AUTO] `cargo test` | P1 |
| TC-DB-02 | Seed 2 cột mặc định `running`/`pending` khi bảng columns rỗng; không seed lại nếu đã có | [AUTO] `cargo test` | P1 |
| TC-DB-03 | `validate_column_code`: bỏ space đầu/cuối, rỗng → lỗi, ký tự đặc biệt (`@@`, dấu tiếng Việt) → lỗi | [AUTO] `cargo test` | P1 |
| TC-DB-04 | `code_exists`: check unique toàn DB, loại trừ chính record khi update (`exclude_id`) | [AUTO] `cargo test` | P1 |
| TC-DB-05 | `next_sort_order` trả `max(sort_order)+1`, bảng rỗng trả `0` | [AUTO] `cargo test` | P2 |
| TC-DB-06 | DB path đúng `%APPDATA%\com.notetask.forhuman\data.db`, tự tạo thư mục | [MANUAL] | P3 |

## 2. Đầu mục (Category)

| ID | Tiêu đề | Bước chính | Kỳ vọng | Loại | Ưu tiên |
| --- | --- | --- | --- | --- | --- |
| TC-CAT-01 | Tạo đầu mục hợp lệ | Home → Tạo đầu mục → nhập name + description → Lưu | Đầu mục xuất hiện cuối danh sách, expand sẵn, toast “Đã tạo đầu mục” | [AUTO] dialog test + [MANUAL] | P1 |
| TC-CAT-02 | `name` bắt buộc | Dialog tạo: để trống name → Lưu | Lỗi inline “Tên đầu mục là bắt buộc”, dialog không đóng, không gọi API | [AUTO] | P1 |
| TC-CAT-03 | `name` trim khoảng trắng | Nhập `"   Nhiệm vụ   "` → Lưu | Được tạo với name `"Nhiệm vụ"` | [AUTO] | P2 |
| TC-CAT-04 | Sửa đầu mục | Nút sửa → đổi name/description → Lưu | Danh sách cập nhật ngay, toast thành công | [AUTO] dialog + [MANUAL] | P1 |
| TC-CAT-05 | Sửa với name rỗng | Xóa hết name → Lưu | Lỗi inline, không gọi API | [AUTO] | P2 |
| TC-CAT-06 | Lỗi backend khi lưu | Submit khi API reject | Lỗi hiển thị inline trong dialog, dialog không đóng | [AUTO] | P2 |
| TC-CAT-07 | Xóa đầu mục → cascade soft-delete | Nút xóa → confirm | Đầu mục + toàn bộ item của nó vào thùng rác; cột global giữ nguyên; badge trash tăng | [MANUAL] + [AUTO] Rust | P1 |
| TC-CAT-08 | Xóa bị hủy ở confirm | Confirm = No | Không đổi gì | [MANUAL] | P2 |
| TC-CAT-09 | Sắp xếp đầu mục bằng kéo-thả | Kéo đầu mục A xuống dưới B | Thứ tự UI đổi ngay; reload trang/sort_order giữ nguyên (persist) | [MANUAL] (DnD cần con trỏ thật) | P1 |
| TC-CAT-10 | Collapse/expand | Click header đầu mục | Ẩn/hiện cột; trạng thái persist sau restart (`collapsed` lưu DB) | [MANUAL] | P1 |
| TC-CAT-11 | Home trống | DB rỗng | Empty state + CTA “Tạo đầu mục đầu tiên” | [AUTO] HomePage | P2 |
| TC-CAT-12 | API list lỗi (DB hỏng) | Mock `list_categories` reject | Màn lỗi đỏ + nút “Thử lại” | [AUTO] | P2 |

## 3. Cột (Column — global)

| ID | Tiêu đề | Bước chính | Kỳ vọng | Loại | Ưu tiên |
| --- | --- | --- | --- | --- | --- |
| TC-COL-01 | Thêm cột global hợp lệ | Thêm cột → name `Kiểm thử`, code `test` → Lưu | Cột mới xuất hiện cuối trong **mọi** đầu mục đang expand | [AUTO] dialog + [MANUAL] | P1 |
| TC-COL-02 | Name bắt buộc | Để trống name → Lưu | Lỗi inline “Tên cột là bắt buộc” | [AUTO] | P1 |
| TC-COL-03 | Code bắt buộc | Name hợp lệ, code rỗng → Lưu | Lỗi inline “Code là bắt buộc” | [AUTO] | P1 |
| TC-COL-04 | Code sai charset | Code `"code không hợp lệ!"` → Lưu | Lỗi inline “Code chỉ gồm a-z, A-Z, 0-9, _ và -”, không gọi API | [AUTO] | P1 |
| TC-COL-05 | Code trùng (active) | Tạo cột code `running` khi đã tồn tại | Backend trả lỗi “Code 'running' đã tồn tại”, hiển thị inline, dialog không đóng | [AUTO] dialog + [AUTO] Rust | P1 |
| TC-COL-06 | Code trùng với cột trong trash | Tạo code trùng cột đã xóa soft | Vẫn bị chặn (unique toàn DB) | [AUTO] Rust | P2 |
| TC-COL-07 | Sửa cột | Menu cột → Sửa cột → đổi name/code | Cập nhật mọi đầu mục; code mới vẫn pass unique | [AUTO] Rust + [MANUAL] | P1 |
| TC-COL-08 | Xóa cột global | Menu cột → Xóa cột → confirm | Cột biến khỏi mọi đầu mục; **mọi item** thuộc cột vào thùng rác | [AUTO] Rust + [MANUAL] | P1 |
| TC-COL-09 | Đầu mục 0 cột | Xóa hết cột global | Empty state “Đầu mục chưa có cột” + CTA Thêm cột | [AUTO] ColumnBoard | P2 |
| TC-COL-10 | Kéo sắp xếp cột | Kéo cột qua cột khác | Thứ tự đổi trong mọi đầu mục, persist sau restart | [MANUAL] | P1 |

## 4. Item

| ID | Tiêu đề | Bước chính | Kỳ vọng | Loại | Ưu tiên |
| --- | --- | --- | --- | --- | --- |
| TC-ITM-01 | Quick-add bằng Enter | Gõ name vào input đầu cột → Enter | Item được thêm **cuối cột**, input clear, giữ focus nhập tiếp | [AUTO] QuickAddInput + [AUTO] Rust | P1 |
| TC-ITM-02 | Quick-add name rỗng/chỉ space | Enter khi input rỗng | Không tạo item, hiệu ứng shake, input không clear | [AUTO] | P1 |
| TC-ITM-03 | Quick-add trim | Gõ `"  Việc A  "` → Enter | Item name `"Việc A"` | [AUTO] | P2 |
| TC-ITM-04 | Quick-add đang busy | Enter khi request chưa xong | Input disabled, không submit double | [AUTO] | P3 |
| TC-ITM-05 | Sửa item | Nút sửa (bút chì) → đổi name/description → Lưu | Card cập nhật; name rỗng → lỗi inline | [AUTO] dialog | P1 |
| TC-ITM-06 | Xóa item vào thùng rác | Nút xóa (không confirm) | Item biến khỏi cột ngay; badge trash tăng | [AUTO] Rust + [MANUAL] | P1 |
| TC-ITM-07 | Copy name | Nút Copy | Clipboard chứa đúng `item.name`; toast “Đã copy” | [AUTO] HomePage (mock clipboard) + [MANUAL] | P1 |
| TC-ITM-08 | Copy fail | Clipboard bị chặn | Toast lỗi “Không copy được clipboard” | [AUTO] | P3 |
| TC-ITM-09 | Kéo item đổi thứ tự trong cột | Kéo item A lên trên B | Thứ tự đổi, persist | [MANUAL] | P1 |
| TC-ITM-10 | Kéo item sang cột khác (cùng đầu mục) | Kéo item từ cột 1 sang cột 2 | Item chuyển cột tại vị trí thả, sort các cột được ghi DB | [MANUAL] + [AUTO] Rust `move_item` | P1 |
| TC-ITM-11 | Kéo item sang đầu mục khác | Kéo item ra ngoài đầu mục | Không cho phép (MVP) | [MANUAL] | P3 |
| TC-ITM-12 | Số item hiển thị | Cột có n item | Footer cột hiển thị “n item” đúng | [AUTO] ColumnView | P3 |

## 5. Thùng rác

| ID | Tiêu đề | Bước chính | Kỳ vọng | Loại | Ưu tiên |
| --- | --- | --- | --- | --- | --- |
| TC-TRH-01 | Liệt kê mọi entity đã xóa | Xóa lần lượt 1 đầu mục, 1 cột, 1 item → mở Thùng rác | 3 dòng: loại + tên + detail + thời điểm xóa + số ngày còn lại | [AUTO] Rust `list_trash` + [AUTO] TrashPage | P1 |
| TC-TRH-02 | Sắp xếp theo thời gian xóa | Nhiều bản ghi | Mới nhất lên đầu | [AUTO] Rust | P2 |
| TC-TRH-03 | Filter theo loại | Bấm tab Đầu mục / Cột / Item | Chỉ hiện đúng loại; tab “Tất cả” hiện đủ | [AUTO] TrashPage | P1 |
| TC-TRH-04 | Khôi phục item không có cha trong trash | Restore item | Item active trở lại cột | [AUTO] Rust + TrashPage | P1 |
| TC-TRH-05 | Khôi phục item khi cha đang trash | Xóa cột (item vào trash theo) → restore item | **Auto-restore chuỗi cha** (cột) + message “Đã khôi phục kèm chuỗi cha: cột.” | [AUTO] Rust | P1 |
| TC-TRH-06 | Khôi phục cột không kèm nội dung | Restore cột (không chọn kèm) | Cột active lại; items của cột **vẫn trong trash** | [AUTO] Rust | P1 |
| TC-TRH-07 | Khôi phục kèm nội dung | Nút “Kèm nội dung” | Cột + mọi item đang trash của cột cùng active | [AUTO] Rust + TrashPage | P1 |
| TC-TRH-08 | Khôi phục đầu mục | Restore category | Category active; children vẫn trash trừ khi kèm nội dung | [AUTO] Rust | P1 |
| TC-TRH-09 | Nút “Kèm nội dung” chỉ hiện cho category/column | Xem bảng trash | Item chỉ có Khôi phục + Xóa vĩnh viễn | [AUTO] TrashPage | P2 |
| TC-TRH-10 | Xóa vĩnh viễn 1 bản ghi | Xóa vĩnh viễn → confirm | Record biến mất khỏi trash; không còn khôi phục được | [AUTO] Rust + TrashPage (confirm cancel được) | P1 |
| TC-TRH-11 | Dọn quá 30 ngày | Bấm “Dọn quá 30 ngày” | Chỉ records `deleted_at` ≤ 30 ngày bị hard-delete; trả số lượng + toast | [AUTO] Rust `purge_expired` | P1 |
| TC-TRH-12 | Dọn tất cả | “Dọn tất cả” → confirm mạnh | Trash rỗng, empty state “Thùng rác trống” | [AUTO] Rust + TrashPage | P1 |
| TC-TRH-13 | Auto-purge khi mở app | Đặt `deleted_at` = 31 ngày trước → mở lại app | Records bị xóa cứng lúc boot (`run_startup_maintenance`) | [AUTO] Rust + [MANUAL] | P1 |
| TC-TRH-14 | `days_remaining` tính đúng | deleted_at = hôm nay → 30; = 29 ngày trước → 1; ≥ 30 ngày → 0 (không âm) | Đúng như kỳ vọng | [AUTO] Rust | P2 |
| TC-TRH-15 | Badge số lượng trên nav | Có 3 records trong trash | Nav “Thùng rác” hiển thị badge `3`; tăng/giảm sau mỗi thao tác | [AUTO] App shell + [MANUAL] | P2 |
| TC-TRH-16 | Trash trống | Không có record nào | Empty state “Thùng rác trống” | [AUTO] TrashPage | P2 |

## 6. Import / Export JSON

| ID | Tiêu đề | Bước chính | Kỳ vọng | Loại | Ưu tiên |
| --- | --- | --- | --- | --- | --- |
| TC-IO-01 | Export v2 đúng cấu trúc | Export (mặc định include trash) | JSON có `version: 2`, `columns` top-level, `categories[].columns[].items` | [AUTO] Rust + [MANUAL] | P1 |
| TC-IO-02 | Export tùy chọn không gồm thùng rác | Bỏ checkbox “Bao gồm thùng rác” → Export | JSON không chứa bản ghi `deletedAt != null` | [MANUAL] + [AUTO] Rust | P2 |
| TC-IO-03 | Export file dialog | Bấm Export JSON… | Hộp thoại save với default name `task-board-backup-YYYY-MM-DD.json` | [MANUAL] | P2 |
| TC-IO-04 | Import v2 thay thế toàn bộ | Import file v2 → confirm | DB bị thay thế hoàn toàn (items, columns, categories đúng theo file) | [AUTO] Rust `import_json` | P1 |
| TC-IO-05 | Import v1 (legacy) | Import file version 1 (columns lồng trong category, code trùng `running_x`) | Dedupe cột theo code về global; import thành công | [AUTO] Rust | P2 |
| TC-IO-06 | Import JSON sai cú pháp | Import file không phải JSON | Toast lỗi “JSON không hợp lệ…”, DB giữ nguyên | [AUTO] Rust + [MANUAL] | P1 |
| TC-IO-07 | Import sai version | `version: 99` | Lỗi “Version 99 không được hỗ trợ”, DB giữ nguyên | [AUTO] Rust | P1 |
| TC-IO-08 | Import trùng `code` (v2) | 2 columns cùng code | Lỗi “Trùng column code”, DB giữ nguyên | [AUTO] Rust | P1 |
| TC-IO-09 | Import trùng ID | 2 categories cùng id | Lỗi “Trùng category id”, DB giữ nguyên | [AUTO] Rust | P2 |
| TC-IO-10 | Import thiếu name | Column/Category/Item không có name | Lỗi tương ứng, DB giữ nguyên | [AUTO] Rust | P2 |
| TC-IO-11 | Import code sai charset | Code `"có dấu!"` | Lỗi “Code không hợp lệ”, DB giữ nguyên | [AUTO] Rust | P2 |
| TC-IO-12 | Import bị hủy ở confirm | Chọn file → confirm = No | Không đọc/ghi gì, DB giữ nguyên | [MANUAL] | P2 |
| TC-IO-13 | Export → Import round-trip | Export v2 → import lại file đó | Dữ liệu sau import giống trước export (round-trip không mất dữ liệu) | [AUTO] Rust + [MANUAL] | P1 |

## 7. Trạng thái, lỗi & phi chức năng

| ID | Tiêu đề | Kỳ vọng | Loại | Ưu tiên |
| --- | --- | --- | --- | --- |
| TC-ST-01 | Copy clipboard fail → toast lỗi | Thấy toast variant error | [AUTO] | P3 |
| TC-ST-02 | Mọi thao tác lỗi hiển thị toast error, không crash app | App vẫn dùng được sau lỗi | [MANUAL] | P2 |
| TC-ST-03 | Phím tắt: Enter submit trong dialog; Esc đóng dialog (Radix) | Đúng | [MANUAL] | P3 |
| TC-ST-04 | Offline hoàn toàn | Tắt mạng, mọi tính năng vẫn chạy | [MANUAL] | P1 |
| TC-ST-05 | Dữ liệu persist sau restart app | Thứ tự, collapse, items… giữ nguyên | [MANUAL] | P1 |
| TC-ST-06 | DB corrupt → màn lỗi + gợi ý restore từ JSON | Màn lỗi đỏ + “Thử lại” + hướng dẫn | [AUTO] HomePage error + [MANUAL] | P2 |
| TC-ST-07 | Resize cửa sổ, cột horizontal scroll, Home vertical scroll | Layout không vỡ | [MANUAL] | P3 |
| TC-ST-08 | Toast tự ẩn sau ~3s, nhiều toast xếp chồng | Đúng | [AUTO] ToastProvider + [MANUAL] | P3 |

---

## 8. Test tự động — bản đồ phủ (traceability)

### Frontend (Vitest — `npm test` / `npx vitest run`)

| File test | Phủ test case |
| --- | --- |
| `src/lib/__tests__/utils.test.ts` | `cn`, `formatDateTime` (hỗ trợ TC-ST-* render) |
| `src/lib/__tests__/json-schema.test.ts` | Pre-check file JSON phía client (TC-IO-06 dạng client) |
| `src/components/__tests__/QuickAddInput.test.tsx` | TC-ITM-01…04 |
| `src/components/__tests__/ItemCard.test.tsx` | Nút Copy/Sửa/Xóa gọi đúng callback (TC-ITM-05…07 phần UI) |
| `src/components/__tests__/ColumnView.test.tsx` | Hiển thị cột, code, số item (TC-COL-*, TC-ITM-12) |
| `src/components/__tests__/dialogs.test.tsx` | TC-CAT-01…06, TC-COL-01…05, TC-ITM-05 |
| `src/pages/__tests__/TrashPage.test.tsx` | TC-TRH-01, 03, 09, 16 + restore/purge gọi đúng API |
| `src/pages/__tests__/HomePage.test.tsx` | TC-CAT-11, TC-CAT-12, TC-ITM-07, 08 |

### Backend (Rust — `cd src-tauri && cargo test`)

| File test | Phủ test case |
| --- | --- |
| `src-tauri/src/db.rs` (`#[cfg(test)]`) | TC-DB-01…05, TC-COL-05, 06 |
| `src-tauri/src/commands/trash.rs` (`#[cfg(test)]`) | TC-TRH-04…08, 10…14 |
| `src-tauri/src/commands/io.rs` (`#[cfg(test)]`) | TC-IO-01, 04…11 |

> Rust tests cần Rust toolchain (máy hiện tại chưa cài — xem README mục yêu cầu).
> Chạy: `cargo test` trong `src-tauri/`.

### Thủ công (E2E trên app thật — `npm run tauri dev`)

DnD thật (TC-CAT-09, TC-COL-10, TC-ITM-09…11), persist sau restart
(TC-CAT-10, TC-ST-05), auto-purge khi boot (TC-TRH-13), file dialog
(TC-IO-03), offline (TC-ST-04), layout/resize (TC-ST-07), phím tắt (TC-ST-03).

## 9. Kịch bản smoke test thủ công (chạy trước mỗi release)

1. Mở app (offline) → Home tải danh sách, badge trash đúng.
2. Tạo đầu mục “Smoke Test” + mô tả → expand, thấy các cột global.
3. Quick-add 2 item ở cột `Đang chạy` → xuất hiện cuối cột.
4. Copy item 1 → dán đâu đó ra ngoài thấy đúng name.
5. Kéo item 1 sang `Chờ chạy` → chuyển cột OK.
6. Sửa item 2 thêm description → card hiển thị description.
7. Xóa cả 2 item → badge trash = 2.
8. Vào Thùng rác → thấy 2 item → “Khôi phục” item 1 → item 1 quay lại cột.
9. Xóa vĩnh viễn item 2 → badge = 1.
10. Export JSON (bao gồm trash) → import lại → dữ liệu đồng nhất.
11. Restart app → thứ tự/trạng thái giữ nguyên.
