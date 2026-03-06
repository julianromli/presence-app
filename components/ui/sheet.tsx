"use client";

import * as React from "react";
import { XIcon } from "lucide-react";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";

import { cn } from "@/lib/utils";

const Sheet = DialogPrimitive.Root;
const SheetTrigger = DialogPrimitive.Trigger;
const SheetClose = DialogPrimitive.Close;
const SheetPortal = DialogPrimitive.Portal;
const sheetPopupSides = {
  bottom: {
    popup:
      "bottom-0 left-1/2 w-full max-w-md -translate-x-1/2 rounded-t-lg border-x border-t border-b-0 data-[ending-style]:translate-y-full data-[starting-style]:translate-y-full",
    handle: true,
  },
  left: {
    popup:
      "top-0 left-0 h-full w-full max-w-md rounded-r-lg border-y border-r border-l-0 data-[ending-style]:-translate-x-full data-[starting-style]:-translate-x-full",
    handle: false,
  },
  right: {
    popup:
      "top-0 right-0 h-full w-full max-w-md rounded-l-lg border-y border-l border-r-0 data-[ending-style]:translate-x-full data-[starting-style]:translate-x-full",
    handle: false,
  },
  top: {
    popup:
      "top-0 left-1/2 w-full max-w-md -translate-x-1/2 rounded-b-lg border-x border-b border-t-0 data-[ending-style]:-translate-y-full data-[starting-style]:-translate-y-full",
    handle: true,
  },
} as const;
type SheetSide = keyof typeof sheetPopupSides;

function SheetOverlay({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Backdrop>) {
  return (
    <DialogPrimitive.Backdrop
      data-slot="sheet-overlay"
      className={cn(
        "fixed inset-0 z-50 bg-black/50 transition-opacity data-[ending-style]:opacity-0 data-[starting-style]:opacity-0",
        className,
      )}
      {...props}
    />
  );
}

function SheetPopup({
  className,
  children,
  side = "right",
  showCloseButton = true,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Popup> & {
  side?: SheetSide;
  showCloseButton?: boolean;
}) {
  const sideConfig = sheetPopupSides[side];

  return (
    <SheetPortal data-slot="sheet-portal">
      <SheetOverlay />
      <DialogPrimitive.Popup
        data-slot="sheet-popup"
        className={cn(
          "fixed z-50 flex max-h-[85vh] flex-col border-border bg-background shadow-lg outline-none transition-[transform,opacity] data-[ending-style]:opacity-0 data-[starting-style]:opacity-0",
          sideConfig.popup,
          className,
        )}
        {...props}
      >
        {sideConfig.handle ? (
          <div className="mx-auto mt-4 h-2 w-[100px] shrink-0 rounded-full bg-muted" />
        ) : null}
        {children}
        {showCloseButton ? (
          <DialogPrimitive.Close
            data-slot="sheet-close"
            className="absolute top-4 right-4 rounded-xs opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-hidden disabled:pointer-events-none [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4"
          >
            <XIcon />
            <span className="sr-only">Close</span>
          </DialogPrimitive.Close>
        ) : null}
      </DialogPrimitive.Popup>
    </SheetPortal>
  );
}

const SheetContent = SheetPopup;

function SheetHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sheet-header"
      className={cn("flex flex-col gap-1.5 p-4 text-left", className)}
      {...props}
    />
  );
}

function SheetPanel({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sheet-panel"
      className={cn("flex flex-col overflow-y-auto", className)}
      {...props}
    />
  );
}

function SheetFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sheet-footer"
      className={cn("mt-auto flex flex-col gap-2 p-4", className)}
      {...props}
    />
  );
}

function SheetTitle({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      data-slot="sheet-title"
      className={cn("font-semibold text-foreground", className)}
      {...props}
    />
  );
}

function SheetDescription({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      data-slot="sheet-description"
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  );
}

export {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetOverlay,
  SheetPanel,
  SheetPopup,
  SheetPortal,
  SheetTitle,
  SheetTrigger,
};
