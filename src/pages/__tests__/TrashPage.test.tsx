import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ToastProvider } from "@/components/ui/toast";
import { TrashPage } from "@/pages/TrashPage";
import type { TrashItem } from "@/lib/types";

const mocks = vi.hoisted(() => ({
  listTrash: vi.fn(),
  restoreEntity: vi.fn(),
  purgeEntity: vi.fn(),
  purgeExpired: vi.fn(),
  purgeAllTrash: vi.fn(),
}));

vi.mock("@/lib/api", () => ({ api: mocks }));

function makeTrash(
  entityType: string,
  id: string,
  name: string,
  extra: Partial<TrashItem> = {},
): TrashItem {
  return {
    entityType,
    id,
    name,
    detail: "",
    deletedAt: "2026-11-04T00:00:00.000Z",
    daysRemaining: 29,
    parentHint: null,
    ...extra,
  };
}

function renderPage() {
  render(
    <ToastProvider>
      <TrashPage onChanged={vi.fn()} />
    </ToastProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("confirm", vi.fn(() => true));
  mocks.listTrash.mockResolvedValue([]);
});

describe("TrashPage", () => {
  it("thùng rác trống → empty state 'Thùng rác trống'", async () => {
    renderPage();
    expect(await screen.findByText("Thùng rác trống")).toBeInTheDocument();
  });

  it("liệt kê mọi loại entity với nhãn tiếng Việt + số ngày còn lại", async () => {
    mocks.listTrash.mockResolvedValue([
      makeTrash("category", "c1", "Đầu mục A"),
      makeTrash("column", "k1", "Cột B", { detail: "test-code" }),
      makeTrash("item", "i1", "Item C", { parentHint: "Đầu mục A / Cột B" }),
    ]);
    renderPage();

    expect(await screen.findByText("Đầu mục A")).toBeInTheDocument();
    const rows = screen.getAllByRole("row");
    expect(
      rows.some((r) => within(r).queryByText("Đầu mục") !== null),
    ).toBe(true);
    expect(
      rows.some((r) => within(r).queryByText("Cột") !== null),
    ).toBe(true);
    expect(
      rows.some((r) => within(r).queryByText("Item") !== null),
    ).toBe(true);
    expect(screen.getAllByText("29 ngày")).toHaveLength(3);
    expect(screen.getByText("test-code")).toBeInTheDocument();
    expect(screen.getByText("Đầu mục A / Cột B")).toBeInTheDocument();
  });

  it("filter tab 'Item' → chỉ hiện item", async () => {
    mocks.listTrash.mockResolvedValue([
      makeTrash("category", "c1", "Đầu mục A"),
      makeTrash("item", "i1", "Item C"),
    ]);
    renderPage();
    await screen.findByText("Đầu mục A");

    await userEvent.click(screen.getByRole("button", { name: "Item" }));
    expect(screen.getByText("Item C")).toBeInTheDocument();
    expect(screen.queryByText("Đầu mục A")).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Tất cả" }));
    expect(screen.getByText("Đầu mục A")).toBeInTheDocument();
    expect(screen.getByText("Item C")).toBeInTheDocument();
  });

  it("nút 'Kèm nội dung' chỉ hiện với category/column, không hiện với item", async () => {
    mocks.listTrash.mockResolvedValue([
      makeTrash("category", "c1", "Đầu mục A"),
      makeTrash("item", "i1", "Item C"),
    ]);
    renderPage();
    await screen.findByText("Đầu mục A");

    const catRow = screen.getByText("Đầu mục A").closest("tr")!;
    expect(
      within(catRow).getByRole("button", { name: "Kèm nội dung" }),
    ).toBeInTheDocument();

    const itemRow = screen.getByText("Item C").closest("tr")!;
    expect(
      within(itemRow).queryByRole("button", { name: "Kèm nội dung" }),
    ).not.toBeInTheDocument();
    expect(
      within(itemRow).getByRole("button", { name: "Khôi phục" }),
    ).toBeInTheDocument();
  });

  it("Khôi phục item → gọi restoreEntity(entityType, id, false) + toast", async () => {
    mocks.listTrash.mockResolvedValue([makeTrash("item", "i1", "Item C")]);
    mocks.restoreEntity.mockResolvedValue({ restoredParents: [], message: null });
    renderPage();
    await screen.findByText("Item C");

    await userEvent.click(screen.getByRole("button", { name: "Khôi phục" }));

    await waitFor(() =>
      expect(mocks.restoreEntity).toHaveBeenCalledWith("item", "i1", false),
    );
    expect(await screen.findByText("Đã khôi phục")).toBeInTheDocument();
  });

  it("Khôi phục có message từ backend → toast hiển thị message", async () => {
    mocks.listTrash.mockResolvedValue([makeTrash("item", "i1", "Item C")]);
    mocks.restoreEntity.mockResolvedValue({
      restoredParents: ["cột"],
      message: "Đã khôi phục kèm chuỗi cha: cột.",
    });
    renderPage();
    await screen.findByText("Item C");

    await userEvent.click(screen.getByRole("button", { name: "Khôi phục" }));
    expect(
      await screen.findByText("Đã khôi phục kèm chuỗi cha: cột."),
    ).toBeInTheDocument();
  });

  it("'Kèm nội dung' → restoreEntity với withChildren = true", async () => {
    mocks.listTrash.mockResolvedValue([makeTrash("column", "k1", "Cột B")]);
    mocks.restoreEntity.mockResolvedValue({ restoredParents: [], message: null });
    renderPage();
    await screen.findByText("Cột B");

    await userEvent.click(screen.getByRole("button", { name: "Kèm nội dung" }));

    await waitFor(() =>
      expect(mocks.restoreEntity).toHaveBeenCalledWith("column", "k1", true),
    );
  });

  it("Xóa vĩnh viễn (confirm OK) → gọi purgeEntity", async () => {
    mocks.listTrash.mockResolvedValue([makeTrash("item", "i1", "Item C")]);
    renderPage();
    await screen.findByText("Item C");

    await userEvent.click(
      screen.getByRole("button", { name: "Xóa vĩnh viễn" }),
    );

    await waitFor(() =>
      expect(mocks.purgeEntity).toHaveBeenCalledWith("item", "i1"),
    );
    expect(await screen.findByText("Đã xóa vĩnh viễn")).toBeInTheDocument();
  });

  it("Xóa vĩnh viễn bị hủy ở confirm → không gọi purgeEntity", async () => {
    vi.stubGlobal("confirm", vi.fn(() => false));
    mocks.listTrash.mockResolvedValue([makeTrash("item", "i1", "Item C")]);
    renderPage();
    await screen.findByText("Item C");

    await userEvent.click(
      screen.getByRole("button", { name: "Xóa vĩnh viễn" }),
    );

    expect(mocks.purgeEntity).not.toHaveBeenCalled();
  });

  it("'Dọn quá 30 ngày' → gọi purgeExpired + toast số lượng", async () => {
    mocks.listTrash.mockResolvedValue([
      makeTrash("item", "i1", "Item C"),
      makeTrash("column", "k1", "Cột B"),
    ]);
    mocks.purgeExpired.mockResolvedValue(2);
    renderPage();
    await screen.findByText("Item C");

    await userEvent.click(
      screen.getByRole("button", { name: "Dọn quá 30 ngày" }),
    );

    await waitFor(() => expect(mocks.purgeExpired).toHaveBeenCalledTimes(1));
    expect(
      await screen.findByText("Đã dọn 2 mục quá 30 ngày"),
    ).toBeInTheDocument();
  });

  it("'Dọn tất cả' (confirm OK) → gọi purgeAllTrash + toast", async () => {
    mocks.listTrash.mockResolvedValue([makeTrash("item", "i1", "Item C")]);
    mocks.purgeAllTrash.mockResolvedValue(5);
    renderPage();
    await screen.findByText("Item C");

    await userEvent.click(screen.getByRole("button", { name: "Dọn tất cả" }));

    await waitFor(() => expect(mocks.purgeAllTrash).toHaveBeenCalledTimes(1));
    expect(await screen.findByText("Đã dọn 5 mục")).toBeInTheDocument();
  });

  it("'Dọn tất cả' bị hủy confirm → không gọi purgeAllTrash", async () => {
    vi.stubGlobal("confirm", vi.fn(() => false));
    mocks.listTrash.mockResolvedValue([makeTrash("item", "i1", "Item C")]);
    renderPage();
    await screen.findByText("Item C");

    await userEvent.click(screen.getByRole("button", { name: "Dọn tất cả" }));

    expect(mocks.purgeAllTrash).not.toHaveBeenCalled();
  });

  it("listTrash lỗi → toast error, không crash", async () => {
    mocks.listTrash.mockRejectedValue(new Error("DB mở thất bại"));
    renderPage();
    expect(await screen.findByText(/DB mở thất bại/)).toBeInTheDocument();
  });
});
