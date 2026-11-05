import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DndContext } from "@dnd-kit/core";
import { ColumnView } from "@/components/ColumnView";
import type { Column, Item } from "@/lib/types";

function makeItem(id: string, name: string): Item {
  return {
    id,
    categoryId: "cat-1",
    columnId: "col-1",
    name,
    description: "",
    sortOrder: 0,
    deletedAt: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

const baseColumn: Column = {
  id: "col-1",
  name: "Đang chạy",
  code: "running",
  sortOrder: 0,
  deletedAt: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  items: [],
};

function renderColumn(overrides: Partial<Column> = {}) {
  const onQuickAdd = vi.fn().mockResolvedValue(undefined);
  const onEditItem = vi.fn();
  const onDeleteItem = vi.fn();
  const onCopyItem = vi.fn();
  const onEditColumn = vi.fn();
  const onDeleteColumn = vi.fn();
  render(
    <DndContext>
      <ColumnView
        column={{ ...baseColumn, ...overrides }}
        onQuickAdd={onQuickAdd}
        onEditItem={onEditItem}
        onDeleteItem={onDeleteItem}
        onCopyItem={onCopyItem}
        onEditColumn={onEditColumn}
        onDeleteColumn={onDeleteColumn}
      />
    </DndContext>,
  );
  return {
    onQuickAdd,
    onEditItem,
    onDeleteItem,
    onCopyItem,
    onEditColumn,
    onDeleteColumn,
  };
}

describe("ColumnView", () => {
  it("hiển thị tên cột + code", () => {
    renderColumn();
    expect(screen.getByText("Đang chạy")).toBeInTheDocument();
    expect(screen.getByText("running")).toBeInTheDocument();
  });

  it("hiển thị số item đúng định dạng 'n item'", () => {
    renderColumn({
      items: [makeItem("i1", "Việc A"), makeItem("i2", "Việc B")],
    });
    expect(screen.getByText("Việc A")).toBeInTheDocument();
    expect(screen.getByText("Việc B")).toBeInTheDocument();
    expect(screen.getByText("2 item")).toBeInTheDocument();
  });

  it("cột trống → '0 item', vẫn có ô quick-add", () => {
    renderColumn();
    expect(screen.getByText("0 item")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Thêm item…")).toBeInTheDocument();
  });

  it("quick-add Enter → gọi onQuickAdd với name đã trim", async () => {
    const { onQuickAdd } = renderColumn();
    const user = userEvent.setup();

    const input = screen.getByPlaceholderText("Thêm item…");
    await user.type(input, "  Việc mới  {enter}");

    await vi.waitFor(() =>
      expect(onQuickAdd).toHaveBeenCalledWith("Việc mới"),
    );
  });

  it("quick-add rỗng → không gọi onQuickAdd", async () => {
    const { onQuickAdd } = renderColumn();
    const user = userEvent.setup();

    await user.type(screen.getByPlaceholderText("Thêm item…"), "{enter}");
    expect(onQuickAdd).not.toHaveBeenCalled();
  });
});
