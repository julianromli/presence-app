"use client";

import { Button } from "@/components/ui/button";

type ConfirmationDialogProps = {
  cancelLabel: string;
  confirmLabel: string;
  description: string;
  isPending?: boolean;
  onConfirm: () => void | Promise<void>;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  title: string;
  tone?: "default" | "destructive";
};

export function ConfirmationDialog({
  cancelLabel,
  confirmLabel,
  description,
  isPending = false,
  onConfirm,
  onOpenChange,
  open,
  title,
  tone = "default",
}: ConfirmationDialogProps) {
  if (!open) {
    return null;
  }

  return (
    <div
      data-slot="confirmation-dialog"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirmation-dialog-title"
        aria-describedby="confirmation-dialog-description"
        className="w-full max-w-md rounded-lg border bg-background p-6 shadow-lg"
      >
        <div className="flex flex-col gap-2 text-left">
          <h2 id="confirmation-dialog-title" className="text-lg font-semibold">
            {title}
          </h2>
          <p id="confirmation-dialog-description" className="text-sm text-muted-foreground">
            {description}
          </p>
        </div>
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="outline"
            disabled={isPending}
            onClick={() => onOpenChange(false)}
          >
            {cancelLabel}
          </Button>
          <Button
            type="button"
            variant={tone === "destructive" ? "destructive" : "default"}
            isLoading={isPending}
            loadingText={confirmLabel}
            onClick={() => void onConfirm()}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
