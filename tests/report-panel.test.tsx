import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("lucide-react", () => {
  const Icon = () => React.createElement("svg");
  return {
    CalendarIcon: Icon,
    ChevronDown: Icon,
    ChevronRight: Icon,
  };
});

vi.mock("@/components/ui/button", () => ({
  Button: ({
    children,
    isLoading,
    loadingText,
    render,
    ...props
  }: {
    children?: React.ReactNode;
    isLoading?: boolean;
    loadingText?: React.ReactNode;
    render?: React.ReactElement;
  } & React.ButtonHTMLAttributes<HTMLButtonElement>) =>
    render
      ? React.cloneElement(
          render,
          {
            ...props,
            "data-loading": isLoading || undefined,
            "data-loading-text": loadingText ? "true" : undefined,
          },
          children,
        )
      : React.createElement(
          "button",
          {
            ...props,
            "data-loading": isLoading || undefined,
            "data-loading-text": loadingText ? "true" : undefined,
          },
          children,
        ),
}));

vi.mock("@/components/ui/input", () => ({
  Input: (props: React.InputHTMLAttributes<HTMLInputElement>) =>
    React.createElement("input", props),
}));

vi.mock("@/components/ui/calendar", () => ({
  Calendar: () => React.createElement("div", null, "Calendar"),
}));

vi.mock("@/components/ui/confirmation-dialog", () => ({
  ConfirmationDialog: () => null,
}));

vi.mock("@/components/ui/table", () => ({
  Table: ({
    children,
    ...props
  }: React.HTMLAttributes<HTMLTableElement>) => React.createElement("table", props, children),
  TableBody: ({
    children,
    ...props
  }: React.HTMLAttributes<HTMLTableSectionElement>) =>
    React.createElement("tbody", props, children),
  TableCell: ({
    children,
    ...props
  }: React.TdHTMLAttributes<HTMLTableCellElement>) => React.createElement("td", props, children),
  TableHead: ({
    children,
    ...props
  }: React.ThHTMLAttributes<HTMLTableCellElement>) => React.createElement("th", props, children),
  TableHeader: ({
    children,
    ...props
  }: React.HTMLAttributes<HTMLTableSectionElement>) =>
    React.createElement("thead", props, children),
  TableRow: ({
    children,
    ...props
  }: React.HTMLAttributes<HTMLTableRowElement>) => React.createElement("tr", props, children),
}));

vi.mock("@/components/ui/popover", () => ({
  Popover: ({ children }: { children: React.ReactNode }) => React.createElement("div", null, children),
  PopoverPopup: ({ children }: { children: React.ReactNode }) =>
    React.createElement("div", null, children),
  PopoverTrigger: ({
    children,
    render,
    ...props
  }: {
    children?: React.ReactNode;
    render?: React.ReactElement;
  }) => (render ? React.cloneElement(render, props, children) : React.createElement("button", props, children)),
}));

vi.mock("@/components/ui/collapsible", () => ({
  Collapsible: ({ children }: { children: React.ReactNode }) => React.createElement("section", null, children),
  CollapsiblePanel: ({ children }: { children: React.ReactNode }) =>
    React.createElement("div", null, children),
  CollapsibleTrigger: ({
    children,
    ...props
  }: {
    children?: React.ReactNode;
  } & React.ButtonHTMLAttributes<HTMLButtonElement>) => React.createElement("button", props, children),
}));

vi.mock("@/components/ui/menu", () => ({
  Menu: ({ children }: { children: React.ReactNode }) => React.createElement("div", null, children),
  MenuPopup: ({ children }: { children: React.ReactNode }) => React.createElement("div", null, children),
  MenuRadioGroup: ({ children }: { children: React.ReactNode }) =>
    React.createElement("div", null, children),
  MenuRadioItem: ({ children }: { children: React.ReactNode }) => React.createElement("div", null, children),
  MenuTrigger: ({
    children,
    render,
    ...props
  }: {
    children?: React.ReactNode;
    render?: React.ReactElement;
  }) => (render ? React.cloneElement(render, props, children) : React.createElement("button", props, children)),
}));

vi.mock("@/lib/utils", () => ({
  cn: (...values: Array<string | false | null | undefined>) => values.filter(Boolean).join(" "),
}));

vi.mock("@/lib/workspace-subscription-client", () => ({
  getReportExportUpgradeCopy: () => null,
  isReportExportDisabled: () => false,
  useWorkspaceSubscriptionClient: () => ({
    workspaceId: "workspace_123",
    subscription: null,
    loading: false,
    ready: true,
    error: null,
  }),
}));

describe("report panel", () => {
  it("renders the calmer hierarchy with section-scoped actions and explicit collapse labels", async () => {
    const { ReportPanel } = await import("../components/dashboard/report-panel");
    const html = renderToStaticMarkup(<ReportPanel />);

    expect(html).toContain("Ringkasan absensi hari ini");
    expect(html).toContain("Filter absensi harian");
    expect(html).toContain("Status scan");
    expect(html).toContain("Sinkronkan scan event");
    expect(html).toContain("Buat report mingguan");
    expect(html).toContain("Sinkronkan riwayat report");
    expect(html).toContain('aria-label="Sembunyikan Data attendance"');
  });
});
