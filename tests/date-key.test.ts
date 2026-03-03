import { describe, expect, it } from "vitest";

import { getDateKeyAtOffset } from "../lib/date-key";

describe("date key helpers", () => {
  it("uses local day for UTC+7 midnight boundary", () => {
    const instant = new Date("2026-03-03T00:30:00+07:00");
    expect(getDateKeyAtOffset(instant, -420)).toBe("2026-03-03");
  });

  it("keeps same day for UTC timezone", () => {
    const instant = new Date("2026-03-03T00:30:00Z");
    expect(getDateKeyAtOffset(instant, 0)).toBe("2026-03-03");
  });
});
