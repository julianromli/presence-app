import React from "react";
import { AlertDialog as AlertDialogPrimitive } from "@base-ui/react/alert-dialog";
import { describe, expect, it } from "vitest";

import { ConfirmationDialog } from "../components/ui/confirmation-dialog";

function collectText(node: React.ReactNode): string[] {
  if (typeof node === "string" || typeof node === "number") {
    return [String(node)];
  }

  if (Array.isArray(node)) {
    return node.flatMap(collectText);
  }

  if (!React.isValidElement(node)) {
    return [];
  }

  return collectText((node as React.ReactElement<{ children?: React.ReactNode }>).props.children);
}

function findElement(
  node: React.ReactNode,
  predicate: (element: React.ReactElement<Record<string, unknown>>) => boolean,
): React.ReactElement<Record<string, unknown>> | null {
  if (!React.isValidElement(node)) {
    if (Array.isArray(node)) {
      for (const child of node) {
        const match = findElement(child, predicate);
        if (match) {
          return match;
        }
      }
    }
    return null;
  }

  if (predicate(node)) {
    return node as React.ReactElement<Record<string, unknown>>;
  }

  return findElement((node as React.ReactElement<{ children?: React.ReactNode }>).props.children, predicate);
}

describe("confirmation dialog", () => {
  it("uses the Base UI alert dialog primitive so focus moves inside the modal", () => {
    const element = ConfirmationDialog({
      open: true,
      title: "Hapus workspace ini?",
      description: 'Workspace "Presence Ops" akan dinonaktifkan dan akses Anda akan ditutup.',
      confirmLabel: "Hapus Workspace",
      cancelLabel: "Batal",
      onConfirm: () => undefined,
      onOpenChange: () => undefined,
    });

    const popup = findElement(
      element,
      (candidate) => candidate.type === AlertDialogPrimitive.Popup,
    );

    expect(React.isValidElement(element)).toBe(true);
    expect((element as React.ReactElement).type).toBe(AlertDialogPrimitive.Root);
    expect(popup).not.toBeNull();
    expect(popup?.props.initialFocus).toBe(true);
  });

  it("wires destructive confirmation copy and loading state", () => {
    const element = ConfirmationDialog({
      open: true,
      title: "Hapus workspace ini?",
      description: 'Workspace "Presence Ops" akan dinonaktifkan dan akses Anda akan ditutup.',
      confirmLabel: "Hapus Workspace",
      cancelLabel: "Batal",
      tone: "destructive",
      isPending: true,
      onConfirm: () => undefined,
      onOpenChange: () => undefined,
    });

    const text = collectText(element).join(" ");
    const confirmButton = findElement(
      element,
      (candidate) => candidate.props.isLoading === true,
    );

    expect(text).toContain("Hapus workspace ini?");
    expect(text).toContain("Presence Ops");
    expect(text).toContain("Batal");
    expect(text).toContain("Hapus Workspace");
    expect(confirmButton).not.toBeNull();
    expect(confirmButton?.props.loadingText).toBe("Hapus Workspace");
    expect(confirmButton?.props.isLoading).toBe(true);
  });
});
