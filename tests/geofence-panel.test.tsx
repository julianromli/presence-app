import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import {
  buildGeofencePanelState,
  validateGeofenceSettings,
} from "@/components/dashboard/geofence-panel-state";

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

describe("geofence panel", () => {
  it("renders a dropdown trigger with the selected timezone", async () => {
    const { GeofenceTimezoneField } = await import(
      "../components/dashboard/geofence-panel"
    );
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
    const { GeofenceTimezoneField } = await import(
      "../components/dashboard/geofence-panel"
    );
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

  it("initializes readonly coordinates from saved geofence settings", () => {
    const state = buildGeofencePanelState({
      timezone: "Asia/Jakarta",
      geofenceEnabled: false,
      geofenceRadiusMeters: 100,
      minLocationAccuracyMeters: 50,
      geofenceLat: -6.2,
      geofenceLng: 106.8,
      whitelistEnabled: false,
      whitelistIps: [],
    });

    expect(state.data.geofenceLat).toBe(-6.2);
    expect(state.data.geofenceLng).toBe(106.8);
    expect(state.selectedPoint).toEqual({
      latitude: -6.2,
      longitude: 106.8,
    });
  });

  it("falls back to empty coordinates when saved settings do not contain a valid point", () => {
    const state = buildGeofencePanelState({
      timezone: "Asia/Jakarta",
      geofenceEnabled: false,
      geofenceRadiusMeters: 100,
      minLocationAccuracyMeters: 50,
      geofenceLat: undefined,
      geofenceLng: undefined,
      whitelistEnabled: false,
      whitelistIps: [],
    });

    expect(state.data.geofenceLat).toBeUndefined();
    expect(state.data.geofenceLng).toBeUndefined();
    expect(state.selectedPoint).toBeNull();
  });

  it("keeps save-blocking validation when geofence is enabled without a selected point", () => {
    const errors = validateGeofenceSettings({
      timezone: "Asia/Jakarta",
      geofenceEnabled: true,
      geofenceRadiusMeters: 100,
      minLocationAccuracyMeters: 50,
      geofenceLat: undefined,
      geofenceLng: undefined,
      whitelistEnabled: false,
      whitelistIps: [],
    });

    expect(errors).toContainEqual(expect.stringMatching(/wajib diisi/i));
  });
});
