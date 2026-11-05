import { describe, expect, it } from "vitest";
import { EXPORT_VERSION, isLikelyExportJson } from "@/lib/json-schema";

describe("isLikelyExportJson", () => {
  it("nhận file export version 1 với categories là mảng", () => {
    const raw = JSON.stringify({ version: 1, categories: [] });
    expect(isLikelyExportJson(raw)).toBe(true);
  });

  it("nhận file có dữ liệu thật", () => {
    const raw = JSON.stringify({
      version: 1,
      exportedAt: "2026-01-01T00:00:00.000Z",
      categories: [{ id: "c1", name: "Việc", columns: [] }],
    });
    expect(isLikelyExportJson(raw)).toBe(true);
  });

  it("từ chối version khác EXPORT_VERSION (ví dụ version 2)", () => {
    const raw = JSON.stringify({ version: 2, categories: [] });
    expect(isLikelyExportJson(raw)).toBe(false);
  });

  it("từ chối khi thiếu categories", () => {
    const raw = JSON.stringify({ version: EXPORT_VERSION });
    expect(isLikelyExportJson(raw)).toBe(false);
  });

  it("từ chối khi categories không phải mảng", () => {
    const raw = JSON.stringify({ version: 1, categories: "abc" });
    expect(isLikelyExportJson(raw)).toBe(false);
  });

  it("từ chối JSON sai cú pháp", () => {
    expect(isLikelyExportJson("{khong phai json")).toBe(false);
  });
});
