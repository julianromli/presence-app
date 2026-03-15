import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

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

function resolveTree(node: React.ReactNode): React.ReactNode {
  if (Array.isArray(node)) {
    return node.map(resolveTree);
  }

  if (!React.isValidElement(node)) {
    return node;
  }

  if (typeof node.type === "function") {
    const component = node.type as (props: Record<string, unknown>) => React.ReactNode;
    const rendered = component(node.props as Record<string, unknown>);
    return resolveTree(rendered);
  }

  return React.cloneElement(
    node as React.ReactElement<{ children?: React.ReactNode }>,
    node.props as { children?: React.ReactNode },
    React.Children.map(
      (node.props as { children?: React.ReactNode }).children,
      (child) => resolveTree(child),
    ),
  );
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

  if (predicate(node as TraversableElement)) {
    return node as TraversableElement;
  }

  return findElement((node as TraversableElement).props.children, predicate);
}

describe("global error page", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("renders branded Indonesian recovery UI and logs the error", async () => {
    const reset = vi.fn();
    const captureException = vi.fn();
    const error = new Error("Database DSN leaked");

    vi.doMock("../app/globals.css", () => ({}));
    vi.doMock("@/lib/runtime-flags", () => ({
      shouldEnableSentry: () => true,
    }));
    vi.doMock("@sentry/nextjs", () => ({
      captureException,
    }));
    vi.doMock("next/font/google", () => ({
      DM_Sans: () => ({ variable: "font-dm-sans" }),
      Fira_Code: () => ({ variable: "font-fira-code" }),
      Manrope: () => ({ variable: "font-manrope" }),
    }));
    vi.doMock("react", async () => {
      const actual = await vi.importActual<typeof import("react")>("react");

      return {
        ...actual,
        useEffect: (callback: () => void) => {
          callback();
        },
      };
    });
    vi.doMock("next/link", async () => {
      const actual = await vi.importActual<typeof import("react")>("react");

      return {
        default: ({ children, href, ...props }: { children: React.ReactNode; href: string }) =>
          actual.createElement("a", { href, ...props }, children),
      };
    });
    vi.doMock("@/components/ui/button", async () => {
      const actual = await vi.importActual<typeof import("react")>("react");

      return {
        Button: ({
          children,
          render,
          ...props
        }: {
          children: React.ReactNode;
          render?: React.ReactElement;
          [key: string]: unknown;
        }) => {
          if (render) {
            return actual.cloneElement(render, props, children);
          }

          return actual.createElement("button", props, children);
        },
      };
    });

    const { default: GlobalError } = await import("../app/global-error");
    const element = resolveTree(GlobalError({ error, reset }));

    const text = collectText(element).join(" ");
    const htmlElement = findElement(element, (candidate) => candidate.type === "html");
    const bodyElement = findElement(element, (candidate) => candidate.type === "body");
    const retryButton = findElement(
      element,
      (candidate) => candidate.type === "button" && collectText(candidate).join(" ").includes("Coba lagi"),
    );
    const homeLink = findElement(
      element,
      (candidate) => candidate.type === "a" && candidate.props.href === "/",
    );

    expect(htmlElement).not.toBeNull();
    expect(bodyElement).not.toBeNull();
    expect(text).toContain("Absenin.id");
    expect(text).toContain("Terjadi kendala pada halaman ini");
    expect(text).toContain("Coba lagi");
    expect(text).toContain("Kembali ke Beranda");
    expect(text).not.toContain("Database DSN leaked");
    expect(homeLink?.props.href).toBe("/");

    expect(retryButton).not.toBeNull();
    (retryButton?.props.onClick as (() => void) | undefined)?.();
    expect(reset).toHaveBeenCalledTimes(1);

    await vi.dynamicImportSettled();
    expect(captureException).toHaveBeenCalledWith(error);
  });
});
