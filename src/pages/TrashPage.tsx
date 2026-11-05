import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import type { TrashItem } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { formatDateTime } from "@/lib/utils";

type Filter = "all" | "category" | "column" | "item";

type Props = {
  onChanged: () => void;
};

const TYPE_LABEL: Record<string, string> = {
  category: "Đầu mục",
  column: "Cột",
  item: "Item",
};

export function TrashPage({ onChanged }: Props) {
  const { toast } = useToast();
  const [items, setItems] = useState<TrashItem[]>([]);
  const [filter, setFilter] = useState<Filter>("all");
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      setItems(await api.listTrash());
    } catch (err) {
      toast(String(err), "error");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const visible = useMemo(
    () =>
      filter === "all" ? items : items.filter((i) => i.entityType === filter),
    [items, filter],
  );

  async function restore(item: TrashItem, withChildren: boolean) {
    try {
      const result = await api.restoreEntity(
        item.entityType,
        item.id,
        withChildren,
      );
      toast(result.message ?? "Đã khôi phục");
      onChanged();
      await reload();
    } catch (err) {
      toast(String(err), "error");
    }
  }

  async function purgeOne(item: TrashItem) {
    if (!confirm("Xóa vĩnh viễn mục này? Không hoàn tác được.")) return;
    try {
      await api.purgeEntity(item.entityType, item.id);
      toast("Đã xóa vĩnh viễn");
      onChanged();
      await reload();
    } catch (err) {
      toast(String(err), "error");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Thùng rác</h1>
          <p className="text-sm text-[var(--color-muted-foreground)]">
            Tự xóa sau 30 ngày hoặc dọn thủ công.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={async () => {
              const n = await api.purgeExpired();
              toast(`Đã dọn ${n} mục quá 30 ngày`);
              onChanged();
              await reload();
            }}
          >
            Dọn quá 30 ngày
          </Button>
          <Button
            variant="danger"
            onClick={async () => {
              if (
                !confirm(
                  "Xóa vĩnh viễn TOÀN BỘ thùng rác? Thao tác không hoàn tác.",
                )
              ) {
                return;
              }
              const n = await api.purgeAllTrash();
              toast(`Đã dọn ${n} mục`);
              onChanged();
              await reload();
            }}
          >
            Dọn tất cả
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {(
          [
            ["all", "Tất cả"],
            ["category", "Đầu mục"],
            ["column", "Cột"],
            ["item", "Item"],
          ] as const
        ).map(([key, label]) => (
          <Button
            key={key}
            size="sm"
            variant={filter === key ? "default" : "outline"}
            onClick={() => setFilter(key)}
          >
            {label}
          </Button>
        ))}
      </div>

      {loading ? (
        <p className="text-sm text-[var(--color-muted-foreground)]">Đang tải…</p>
      ) : visible.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--color-border)] bg-white/80 p-10 text-center text-[var(--color-muted-foreground)]">
          Thùng rác trống
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-[var(--color-border)] bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-[var(--color-muted)] text-[var(--color-muted-foreground)]">
              <tr>
                <th className="px-3 py-2 font-medium">Loại</th>
                <th className="px-3 py-2 font-medium">Tên</th>
                <th className="px-3 py-2 font-medium">Chi tiết</th>
                <th className="px-3 py-2 font-medium">Xóa lúc</th>
                <th className="px-3 py-2 font-medium">Còn</th>
                <th className="px-3 py-2 font-medium">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((item) => (
                <tr
                  key={`${item.entityType}-${item.id}`}
                  className="border-t border-[var(--color-border)]"
                >
                  <td className="px-3 py-2">
                    {TYPE_LABEL[item.entityType] ?? item.entityType}
                  </td>
                  <td className="px-3 py-2 font-medium">{item.name}</td>
                  <td className="px-3 py-2 text-[var(--color-muted-foreground)]">
                    {item.detail || item.parentHint || "—"}
                  </td>
                  <td className="px-3 py-2">{formatDateTime(item.deletedAt)}</td>
                  <td className="px-3 py-2">{item.daysRemaining} ngày</td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-1">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => void restore(item, false)}
                      >
                        Khôi phục
                      </Button>
                      {(item.entityType === "category" ||
                        item.entityType === "column") && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => void restore(item, true)}
                        >
                          Kèm nội dung
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="danger"
                        onClick={() => void purgeOne(item)}
                      >
                        Xóa vĩnh viễn
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
