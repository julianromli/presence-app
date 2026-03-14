"use client";

import { AlertDialog } from "@base-ui/react/alert-dialog";

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
    <AlertDialog.Root open={open} onOpenChange={onOpenChange}>
      <AlertDialog.Portal>
        <AlertDialog.Backdrop
          data-slot="confirmation-dialog"
          className="fixed inset-0 z-50 bg-black/50 transition-opacity data-[ending-style]:opacity-0 data-[starting-style]:opacity-0"
        />
        <AlertDialog.Popup
          initialFocus={true}
          className="fixed top-1/2 left-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg border bg-background p-6 shadow-lg outline-none transition-[transform,opacity] data-[ending-style]:scale-95 data-[ending-style]:opacity-0 data-[starting-style]:scale-95 data-[starting-style]:opacity-0"
        >
          <div className="flex flex-col gap-2 text-left">
            <AlertDialog.Title className="text-lg font-semibold">
              {title}
            </AlertDialog.Title>
            <AlertDialog.Description className="text-sm text-muted-foreground">
              {description}
            </AlertDialog.Description>
          </div>
          <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <AlertDialog.Close
              disabled={isPending}
              render={<Button type="button" variant="outline" />}
            >
              {cancelLabel}
            </AlertDialog.Close>
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
        </AlertDialog.Popup>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
