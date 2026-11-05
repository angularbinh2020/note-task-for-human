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
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialName?: string;
  initialDescription?: string;
  onSubmit: (name: string, description: string) => Promise<void>;
};

export function ItemFormDialog({
  open,
  onOpenChange,
  initialName = "",
  initialDescription = "",
  onSubmit,
}: Props) {
  const [name, setName] = useState(initialName);
  const [description, setDescription] = useState(initialDescription);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      setName(initialName);
      setDescription(initialDescription);
      setError("");
    }
  }, [open, initialName, initialDescription]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError("Tên item là bắt buộc");
      return;
    }
    setLoading(true);
    try {
      await onSubmit(name.trim(), description.trim());
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
            <DialogTitle>Sửa item</DialogTitle>
            <DialogDescription>Cập nhật tên và mô tả.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="item-name">Tên</Label>
              <Input
                id="item-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="item-desc">Mô tả</Label>
              <Textarea
                id="item-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
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
