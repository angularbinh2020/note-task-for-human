import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Copy, GripVertical, Pencil, Trash2 } from "lucide-react";
import type { Item } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Props = {
  item: Item;
  onEdit: () => void;
  onDelete: () => void;
  onCopy: () => void;
};

export function ItemCard({ item, onEdit, onDelete, onCopy }: Props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({
      id: item.id,
      data: { type: "item", item },
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
        "group rounded-md border border-[var(--color-border)] bg-white p-2.5 shadow-sm",
        isDragging && "opacity-70 ring-2 ring-[var(--color-accent)]",
      )}
    >
      <div className="flex items-start gap-1.5">
        <button
          type="button"
          className="mt-0.5 cursor-grab text-[var(--color-muted-foreground)] active:cursor-grabbing"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-4 w-4" />
        </button>
        <div className="min-w-0 flex-1">
          <div className="line-clamp-2 text-sm font-medium">{item.name}</div>
          {item.description ? (
            <div className="mt-0.5 line-clamp-2 text-xs text-[var(--color-muted-foreground)]">
              {item.description}
            </div>
          ) : null}
        </div>
        <div className="flex shrink-0 gap-0.5">
          <Button type="button" size="icon" variant="ghost" onClick={onCopy} title="Copy">
            <Copy className="h-3.5 w-3.5" />
          </Button>
          <Button type="button" size="icon" variant="ghost" onClick={onEdit} title="Sửa">
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button type="button" size="icon" variant="ghost" onClick={onDelete} title="Xóa">
            <Trash2 className="h-3.5 w-3.5 text-[var(--color-danger)]" />
          </Button>
        </div>
      </div>
    </div>
  );
}
