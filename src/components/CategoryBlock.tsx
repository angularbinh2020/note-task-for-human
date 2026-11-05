import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  ChevronDown,
  ChevronRight,
  GripVertical,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import type { Category, Column, Item } from "@/lib/types";
import { ColumnBoard } from "@/components/ColumnBoard";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Props = {
  category: Category;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
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

export function CategoryBlock({
  category,
  onToggle,
  onEdit,
  onDelete,
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
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: category.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <section
      ref={setNodeRef}
      style={style}
      className={cn(
        "rounded-xl border border-[var(--color-border)] bg-white/90 shadow-sm",
        isDragging && "opacity-70",
      )}
    >
      <header className="flex items-center gap-2 px-3 py-3">
        <button
          type="button"
          className="cursor-grab text-[var(--color-muted-foreground)] active:cursor-grabbing"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-4 w-4" />
        </button>
        <button
          type="button"
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
          onClick={onToggle}
        >
          {category.collapsed ? (
            <ChevronRight className="h-4 w-4 shrink-0" />
          ) : (
            <ChevronDown className="h-4 w-4 shrink-0" />
          )}
          <div className="min-w-0">
            <div className="truncate font-semibold">{category.name}</div>
            {category.description ? (
              <div className="truncate text-xs text-[var(--color-muted-foreground)]">
                {category.description}
              </div>
            ) : null}
          </div>
        </button>
        <Button size="icon" variant="ghost" onClick={onAddColumn} title="Thêm cột">
          <Plus className="h-4 w-4" />
        </Button>
        <Button size="icon" variant="ghost" onClick={onEdit} title="Sửa">
          <Pencil className="h-4 w-4" />
        </Button>
        <Button size="icon" variant="ghost" onClick={onDelete} title="Xóa">
          <Trash2 className="h-4 w-4 text-[var(--color-danger)]" />
        </Button>
      </header>

      {!category.collapsed ? (
        <div className="border-t border-[var(--color-border)] px-3 py-3">
          <ColumnBoard
            category={category}
            onChangeCategory={onChangeCategory}
            onQuickAdd={onQuickAdd}
            onEditItem={onEditItem}
            onDeleteItem={onDeleteItem}
            onCopyItem={onCopyItem}
            onEditColumn={onEditColumn}
            onDeleteColumn={onDeleteColumn}
            onAddColumn={onAddColumn}
            onReorderColumns={onReorderColumns}
            onMoveItem={onMoveItem}
          />
        </div>
      ) : null}
    </section>
  );
}
