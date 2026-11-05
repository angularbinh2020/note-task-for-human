import { useDroppable } from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";
import type { Column, Item } from "@/lib/types";
import { ItemCard } from "@/components/ItemCard";
import { QuickAddInput } from "@/components/QuickAddInput";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";

type Props = {
  column: Column;
  onQuickAdd: (name: string) => Promise<void>;
  onEditItem: (item: Item) => void;
  onDeleteItem: (item: Item) => void;
  onCopyItem: (item: Item) => void;
  onEditColumn: () => void;
  onDeleteColumn: () => void;
};

export function ColumnView({
  column,
  onQuickAdd,
  onEditItem,
  onDeleteItem,
  onCopyItem,
  onEditColumn,
  onDeleteColumn,
}: Props) {
  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: `column-drop-${column.id}`,
    data: { type: "column", columnId: column.id },
  });

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: `column-${column.id}`,
    data: { type: "column-sort", column },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex w-[45%] min-w-[220px] shrink-0 flex-col rounded-lg border border-[var(--color-border)] bg-[#f8fafc]",
        isDragging && "opacity-70",
        isOver && "ring-2 ring-[var(--color-accent)]",
      )}
    >
      <div className="flex items-start gap-1 border-b border-[var(--color-border)] px-2 py-2">
        <button
          type="button"
          className="mt-1 cursor-grab text-[var(--color-muted-foreground)]"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-4 w-4" />
        </button>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold">{column.name}</div>
          <div className="truncate text-[11px] text-[var(--color-muted-foreground)]">
            {column.code}
          </div>
        </div>
        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <Button size="icon" variant="ghost">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content className="z-50 min-w-[140px] rounded-md border border-[var(--color-border)] bg-white p-1 shadow-lg">
              <DropdownMenu.Item
                className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm outline-none hover:bg-[var(--color-muted)]"
                onSelect={onEditColumn}
              >
                <Pencil className="h-3.5 w-3.5" /> Sửa cột
              </DropdownMenu.Item>
              <DropdownMenu.Item
                className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm text-[var(--color-danger)] outline-none hover:bg-red-50"
                onSelect={onDeleteColumn}
              >
                <Trash2 className="h-3.5 w-3.5" /> Xóa cột
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      </div>

      <div className="space-y-2 p-2">
        <QuickAddInput onAdd={onQuickAdd} />
        <div ref={setDropRef} className="min-h-[40px] space-y-2">
          <SortableContext
            items={column.items.map((i) => i.id)}
            strategy={verticalListSortingStrategy}
          >
            {column.items.map((item) => (
              <ItemCard
                key={item.id}
                item={item}
                onEdit={() => onEditItem(item)}
                onDelete={() => onDeleteItem(item)}
                onCopy={() => onCopyItem(item)}
              />
            ))}
          </SortableContext>
        </div>
      </div>
      <div className="px-2 pb-2 text-[11px] text-[var(--color-muted-foreground)]">
        <span className="inline-flex items-center gap-1">
          <Plus className="h-3 w-3" />
          {column.items.length} item
        </span>
      </div>
    </div>
  );
}
