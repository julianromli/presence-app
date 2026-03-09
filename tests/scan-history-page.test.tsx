import React, { Suspense } from "react";
import { describe, expect, it, vi } from "vitest";

import HistoryPage from "../app/scan/history/page";

vi.mock("../app/scan/history/history-panel", () => ({
  HistoryPanel: () => React.createElement("div", { "data-testid": "history-panel" }),
}));

describe("scan history page", () => {
  it("wraps the history panel in a Suspense boundary for useSearchParams", () => {
    const element = HistoryPage();

    expect(React.isValidElement(element)).toBe(true);
    expect(element.type).toBe(Suspense);
    expect(React.isValidElement(element.props.fallback)).toBe(true);
  });
});
