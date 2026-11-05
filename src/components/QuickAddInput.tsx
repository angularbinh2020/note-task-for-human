import { useState } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type Props = {
  onAdd: (name: string) => Promise<void>;
};

export function QuickAddInput({ onAdd }: Props) {
  const [value, setValue] = useState("");
  const [shake, setShake] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!value.trim()) {
      setShake(true);
      setTimeout(() => setShake(false), 350);
      return;
    }
    setBusy(true);
    try {
      await onAdd(value.trim());
      setValue("");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Input
      value={value}
      disabled={busy}
      placeholder="Thêm item…"
      className={cn(shake && "animate-[shake_0.3s_ease-in-out]")}
      onChange={(e) => setValue(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          // Lỗi hiển thị bởi caller (toast); tránh unhandled rejection
          void submit().catch(() => {});
        }
      }}
    />
  );
}
