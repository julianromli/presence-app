"use client";

import * as React from "react";
import { XIcon } from "lucide-react";
import { DrawerPreview as DrawerPrimitive } from "@base-ui/react/drawer";

import { cn } from "@/lib/utils";

const Sheet = DrawerPrimitive.Root;
const SheetTrigger = DrawerPrimitive.Trigger;
const SheetClose = DrawerPrimitive.Close;
const SheetPortal = DrawerPrimitive.Portal;

function SheetOverlay({
  className,
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.Backdrop>) {
  return (
    <DrawerPrimitive.Backdrop
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
  showCloseButton = false,
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.Popup> & {
  showCloseButton?: boolean;
}) {
  return (
    <SheetPortal data-slot="sheet-portal">
      <SheetOverlay />
      <DrawerPrimitive.Viewport className="fixed inset-0 z-50 flex items-end justify-center pointer-events-none">
        <DrawerPrimitive.Popup
          data-slot="sheet-popup"
          className={cn(
            "pointer-events-auto group/sheet-popup relative flex h-auto max-h-[85vh] w-full max-w-md flex-col rounded-t-lg border border-border bg-background shadow-lg transition-[transform,opacity] data-[ending-style]:translate-y-full data-[ending-style]:opacity-0 data-[starting-style]:translate-y-full data-[starting-style]:opacity-0",
            className,
          )}
          {...props}
        >
          <div className="mx-auto mt-4 h-2 w-[100px] shrink-0 rounded-full bg-muted" />
          {children}
          {showCloseButton ? (
            <DrawerPrimitive.Close
              data-slot="sheet-close"
              className="absolute top-4 right-4 rounded-xs opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-hidden disabled:pointer-events-none [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4"
            >
              <XIcon />
              <span className="sr-only">Close</span>
            </DrawerPrimitive.Close>
          ) : null}
        </DrawerPrimitive.Popup>
      </DrawerPrimitive.Viewport>
    </SheetPortal>
  );
}

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
}: React.ComponentProps<typeof DrawerPrimitive.Title>) {
  return (
    <DrawerPrimitive.Title
      data-slot="sheet-title"
      className={cn("font-semibold text-foreground", className)}
      {...props}
    />
  );
}

function SheetDescription({
  className,
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.Description>) {
  return (
    <DrawerPrimitive.Description
      data-slot="sheet-description"
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  );
}

export {
  Sheet,
  SheetClose,
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
