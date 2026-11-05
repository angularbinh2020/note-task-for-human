import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ToastProvider } from "@/components/ui/toast";
import { HomePage } from "@/pages/HomePage";
import type { Category, Column, Item } from "@/lib/types";

const mocks = vi.hoisted(() => ({
  listCategories: vi.fn(),
  createCategory: vi.fn(),
  updateCategory: vi.fn(),
  softDeleteCategory: vi.fn(),
  reorderCategories: vi.fn(),
  createColumn: vi.fn(),
  updateColumn: vi.fn(),
  softDeleteColumn: vi.fn(),
  reorderColumns: vi.fn(),
  createItem: vi.fn(),
  updateItem: vi.fn(),
  softDeleteItem: vi.fn(),
  moveItem: vi.fn(),
  reorderItems: vi.fn(),
  listTrash: vi.fn(),
  trashCount: vi.fn(),
  restoreEntity: vi.fn(),
  purgeEntity: vi.fn(),
  purgeExpired: vi.fn(),
  purgeAllTrash: vi.fn(),
  runStartupMaintenance: vi.fn(),
  exportJson: vi.fn(),
  importJson: vi.fn(),
  getDbPath: vi.fn(),
}));

vi.mock("@/lib/api", () => ({ api: mocks }));

const column: Column = {
  id: "col-1",
  name: "Đang chạy",
  code: "running",
  sortOrder: 0,
  deletedAt: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  items: [],
};

