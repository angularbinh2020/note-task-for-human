import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DndContext } from "@dnd-kit/core";
import { ItemCard } from "@/components/ItemCard";
import type { Item } from "@/lib/types";

const baseItem: Item = {
  id: "item-1",
  categoryId: "cat-1",
  columnId: "col-1",
  name: "Soạn tờ trình",
  description: "Bản nháp đầu tiên",
  sortOrder: 0,
  deletedAt: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

function renderCard(overrides: Partial<Item> = {}) {
  const onEdit = vi.fn();
  const onDelete = vi.fn();
  const onCopy = vi.fn();
  render(
    <DndContext>
      <ItemCard
        item={{ ...baseItem, ...overrides }}
        onEdit={onEdit}
        onDelete={onDelete}
        onCopy={onCopy}
      />
    </DndContext>,
  );
  return { onEdit, onDelete, onCopy };
}

describe("ItemCard", () => {
  it("hiển thị name và description", () => {
    renderCard();
    expect(screen.getByText("Soạn tờ trình")).toBeInTheDocument();
    expect(screen.getByText("Bản nháp đầu tiên")).toBeInTheDocument();
  });

  it("không có description → không render khối mô tả", () => {
    renderCard({ description: "" });
    expect(screen.getByText("Soạn tờ trình")).toBeInTheDocument();
    expect(screen.queryByText("Bản nháp đầu tiên")).not.toBeInTheDocument();
  });

  it("nút Copy gọi onCopy", async () => {
    const { onCopy } = renderCard();
    const user = userEvent.setup();
    await user.click(screen.getByTitle("Copy"));
    expect(onCopy).toHaveBeenCalledTimes(1);
  });

  it("nút Sửa gọi onEdit", async () => {
    const { onEdit } = renderCard();
    const user = userEvent.setup();
    await user.click(screen.getByTitle("Sửa"));
    expect(onEdit).toHaveBeenCalledTimes(1);
  });

  it("nút Xóa gọi onDelete", async () => {
    const { onDelete } = renderCard();
    const user = userEvent.setup();
    await user.click(screen.getByTitle("Xóa"));
    expect(onDelete).toHaveBeenCalledTimes(1);
  });
});
