import { describe, expect, it } from "vitest";
import { cn, formatDateTime } from "@/lib/utils";

describe("cn", () => {
  it("nối các class và bỏ class falsy", () => {
    expect(cn("a", false && "b", "c", undefined, null)).toBe("a c");
  });

  it("merge class Tailwind trùng nhóm — class sau thắng", () => {
    expect(cn("p-2", "p-4")).toBe("p-4");
    expect(cn("text-sm", "text-lg")).toBe("text-lg");
  });

  it("giữ class khác nhóm khi merge", () => {
    expect(cn("p-2 text-sm", "p-4")).toBe("text-sm p-4");
  });

  it("class điều kiện (shake)", () => {
    expect(cn("base", true && "animate-[shake_0.3s_ease-in-out]")).toContain(
      "shake",
    );
  });
});

describe("formatDateTime", () => {
  it("format ISO hợp lệ sang locale vi-VN", () => {
    const out = formatDateTime("2026-01-05T10:00:00.000Z");
    expect(out).toContain("2026");
  });

  it("chuỗi không phải ngày → trả về 'Invalid Date' (không crash)", () => {
    expect(formatDateTime("khong-phai-ngay")).toBe("Invalid Date");
  });
});
