"use client";

import { Menu as MenuPrimitive } from "@base-ui/react/menu";
import { Check, ChevronRight, Circle } from "lucide-react";
import * as React from "react";

import { cn } from "@/lib/utils";

const Menu = MenuPrimitive.Root;
const MenuTrigger = MenuPrimitive.Trigger;
const MenuGroup = MenuPrimitive.Group;
const MenuGroupLabel = MenuPrimitive.GroupLabel;
const MenuSeparator = MenuPrimitive.Separator;
const MenuRadioGroup = MenuPrimitive.RadioGroup;
const MenuSub = MenuPrimitive.SubmenuRoot;

type MenuPopupProps = React.ComponentPropsWithoutRef<typeof MenuPrimitive.Popup> & {
  side?: React.ComponentPropsWithoutRef<typeof MenuPrimitive.Positioner>["side"];
  align?: React.ComponentPropsWithoutRef<typeof MenuPrimitive.Positioner>["align"];
  sideOffset?: React.ComponentPropsWithoutRef<typeof MenuPrimitive.Positioner>["sideOffset"];
  alignOffset?: React.ComponentPropsWithoutRef<typeof MenuPrimitive.Positioner>["alignOffset"];
};

function MenuPopup({
  className,
  children,
  side = "bottom",
  align = "center",
  sideOffset = 4,
  alignOffset = 0,
  ...props
}: MenuPopupProps) {
  return (
    <MenuPrimitive.Portal>
      <MenuPrimitive.Positioner
        align={align}
        alignOffset={alignOffset}
        className="z-50 outline-none"
        side={side}
        sideOffset={sideOffset}
      >
        <MenuPrimitive.Popup
          className={cn(
            "origin-(--transform-origin) overflow-hidden rounded-lg border border-border bg-popover p-1 text-popover-foreground shadow-lg/5 transition-[scale,opacity] data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0",
            className,
          )}
          {...props}
        >
          {children}
        </MenuPrimitive.Popup>
      </MenuPrimitive.Positioner>
    </MenuPrimitive.Portal>
  );
}

type MenuItemProps = React.ComponentPropsWithoutRef<typeof MenuPrimitive.Item> & {
  inset?: boolean;
  variant?: "default" | "destructive";
};

const MenuItem = React.forwardRef<HTMLDivElement, MenuItemProps>(
  ({ className, inset, variant = "default", ...props }, ref) => (
    <MenuPrimitive.Item
      className={cn(
        "relative flex cursor-default items-center gap-2 rounded-md px-2 py-1.5 text-sm outline-none select-none data-disabled:pointer-events-none data-disabled:opacity-50 data-highlighted:bg-accent data-highlighted:text-accent-foreground",
        inset && "pl-8",
        variant === "destructive" &&
          "text-destructive data-highlighted:bg-destructive/10 data-highlighted:text-destructive",
        className,
      )}
      ref={ref}
      {...props}
    />
  ),
);
MenuItem.displayName = "MenuItem";

type MenuCheckboxItemProps = React.ComponentPropsWithoutRef<
  typeof MenuPrimitive.CheckboxItem
> & {
  variant?: "default" | "switch";
};

const MenuCheckboxItem = React.forwardRef<HTMLDivElement, MenuCheckboxItemProps>(
  ({ className, children, variant = "default", ...props }, ref) => (
    <MenuPrimitive.CheckboxItem
      className={cn(
        "relative flex cursor-default items-center gap-2 rounded-md px-2 py-1.5 text-sm outline-none select-none data-disabled:pointer-events-none data-disabled:opacity-50 data-highlighted:bg-accent data-highlighted:text-accent-foreground",
        variant === "switch" && "justify-between",
        className,
      )}
      ref={ref}
      {...props}
    >
      {variant === "default" ? (
        <span className="flex size-4 items-center justify-center">
          <MenuPrimitive.CheckboxItemIndicator>
            <Check className="size-4" />
          </MenuPrimitive.CheckboxItemIndicator>
        </span>
      ) : null}
      <span className={cn(variant === "switch" && "mr-2")}>{children}</span>
      {variant === "switch" ? (
        <span className="relative inline-flex h-5 w-9 items-center rounded-full bg-muted transition-colors data-checked:bg-primary">
          <span className="pointer-events-none inline-block size-4 translate-x-0.5 rounded-full bg-background transition-transform data-checked:translate-x-4" />
        </span>
      ) : null}
    </MenuPrimitive.CheckboxItem>
  ),
);
MenuCheckboxItem.displayName = "MenuCheckboxItem";

const MenuRadioItem = React.forwardRef<
  HTMLDivElement,
  React.ComponentPropsWithoutRef<typeof MenuPrimitive.RadioItem>
>(({ className, children, ...props }, ref) => (
  <MenuPrimitive.RadioItem
    className={cn(
      "relative flex cursor-default items-center gap-2 rounded-md px-2 py-1.5 text-sm outline-none select-none data-disabled:pointer-events-none data-disabled:opacity-50 data-highlighted:bg-accent data-highlighted:text-accent-foreground",
      className,
    )}
    ref={ref}
    {...props}
  >
    <span className="flex size-4 items-center justify-center">
      <MenuPrimitive.RadioItemIndicator>
        <Circle className="size-2.5 fill-current" />
      </MenuPrimitive.RadioItemIndicator>
    </span>
    {children}
  </MenuPrimitive.RadioItem>
));
MenuRadioItem.displayName = "MenuRadioItem";

function MenuSubTrigger({
  className,
  inset,
  children,
  ...props
}: React.ComponentPropsWithoutRef<typeof MenuPrimitive.SubmenuTrigger> & {
  inset?: boolean;
}) {
  return (
    <MenuPrimitive.SubmenuTrigger
      className={cn(
        "flex cursor-default items-center rounded-md px-2 py-1.5 text-sm outline-none select-none data-highlighted:bg-accent data-highlighted:text-accent-foreground",
        inset && "pl-8",
        className,
      )}
      {...props}
    >
      {children}
      <ChevronRight className="ml-auto size-4" />
    </MenuPrimitive.SubmenuTrigger>
  );
}

function MenuSubPopup({
  className,
  children,
  align = "start",
  sideOffset = 0,
  alignOffset = -5,
  ...props
}: MenuPopupProps) {
  return (
    <MenuPrimitive.Positioner
      align={align}
      alignOffset={alignOffset}
      className="z-50 outline-none"
      sideOffset={sideOffset}
    >
      <MenuPrimitive.Popup
        className={cn(
          "origin-(--transform-origin) overflow-hidden rounded-lg border border-border bg-popover p-1 text-popover-foreground shadow-lg/5 transition-[scale,opacity] data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0",
          className,
        )}
        {...props}
      >
        {children}
      </MenuPrimitive.Popup>
    </MenuPrimitive.Positioner>
  );
}

function MenuShortcut({
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn("ml-auto text-xs tracking-widest text-muted-foreground", className)}
      {...props}
    />
  );
}

export {
  Menu,
  MenuCheckboxItem,
  MenuGroup,
  MenuGroupLabel,
  MenuItem,
  MenuPopup,
  MenuRadioGroup,
  MenuRadioItem,
  MenuSeparator,
  MenuShortcut,
  MenuSub,
  MenuSubPopup,
  MenuSubTrigger,
  MenuTrigger,
};
