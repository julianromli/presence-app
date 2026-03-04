import { describe, expect, it, vi } from "vitest";

import { isValidWorkspaceId } from "../lib/workspace-context";

describe("workspace context contracts", () => {
  it("validates workspace id format", () => {
    expect(isValidWorkspaceId("workspace_123")).toBe(true);
    expect(isValidWorkspaceId("abc")).toBe(false);
    expect(isValidWorkspaceId("workspace with spaces")).toBe(false);
  });

  it("keeps env helper test isolated", () => {
    vi.stubEnv("DEFAULT_WORKSPACE_ID", "workspace_default_001");
    vi.unstubAllEnvs();
    expect(process.env.DEFAULT_WORKSPACE_ID).not.toBe("workspace_default_001");
  });
});
