import {
  DndContext,
  DragEndEvent,
  DragOverEvent,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  horizontalListSortingStrategy,
} from "@dnd-kit/sortable";
import type { Category, Column, Item } from "@/lib/types";
import { ColumnView } from "@/components/ColumnView";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

type Props = {
  category: Category;
  onChangeCategory: (category: Category) => void;
  onQuickAdd: (columnId: string, name: string) => Promise<void>;
  onEditItem: (item: Item) => void;
  onDeleteItem: (item: Item) => void;
  onCopyItem: (item: Item) => void;
  onEditColumn: (column: Column) => void;
  onDeleteColumn: (column: Column) => void;
  onAddColumn: () => void;
  onReorderColumns: (ids: string[]) => Promise<void>;
  onMoveItem: (
    itemId: string,
    targetColumnId: string,
    targetIndex: number,
  ) => Promise<void>;
};

export function ColumnBoard({
  category,
  onChangeCategory,
  onQuickAdd,
  onEditItem,
  onDeleteItem,
  onCopyItem,
  onEditColumn,
  onDeleteColumn,
  onAddColumn,
  onReorderColumns,
  onMoveItem,
}: Props) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  function findColumnByItemId(itemId: string): Column | undefined {
    return category.columns.find((c) => c.items.some((i) => i.id === itemId));
  }

  function handleDragOver(event: DragOverEvent) {
    const { active, over } = event;
    if (!over || active.data.current?.type !== "item") return;

    const activeId = String(active.id);
    const overId = String(over.id);
    const activeColumn = findColumnByItemId(activeId);
    if (!activeColumn) return;

    let overColumnId: string | null = null;
    if (over.data.current?.type === "column") {
      overColumnId = over.data.current.columnId as string;
    } else if (over.data.current?.type === "item") {
      overColumnId = findColumnByItemId(overId)?.id ?? null;
    } else if (overId.startsWith("column-drop-")) {
      overColumnId = overId.replace("column-drop-", "");
    }
    if (!overColumnId || activeColumn.id === overColumnId) return;

    const overColumn = category.columns.find((c) => c.id === overColumnId);
    const item = activeColumn.items.find((i) => i.id === activeId);
    if (!overColumn || !item) return;

    const overIndex =
      over.data.current?.type === "item"
        ? overColumn.items.findIndex((i) => i.id === overId)
        : overColumn.items.length;
    const insertAt = overIndex < 0 ? overColumn.items.length : overIndex;

    onChangeCategory({
      ...category,
      columns: category.columns.map((col) => {
        if (col.id === activeColumn.id) {
          return { ...col, items: col.items.filter((i) => i.id !== activeId) };
        }
        if (col.id === overColumn.id) {
          const nextItems = [...col.items];
          nextItems.splice(insertAt, 0, { ...item, columnId: col.id });
          return { ...col, items: nextItems };
        }
        return col;
      }),
    });
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over) return;

    const activeId = String(active.id);
    const overId = String(over.id);

    if (active.data.current?.type === "column-sort") {
      const oldIndex = category.columns.findIndex(
        (c) => `column-${c.id}` === activeId,
      );
      const newIndex = category.columns.findIndex(
        (c) => `column-${c.id}` === overId,
      );
      if (oldIndex < 0 || newIndex < 0 || oldIndex === newIndex) return;
      const next = arrayMove(category.columns, oldIndex, newIndex);
      onChangeCategory({ ...category, columns: next });
      await onReorderColumns(next.map((c) => c.id));
      return;
    }

    if (active.data.current?.type === "item") {
      const column = findColumnByItemId(activeId);
      if (!column) return;

      let nextItems = [...column.items];
      if (over.data.current?.type === "item" && overId !== activeId) {
        const oldIndex = nextItems.findIndex((i) => i.id === activeId);
        const newIndex = nextItems.findIndex((i) => i.id === overId);
        if (oldIndex >= 0 && newIndex >= 0) {
          nextItems = arrayMove(nextItems, oldIndex, newIndex);
          onChangeCategory({
            ...category,
            columns: category.columns.map((c) =>
              c.id === column.id ? { ...c, items: nextItems } : c,
            ),
          });
        }
      }

      const idx = nextItems.findIndex((i) => i.id === activeId);
      await onMoveItem(activeId, column.id, Math.max(0, idx));
    }
  }

  if (category.columns.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-[var(--color-border)] bg-white/70 p-6 text-center">
        <p className="mb-3 text-sm text-[var(--color-muted-foreground)]">
          Đầu mục chưa có cột.
        </p>
        <Button onClick={onAddColumn}>
          <Plus className="h-4 w-4" /> Thêm cột
        </Button>
      </div>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragOver={handleDragOver}
      onDragEnd={(e) => void handleDragEnd(e)}
    >
      <div className="flex gap-3 overflow-x-auto pb-2">
        <SortableContext
          items={category.columns.map((c) => `column-${c.id}`)}
          strategy={horizontalListSortingStrategy}
        >
          {category.columns.map((column) => (
            <ColumnView
              key={column.id}
              column={column}
              onQuickAdd={(name) => onQuickAdd(column.id, name)}
              onEditItem={onEditItem}
              onDeleteItem={onDeleteItem}
              onCopyItem={onCopyItem}
              onEditColumn={() => onEditColumn(column)}
              onDeleteColumn={() => onDeleteColumn(column)}
            />
          ))}
        </SortableContext>
        <Button
          variant="outline"
          className="h-[42px] shrink-0 self-start"
          onClick={onAddColumn}
        >
          <Plus className="h-4 w-4" /> Thêm cột
        </Button>
      </div>
    </DndContext>
  );
}