function makeItem(id: string, name: string, description = ""): Item {
  return {
    id,
    categoryId: "cat-1",
    columnId: "col-1",
    name,
    description,
    sortOrder: 0,
    deletedAt: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

const category: Category = {
  id: "cat-1",
  name: "Triển khai văn bản",
  description: "Mô tả ngắn",
  sortOrder: 0,
  collapsed: false,
  deletedAt: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  columns: [
    {
      ...column,
      items: [makeItem("i1", "Soạn tờ trình", "Bản nháp")],
    },
  ],
};

function renderPage() {
  render(
    <ToastProvider>
      <HomePage onTrashChanged={vi.fn()} />
    </ToastProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.listCategories.mockResolvedValue([]);
});

describe("HomePage", () => {
  it("home trống → empty state + CTA 'Tạo đầu mục đầu tiên'", async () => {
    renderPage();
    expect(
      await screen.findByText("Chưa có đầu mục nào."),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Tạo đầu mục đầu tiên/ }),
    ).toBeInTheDocument();
  });

  it("hiển thị đầu mục + cột + item từ API", async () => {
    mocks.listCategories.mockResolvedValue([category]);
    renderPage();

    expect(await screen.findByText("Triển khai văn bản")).toBeInTheDocument();
    expect(screen.getByText("Đang chạy")).toBeInTheDocument();
    expect(screen.getByText("running")).toBeInTheDocument();
    expect(screen.getByText("Soạn tờ trình")).toBeInTheDocument();
    expect(screen.getByText("Bản nháp")).toBeInTheDocument();
  });

  it("listCategories lỗi (DB hỏng) → màn lỗi + nút Thử lại", async () => {
    mocks.listCategories.mockRejectedValue(new Error("Database disk I/O error"));
    renderPage();

    expect(
      await screen.findByText("Không mở được dữ liệu"),
    ).toBeInTheDocument();
    expect(screen.getByText(/Database disk I\/O error/)).toBeInTheDocument();
    expect(
      screen.getByText(/khôi phục từ file JSON backup/),
    ).toBeInTheDocument();

    // Thử lại thành công → dữ liệu tải lại bình thường
    mocks.listCategories.mockResolvedValue([category]);
    await userEvent.click(screen.getByRole("button", { name: "Thử lại" }));
    expect(await screen.findByText("Triển khai văn bản")).toBeInTheDocument();
  });

  it("copy item → clipboard.writeText(item.name) + toast 'Đã copy'", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      configurable: true,
    });
    mocks.listCategories.mockResolvedValue([category]);
    renderPage();
    await screen.findByText("Soạn tờ trình");

    await userEvent.click(screen.getByTitle("Copy"));

    await waitFor(() => expect(writeText).toHaveBeenCalledWith("Soạn tờ trình"));
    expect(await screen.findByText("Đã copy")).toBeInTheDocument();
  });

  it("copy fail → toast lỗi, không crash", async () => {
    Object.defineProperty(navigator, "clipboard", {
      value: {
        writeText: vi.fn().mockRejectedValue(new Error("blocked")),
      },
      configurable: true,
    });
    mocks.listCategories.mockResolvedValue([category]);
    renderPage();
    await screen.findByText("Soạn tờ trình");

    await userEvent.click(screen.getByTitle("Copy"));
    expect(
      await screen.findByText("Không copy được clipboard"),
    ).toBeInTheDocument();
  });

  it("quick-add Enter → createItem(categoryId, columnId, name) và item xuất hiện cuối cột", async () => {
    const createdItem = makeItem("i2", "Việc mới");
    mocks.listCategories.mockResolvedValue([category]);
    mocks.createItem.mockResolvedValue(createdItem);
    renderPage();
    await screen.findByText("Soạn tờ trình");

    const input = screen.getByPlaceholderText("Thêm item…");
    await userEvent.type(input, "Việc mới{enter}");

    await waitFor(() =>
      expect(mocks.createItem).toHaveBeenCalledWith(
        "cat-1",
        "col-1",
        "Việc mới",
      ),
    );
    expect(await screen.findByText("Việc mới")).toBeInTheDocument();
  });

  it("click header đầu mục → toggle collapsed và persist qua updateCategory", async () => {
    mocks.listCategories.mockResolvedValue([category]);
    mocks.updateCategory.mockResolvedValue({ ...category, collapsed: true });
    renderPage();
    await screen.findByText("Triển khai văn bản");

    await userEvent.click(screen.getByText("Triển khai văn bản"));

    await waitFor(() =>
      expect(mocks.updateCategory).toHaveBeenCalledWith({
        id: "cat-1",
        collapsed: true,
      }),
    );
  });

  it("xóa item → softDeleteItem và item biến khỏi board", async () => {
    mocks.listCategories.mockResolvedValue([category]);
    mocks.softDeleteItem.mockResolvedValue(undefined);
    renderPage();
    await screen.findByText("Soạn tờ trình");

    const card = screen
      .getByText("Soạn tờ trình")
      .closest("div.group") as HTMLElement;
    await userEvent.click(within(card).getByTitle("Xóa"));

    await waitFor(() =>
      expect(mocks.softDeleteItem).toHaveBeenCalledWith("i1"),
    );
    await waitFor(() =>
      expect(screen.queryByText("Soạn tờ trình")).not.toBeInTheDocument(),
    );
  });

  it("sửa item qua dialog → updateItem được gọi", async () => {
    mocks.listCategories.mockResolvedValue([category]);
    mocks.updateItem.mockResolvedValue(
      makeItem("i1", "Soạn tờ trình (sửa)", "Bản nháp"),
    );
    renderPage();
    await screen.findByText("Soạn tờ trình");

    const card = screen
      .getByText("Soạn tờ trình")
      .closest("div.group") as HTMLElement;
    await userEvent.click(within(card).getByTitle("Sửa"));
    const dialog = await screen.findByRole("dialog");
    const nameInput = within(dialog).getByLabelText("Tên");
    await userEvent.clear(nameInput);
    await userEvent.type(nameInput, "Soạn tờ trình (sửa)");
    await userEvent.click(within(dialog).getByRole("button", { name: "Lưu" }));

    await waitFor(() =>
      expect(mocks.updateItem).toHaveBeenCalledWith({
        id: "i1",
        name: "Soạn tờ trình (sửa)",
        description: "Bản nháp",
      }),
    );
    expect(await screen.findByText("Soạn tờ trình (sửa)")).toBeInTheDocument();
  });

  it("xóa đầu mục (confirm OK) → softDeleteCategory + toast", async () => {
    vi.stubGlobal("confirm", vi.fn(() => true));
    mocks.listCategories.mockResolvedValue([category]);
    mocks.softDeleteCategory.mockResolvedValue(undefined);
    renderPage();
    await screen.findByText("Triển khai văn bản");

    const section = screen.getByText("Triển khai văn bản").closest("section")!;
    await userEvent.click(
      within(section.querySelector("header") as HTMLElement).getByTitle("Xóa"),
    );

    await waitFor(() =>
      expect(mocks.softDeleteCategory).toHaveBeenCalledWith("cat-1"),
    );
    expect(
      await screen.findByText("Đã chuyển đầu mục vào thùng rác"),
    ).toBeInTheDocument();
  });

  it("xóa đầu mục bị hủy confirm → không gọi API", async () => {
    vi.stubGlobal("confirm", vi.fn(() => false));
    mocks.listCategories.mockResolvedValue([category]);
    renderPage();
    await screen.findByText("Triển khai văn bản");

    const section = screen.getByText("Triển khai văn bản").closest("section")!;
    await userEvent.click(
      within(section.querySelector("header") as HTMLElement).getByTitle("Xóa"),
    );
    expect(mocks.softDeleteCategory).not.toHaveBeenCalled();
  });
});
