import { useCallback, useEffect, useState } from "react";
import { Database, Home, Trash2 } from "lucide-react";
import { api } from "@/lib/api";
import type { Page } from "@/lib/types";
import { HomePage } from "@/pages/HomePage";
import { TrashPage } from "@/pages/TrashPage";
import { DataPage } from "@/pages/DataPage";
import { ToastProvider } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

const NAV: { id: Page; label: string; icon: typeof Home }[] = [
  { id: "home", label: "Home", icon: Home },
  { id: "trash", label: "Thùng rác", icon: Trash2 },
  { id: "data", label: "Dữ liệu", icon: Database },
];

function Shell() {
  const [page, setPage] = useState<Page>("home");
  const [trashCount, setTrashCount] = useState(0);
  const [homeKey, setHomeKey] = useState(0);

  const refreshTrashCount = useCallback(async () => {
    try {
      setTrashCount(await api.trashCount());
    } catch {
      setTrashCount(0);
    }
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        await api.runStartupMaintenance();
      } catch {
        // ignore maintenance errors on boot; UI will surface DB issues
      }
      await refreshTrashCount();
    })();
  }, [refreshTrashCount]);

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-[var(--color-border)] bg-white/90 backdrop-blur">
        <div className="flex w-full items-center justify-between gap-4 px-4 py-3">
          <div>
            <div className="text-sm font-semibold tracking-wide text-[var(--color-primary)]">
              Offline Task Board
            </div>
            <div className="text-xs text-[var(--color-muted-foreground)]">
              Windows · offline · SQLite
            </div>
          </div>
          <nav className="flex gap-1">
            {NAV.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setPage(item.id)}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-sm transition-colors",
                    page === item.id
                      ? "bg-[var(--color-primary)] text-white"
                      : "text-[var(--color-foreground)] hover:bg-[var(--color-muted)]",
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                  {item.id === "trash" && trashCount > 0 ? (
                    <span className="rounded bg-white/20 px-1.5 text-[11px]">
                      {trashCount}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </nav>
        </div>
      </header>

      <main className="w-full px-4 py-5">
        {page === "home" ? (
          <HomePage
            key={homeKey}
            onTrashChanged={() => void refreshTrashCount()}
          />
        ) : null}
        {page === "trash" ? (
          <TrashPage
            onChanged={() => {
              void refreshTrashCount();
              setHomeKey((k) => k + 1);
            }}
          />
        ) : null}
        {page === "data" ? (
          <DataPage
            onImported={() => {
              void refreshTrashCount();
              setHomeKey((k) => k + 1);
              setPage("home");
            }}
          />
        ) : null}
      </main>
    </div>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <Shell />
    </ToastProvider>
  );
}
