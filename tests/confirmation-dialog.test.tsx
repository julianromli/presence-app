import React from "react";
import { describe, expect, it } from "vitest";

import { ConfirmationDialog } from "../components/ui/confirmation-dialog";

type TraversableElement = React.ReactElement<
  { [key: string]: unknown; children?: React.ReactNode },
  string | React.JSXElementConstructor<unknown>
>;

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

  return collectText((node as TraversableElement).props.children);
}

function findElement(
  node: React.ReactNode,
  predicate: (element: TraversableElement) => boolean,
): TraversableElement | null {
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
    return node as TraversableElement;
  }

  return findElement((node as TraversableElement).props.children, predicate);
}

describe("confirmation dialog", () => {
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
