import * as React from "react";
import * as ToastPrimitive from "@radix-ui/react-toast";
import { cn } from "@/lib/utils";

type ToastMessage = {
  id: string;
  title: string;
  variant?: "default" | "error";
};

const ToastContext = React.createContext<{
  toast: (title: string, variant?: "default" | "error") => void;
} | null>(null);

export function useToast() {
  const ctx = React.useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = React.useState<ToastMessage[]>([]);

  const toast = React.useCallback(
    (title: string, variant: "default" | "error" = "default") => {
      const id = crypto.randomUUID();
      setItems((prev) => [...prev, { id, title, variant }]);
    },
    [],
  );

  return (
    <ToastContext.Provider value={{ toast }}>
      <ToastPrimitive.Provider swipeDirection="right" duration={2800}>
        {children}
        {items.map((item) => (
          <ToastPrimitive.Root
            key={item.id}
            className={cn(
              "rounded-md border px-3 py-2 text-sm shadow-lg",
              item.variant === "error"
                ? "border-red-200 bg-red-50 text-red-800"
                : "border-[var(--color-border)] bg-white text-[var(--color-foreground)]",
            )}
            onOpenChange={(open) => {
              if (!open) {
                setItems((prev) => prev.filter((x) => x.id !== item.id));
              }
            }}
          >
            <ToastPrimitive.Title>{item.title}</ToastPrimitive.Title>
          </ToastPrimitive.Root>
        ))}
        <ToastPrimitive.Viewport className="fixed bottom-4 right-4 z-[100] flex w-[320px] max-w-[90vw] flex-col gap-2 outline-none" />
      </ToastPrimitive.Provider>
    </ToastContext.Provider>
  );
}
