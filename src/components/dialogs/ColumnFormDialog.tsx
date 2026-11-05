import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const CODE_RE = /^[a-zA-Z0-9_-]+$/;

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  initialName?: string;
  initialCode?: string;
  onSubmit: (name: string, code: string) => Promise<void>;
};

export function ColumnFormDialog({
  open,
  onOpenChange,
  title,
  initialName = "",
  initialCode = "",
  onSubmit,
}: Props) {
  const [name, setName] = useState(initialName);
  const [code, setCode] = useState(initialCode);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      setName(initialName);
      setCode(initialCode);
      setError("");
    }
  }, [open, initialName, initialCode]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError("Tên cột là bắt buộc");
      return;
    }
    if (!code.trim()) {
      setError("Code là bắt buộc");
      return;
    }
    if (!CODE_RE.test(code.trim())) {
      setError("Code chỉ gồm a-z, A-Z, 0-9, _ và -");
      return;
    }
    setLoading(true);
    try {
      await onSubmit(name.trim(), code.trim());
      onOpenChange(false);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>
              Cột là global (dùng chung mọi đầu mục). Code phải unique trong toàn bộ database.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="col-name">Tên</Label>
              <Input
                id="col-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="col-code">Code</Label>
              <Input
                id="col-code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
              />
            </div>
            {error && <p className="text-sm text-[var(--color-danger)]">{error}</p>}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Hủy
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Đang lưu…" : "Lưu"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
