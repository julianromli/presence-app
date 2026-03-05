import { describe, expect, it } from "vitest";

import { toInviteCodeView } from "../convex/workspaceInviteView";

describe("toInviteCodeView", () => {
  it("returns null when invite is null", () => {
    expect(toInviteCodeView(null)).toBeNull();
  });

  it("maps DB invite document to validator-safe shape", () => {
    const input = {
      _creationTime: 1772680577650.3125,
      _id: "k978smqst1pw16ywyacdmd979182ac3t",
      code: "LUMBUNG-TOUR-HARAMAIN-KK3G0H-PRESENCE",
      createdAt: 1772680577650,
      createdByUserId: "jn7aqz2a8gjpbt76y5xxbnzqws827p1w",
      isActive: true,
      lastRotatedAt: 1772680577650,
      updatedAt: 1772680577650,
      workspaceId: "kh75bbcp05f75fgc75pj8t25vh82bs8g",
      expiresAt: 1775290577650,
    };

    expect(toInviteCodeView(input)).toEqual({
      _id: "k978smqst1pw16ywyacdmd979182ac3t",
      code: "LUMBUNG-TOUR-HARAMAIN-KK3G0H-PRESENCE",
      isActive: true,
      createdAt: 1772680577650,
      updatedAt: 1772680577650,
      lastRotatedAt: 1772680577650,
      expiresAt: 1775290577650,
    });
  });
});
