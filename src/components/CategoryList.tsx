import {
  DndContext,
  DragEndEvent,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import type { Category, Column, Item } from "@/lib/types";
import { CategoryBlock } from "@/components/CategoryBlock";

type Props = {
  categories: Category[];
  onCategoriesChange: (categories: Category[]) => void;
  onReorderCategories: (ids: string[]) => Promise<void>;
  onToggle: (category: Category) => void;
  onEdit: (category: Category) => void;
  onDelete: (category: Category) => void;
  onChangeCategory: (category: Category) => void;
  onQuickAdd: (categoryId: string, columnId: string, name: string) => Promise<void>;
  onEditItem: (item: Item) => void;
  onDeleteItem: (item: Item) => void;
  onCopyItem: (item: Item) => void;
  onEditColumn: (column: Column) => void;
  onDeleteColumn: (column: Column) => void;
  onAddColumn: () => void;
  onReorderColumns: (ids: string[]) => Promise<void>;
  onApplyColumnOrder: (ids: string[]) => void;
  onMoveItem: (
    itemId: string,
    targetColumnId: string,
    targetIndex: number,
  ) => Promise<void>;
};

export function CategoryList({
  categories,
  onCategoriesChange,
  onReorderCategories,
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
  onApplyColumnOrder,
  onMoveItem,
}: Props) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = categories.findIndex((c) => c.id === active.id);
    const newIndex = categories.findIndex((c) => c.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    const next = arrayMove(categories, oldIndex, newIndex);
    onCategoriesChange(next);
    await onReorderCategories(next.map((c) => c.id));
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={(e) => void handleDragEnd(e)}
    >
      <SortableContext
        items={categories.map((c) => c.id)}
        strategy={verticalListSortingStrategy}
      >
        <div className="space-y-4">
          {categories.map((category) => (
            <CategoryBlock
              key={category.id}
              category={category}
              onToggle={() => onToggle(category)}
              onEdit={() => onEdit(category)}
              onDelete={() => onDelete(category)}
              onChangeCategory={onChangeCategory}
              onQuickAdd={(columnId, name) =>
                onQuickAdd(category.id, columnId, name)
              }
              onEditItem={onEditItem}
              onDeleteItem={onDeleteItem}
              onCopyItem={onCopyItem}
              onEditColumn={onEditColumn}
              onDeleteColumn={onDeleteColumn}
              onAddColumn={onAddColumn}
              onReorderColumns={async (ids) => {
                onApplyColumnOrder(ids);
                await onReorderColumns(ids);
              }}
              onMoveItem={onMoveItem}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}
