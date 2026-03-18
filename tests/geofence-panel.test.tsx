import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

function findElement(
  node: React.ReactNode,
  predicate: (element: React.ReactElement) => boolean,
): React.ReactElement | null {
  if (!React.isValidElement(node)) {
    return null;
  }

  if (predicate(node)) {
    return node;
  }

  const children = React.Children.toArray(node.props.children);
  for (const child of children) {
    const match = findElement(child, predicate);
    if (match) {
      return match;
    }
  }

  return null;
}

describe("geofence timezone field", () => {
  it("renders a dropdown trigger with the selected timezone", async () => {
    const { GeofenceTimezoneField } = await import("../components/dashboard/geofence-panel");
    const html = renderToStaticMarkup(
      <GeofenceTimezoneField
        disabled={false}
        value="Asia/Jakarta"
        onChange={() => undefined}
      />,
    );

    expect(html).toContain("Timezone");
    expect(html).toContain("Asia/Jakarta");
  });

  it("forwards selected timezone values through the change handler", async () => {
    const { GeofenceTimezoneField } = await import("../components/dashboard/geofence-panel");
    const onChange = vi.fn();
    const tree = GeofenceTimezoneField({
      disabled: false,
      value: "Asia/Jakarta",
      onChange,
    });
    const radioGroup = findElement(
      tree,
      (element) =>
        typeof element.props.onValueChange === "function" &&
        element.props.value === "Asia/Jakarta",
    );

    expect(radioGroup).not.toBeNull();
    radioGroup?.props.onValueChange("Asia/Singapore");

    expect(onChange).toHaveBeenCalledWith("Asia/Singapore");
  });
});
