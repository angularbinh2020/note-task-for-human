import { useEffect, useState } from "react";
import { save, open } from "@tauri-apps/plugin-dialog";
import { writeTextFile, readTextFile } from "@tauri-apps/plugin-fs";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";

type Props = {
  onImported: () => void;
};

export function DataPage({ onImported }: Props) {
  const { toast } = useToast();
  const [includeTrash, setIncludeTrash] = useState(true);
  const [dbPath, setDbPath] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void api.getDbPath().then(setDbPath).catch(() => setDbPath("(không lấy được)"));
  }, []);

  async function handleExport() {
    setBusy(true);
    try {
      const json = await api.exportJson(includeTrash);
      const path = await save({
        defaultPath: `task-board-backup-${new Date().toISOString().slice(0, 10)}.json`,
        filters: [{ name: "JSON", extensions: ["json"] }],
      });
      if (!path) return;
      await writeTextFile(path, json);
      toast("Đã export JSON");
    } catch (err) {
      toast(String(err), "error");
    } finally {
      setBusy(false);
    }
  }

  async function handleImport() {
    setBusy(true);
    try {
      const path = await open({
        multiple: false,
        filters: [{ name: "JSON", extensions: ["json"] }],
      });
      if (!path || Array.isArray(path)) return;

      if (
        !confirm(
          "Thay thế toàn bộ dữ liệu hiện tại? Thao tác không hoàn tác trừ khi bạn còn file backup.",
        )
      ) {
        return;
      }

      const json = await readTextFile(path);
      await api.importJson(json);
      toast("Đã import thành công");
      onImported();
    } catch (err) {
      toast(String(err), "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Dữ liệu</h1>
        <p className="text-sm text-[var(--color-muted-foreground)]">
          Sao lưu và phục hồi toàn bộ database dạng JSON (offline).
        </p>
      </div>

      <section className="space-y-3 rounded-xl border border-[var(--color-border)] bg-white p-5">
        <h2 className="font-semibold">Export</h2>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={includeTrash}
            onChange={(e) => setIncludeTrash(e.target.checked)}
          />
          Bao gồm thùng rác
        </label>
        <Button disabled={busy} onClick={() => void handleExport()}>
          Export JSON…
        </Button>
      </section>

      <section className="space-y-3 rounded-xl border border-[var(--color-border)] bg-white p-5">
        <h2 className="font-semibold">Import</h2>
        <p className="text-sm text-[var(--color-muted-foreground)]">
          Import sẽ xóa dữ liệu hiện tại rồi ghi đè từ file. Nên export backup trước.
        </p>
        <Button
          variant="outline"
          disabled={busy}
          onClick={() => void handleImport()}
        >
          Import JSON…
        </Button>
      </section>

      <section className="space-y-2 rounded-xl border border-[var(--color-border)] bg-white p-5">
        <h2 className="font-semibold">Vị trí database</h2>
        <code className="block break-all rounded bg-[var(--color-muted)] px-3 py-2 text-xs">
          {dbPath || "…"}
        </code>
      </section>
    </div>
  );
}
