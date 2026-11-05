# Offline Task Board

Ứng dụng desktop offline trên Windows 10/11 để quản lý đầu mục nhiệm vụ dạng board cột động (Tauri 2 + React + TypeScript + SQLite).

## Yêu cầu

- Node.js 20+
- Rust stable (`x86_64-pc-windows-msvc`)
- Visual Studio 2022 Build Tools **kèm Windows 10/11 SDK** (cần `kernel32.lib`)
- [WebView2 Runtime](https://developer.microsoft.com/microsoft-edge/webview2/) (Windows 11 thường có sẵn)

> Nếu `cargo` báo thiếu `kernel32.lib`, mở Visual Studio Installer → Modify → tick **Windows 11 SDK** (hoặc Windows 10 SDK).

## Chạy dev

```bash
npm install
npm run tauri dev
```

## Build installer (Windows)

```bash
npm run tauri build
```

Artifact NSIS/MSI nằm trong `src-tauri/target/release/bundle/`.

## Database

File SQLite: `%APPDATA%\com.notetask.forhuman\data.db`

Sao lưu khuyến nghị: dùng mục **Dữ liệu → Export JSON** (mặc định gồm cả thùng rác).

## Test

```bash
npm test        # chạy 1 lần (Vitest + Testing Library)
npm run test:watch
```

Test backend (Rust, cần cài Rust toolchain):

```bash
cd src-tauri
cargo test
```

Danh sách test case đầy đủ (tự động + thủ công): [`docs/TEST-CASES.md`](docs/TEST-CASES.md).

## Tính năng chính

- Đầu mục → cột động → item
- Kéo-thả sắp xếp đầu mục / cột / item (trong cùng đầu mục)
- Soft delete vào thùng rác, khôi phục, auto-purge sau 30 ngày
- Import/export JSON (import thay thế toàn bộ)

Chi tiết đặc tả: [`docs/KE-HOACH-TRIEN-KHAI.md`](docs/KE-HOACH-TRIEN-KHAI.md)
