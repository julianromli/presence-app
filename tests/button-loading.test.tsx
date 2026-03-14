import React from "react";
import { ArrowsClockwise } from "@phosphor-icons/react/dist/ssr";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

describe("button loading", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.doMock("@/lib/utils", () => ({
      cn: (...values: Array<string | false | null | undefined>) => values.filter(Boolean).join(" "),
    }));
  });

  it("renders a spinner and keeps the existing label when loading", async () => {
    const { Button } = await import("../components/ui/button");
    const html = renderToStaticMarkup(<Button isLoading>Save changes</Button>);

    expect(html).toContain('data-loading="true"');
    expect(html).toContain('data-slot="spinner"');
    expect(html).toContain("Save changes");
    expect(html).toContain("disabled");
  });

  it("renders loading text instead of the default label when provided", async () => {
    const { Button } = await import("../components/ui/button");
    const html = renderToStaticMarkup(
      <Button isLoading loadingText="Saving...">
        Save changes
      </Button>,
    );

    expect(html).toContain('data-slot="spinner"');
    expect(html).toContain("Saving...");
    expect(html).not.toContain("Save changes");
  });

  it("replaces icon-only content with a spinner while preserving accessible labeling", async () => {
    const { Button } = await import("../components/ui/button");
    const html = renderToStaticMarkup(
      <Button isLoading size="icon" aria-label="Refresh dashboard">
        <ArrowsClockwise weight="regular" />
      </Button>,
    );

    expect(html).toContain('data-slot="spinner"');
    expect(html).toContain('aria-label="Refresh dashboard"');
    expect(html).not.toContain('data-slot="button-content"');
  });
});
