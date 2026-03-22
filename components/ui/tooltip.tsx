"use client";

import { Tooltip as TooltipPrimitive } from "@base-ui/react/tooltip";
import * as React from "react";

import { cn } from "@/lib/utils";

const TooltipProvider = TooltipPrimitive.Provider;
const Tooltip = TooltipPrimitive.Root;
const TooltipTrigger = TooltipPrimitive.Trigger;

type TooltipContentProps = React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Popup> & {
  side?: React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Positioner>["side"];
  align?: React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Positioner>["align"];
  sideOffset?: React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Positioner>["sideOffset"];
  alignOffset?: React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Positioner>["alignOffset"];
};

function TooltipContent({
  align = "center",
  alignOffset = 0,
  children,
  className,
  side = "top",
  sideOffset = 8,
  ...props
}: TooltipContentProps) {
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Positioner
        align={align}
        alignOffset={alignOffset}
        className="z-50 outline-none"
        side={side}
        sideOffset={sideOffset}
      >
        <TooltipPrimitive.Popup
          className={cn(
            "overflow-visible rounded-md border border-zinc-200 bg-zinc-950 px-2.5 py-1.5 text-xs font-medium text-white shadow-lg transition-[opacity,transform] data-ending-style:opacity-0 data-ending-style:scale-95 data-starting-style:opacity-0 data-starting-style:scale-95",
            className,
          )}
          {...props}
        >
          {children}
          <TooltipPrimitive.Arrow className="data-[side=bottom]:-top-1 data-[side=left]:-right-1 data-[side=right]:-left-1 data-[side=top]:-bottom-1 absolute size-2 rotate-45 rounded-[2px] border border-zinc-200 bg-zinc-950" />
        </TooltipPrimitive.Popup>
      </TooltipPrimitive.Positioner>
    </TooltipPrimitive.Portal>
  );
}

export { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger };
