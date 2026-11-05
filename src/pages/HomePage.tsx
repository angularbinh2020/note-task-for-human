import { useCallback, useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { api } from "@/lib/api";
import type { Category, Column, Item } from "@/lib/types";
import { CategoryList } from "@/components/CategoryList";
import { CategoryFormDialog } from "@/components/dialogs/CategoryFormDialog";
import { ColumnFormDialog } from "@/components/dialogs/ColumnFormDialog";
import { ItemFormDialog } from "@/components/dialogs/ItemFormDialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";

type Props = {
  onTrashChanged: () => void;
};

export function HomePage({ onTrashChanged }: Props) {
  const { toast } = useToast();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [catDialog, setCatDialog] = useState<{
    open: boolean;
    mode: "create" | "edit";
    category?: Category;
  }>({ open: false, mode: "create" });

  const [colDialog, setColDialog] = useState<{
    open: boolean;
    mode: "create" | "edit";
    column?: Column;
  }>({ open: false, mode: "create" });

  const [itemDialog, setItemDialog] = useState<{
    open: boolean;
    item?: Item;
  }>({ open: false });

  const reload = useCallback(async () => {
    try {
      setError(null);
      const data = await api.listCategories();
      setCategories(data);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  function patchCategory(next: Category) {
    setCategories((prev) => prev.map((c) => (c.id === next.id ? next : c)));
  }

  /** Áp dụng thứ tự cột global lên mọi đầu mục (giữ items theo cột). */
  function applyColumnOrder(ids: string[]) {
    setCategories((prev) =>
      prev.map((cat) => {
        const byId = new Map(cat.columns.map((c) => [c.id, c]));
        const nextCols = ids
          .map((id) => byId.get(id))
          .filter((c): c is Column => Boolean(c));
        return { ...cat, columns: nextCols };
      }),
    );
  }

  if (loading) {
    return <p className="text-sm text-[var(--color-muted-foreground)]">Đang tải…</p>;
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
        <p className="mb-2 font-medium">Không mở được dữ liệu</p>
        <p className="mb-3">{error}</p>
        <p className="mb-3 text-[var(--color-muted-foreground)]">
          Nếu database bị hỏng, hãy khôi phục từ file JSON backup ở mục Dữ liệu.
        </p>
        <Button onClick={() => void reload()}>Thử lại</Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Đầu mục nhiệm vụ</h1>
          <p className="text-sm text-[var(--color-muted-foreground)]">
            Cột là global — dùng chung mọi đầu mục. Kéo để sắp xếp đầu mục / cột / item.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={() => setColDialog({ open: true, mode: "create" })}
          >
            <Plus className="h-4 w-4" /> Thêm cột
          </Button>
          <Button onClick={() => setCatDialog({ open: true, mode: "create" })}>
            <Plus className="h-4 w-4" /> Tạo đầu mục
          </Button>
        </div>
      </div>

      {categories.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--color-border)] bg-white/80 p-10 text-center">
          <p className="mb-4 text-[var(--color-muted-foreground)]">
            Chưa có đầu mục nào.
          </p>
          <Button onClick={() => setCatDialog({ open: true, mode: "create" })}>
            Tạo đầu mục đầu tiên
          </Button>
        </div>
      ) : (
        <CategoryList
          categories={categories}
          onCategoriesChange={setCategories}
          onReorderCategories={async (ids) => {
            await api.reorderCategories(ids);
          }}
          onToggle={async (category) => {
            const collapsed = !category.collapsed;
            patchCategory({ ...category, collapsed });
            try {
              await api.updateCategory({ id: category.id, collapsed });
            } catch (err) {
              toast(String(err), "error");
              await reload();
            }
          }}
          onEdit={(category) =>
            setCatDialog({ open: true, mode: "edit", category })
          }
          onDelete={async (category) => {
            if (
              !confirm(
                "Chuyển đầu mục và toàn bộ item của nó vào thùng rác? (Cột global vẫn giữ)",
              )
            ) {
              return;
            }
            try {
              await api.softDeleteCategory(category.id);
              toast("Đã chuyển đầu mục vào thùng rác");
              onTrashChanged();
              await reload();
            } catch (err) {
              toast(String(err), "error");
            }
          }}
          onChangeCategory={patchCategory}
          onQuickAdd={async (categoryId, columnId, name) => {
            try {
              const item = await api.createItem(categoryId, columnId, name);
              setCategories((prev) =>
                prev.map((cat) =>
                  cat.id === categoryId
                    ? {
                        ...cat,
                        columns: cat.columns.map((col) =>
                          col.id === columnId
                            ? { ...col, items: [...col.items, item] }
                            : col,
                        ),
                      }
                    : cat,
                ),
              );
            } catch (err) {
              toast(String(err), "error");
            }
          }}
          onEditItem={(item) => setItemDialog({ open: true, item })}
          onDeleteItem={async (item) => {
            try {
              await api.softDeleteItem(item.id);
              setCategories((prev) =>
                prev.map((cat) => ({
                  ...cat,
                  columns: cat.columns.map((col) => ({
                    ...col,
                    items: col.items.filter((i) => i.id !== item.id),
                  })),
                })),
              );
              onTrashChanged();
            } catch (err) {
              toast(String(err), "error");
            }
          }}
          onCopyItem={async (item) => {
            try {
              await navigator.clipboard.writeText(item.name);
              toast("Đã copy");
            } catch {
              toast("Không copy được clipboard", "error");
            }
          }}
          onEditColumn={(column) =>
            setColDialog({ open: true, mode: "edit", column })
          }
          onDeleteColumn={async (column) => {
            if (
              !confirm(
                "Xóa cột GLOBAL này? Cột sẽ biến mất khỏi mọi đầu mục và mọi item trong cột vào thùng rác.",
              )
            ) {
              return;
            }
            try {
              await api.softDeleteColumn(column.id);
              toast("Đã chuyển cột global vào thùng rác");
              onTrashChanged();
              await reload();
            } catch (err) {
              toast(String(err), "error");
            }
          }}
          onAddColumn={() => setColDialog({ open: true, mode: "create" })}
          onApplyColumnOrder={applyColumnOrder}
          onReorderColumns={async (ids) => {
            await api.reorderColumns(ids);
          }}
          onMoveItem={async (itemId, targetColumnId, targetIndex) => {
            try {
              await api.moveItem(itemId, targetColumnId, targetIndex);
            } catch (err) {
              toast(String(err), "error");
              await reload();
            }
          }}
        />
      )}

      <CategoryFormDialog
        open={catDialog.open}
        onOpenChange={(open) => setCatDialog((s) => ({ ...s, open }))}
        title={catDialog.mode === "create" ? "Tạo đầu mục" : "Sửa đầu mục"}
        initialName={catDialog.category?.name}
        initialDescription={catDialog.category?.description}
        onSubmit={async (name, description) => {
          if (catDialog.mode === "create") {
            const created = await api.createCategory(name, description);
            setCategories((prev) => [...prev, { ...created, collapsed: false }]);
            toast("Đã tạo đầu mục");
          } else if (catDialog.category) {
            const updated = await api.updateCategory({
              id: catDialog.category.id,
              name,
              description,
            });
            patchCategory(updated);
            toast("Đã cập nhật đầu mục");
          }
        }}
      />

      <ColumnFormDialog
        open={colDialog.open}
        onOpenChange={(open) => setColDialog((s) => ({ ...s, open }))}
        title={
          colDialog.mode === "create" ? "Thêm cột global" : "Sửa cột global"
        }
        initialName={colDialog.column?.name}
        initialCode={colDialog.column?.code}
        onSubmit={async (name, code) => {
          if (colDialog.mode === "create") {
            await api.createColumn(name, code);
            toast("Đã thêm cột (áp dụng mọi đầu mục)");
            await reload();
          } else if (colDialog.column) {
            const updated = await api.updateColumn({
              id: colDialog.column.id,
              name,
              code,
            });
            setCategories((prev) =>
              prev.map((cat) => ({
                ...cat,
                columns: cat.columns.map((c) =>
                  c.id === updated.id ? { ...updated, items: c.items } : c,
                ),
              })),
            );
            toast("Đã cập nhật cột global");
          }
        }}
      />

      <ItemFormDialog
        open={itemDialog.open}
        onOpenChange={(open) => setItemDialog((s) => ({ ...s, open }))}
        initialName={itemDialog.item?.name}
        initialDescription={itemDialog.item?.description}
        onSubmit={async (name, description) => {
          if (!itemDialog.item) return;
          const updated = await api.updateItem({
            id: itemDialog.item.id,
            name,
            description,
          });
          setCategories((prev) =>
            prev.map((cat) => ({
              ...cat,
              columns: cat.columns.map((col) => ({
                ...col,
                items: col.items.map((i) =>
                  i.id === updated.id ? updated : i,
                ),
              })),
            })),
          );
        }}
      />
    </div>
  );
}
