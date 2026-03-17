import { beforeEach, describe, expect, it, vi } from "vitest";

const requireWorkspaceRole = vi.fn();
const sha256Hex = vi.fn(async (value: string) => `hash:${value}`);

vi.mock("../convex/helpers.js", () => ({
  requireWorkspaceRole,
  sha256Hex,
}));

type WorkspaceRow = {
  _id: string;
  name: string;
  slug: string;
  isActive: boolean;
  plan?: "free" | "pro" | "enterprise";
};

function makeWorkspace(overrides: Partial<WorkspaceRow> = {}): WorkspaceRow {
  return {
    _id: "workspace_free",
    name: "Presence HQ",
    slug: "presence-hq",
    isActive: true,
    plan: "free",
    ...overrides,
  };
}

function makeDevice(
  id: string,
  overrides: Partial<{
    workspaceId: string;
    label: string;
    deviceSecretHash: string;
    status: "active" | "revoked";
    claimedFromCodeId: string;
    claimedAt: number;
    createdAt: number;
    updatedAt: number;
    revokedAt: number;
    revokedByUserId: string;
  }> = {},
) {
  return {
    _id: id,
    workspaceId: "workspace_free",
    label: `Device ${id}`,
    deviceSecretHash: `secret:${id}`,
    status: "active" as const,
    claimedFromCodeId: "code_existing",
    claimedAt: 1,
    createdAt: 1,
    updatedAt: 1,
    ...overrides,
  };
}

function createStatusIndexQuery(
  devices: Array<ReturnType<typeof makeDevice>>,
  workspaceId: string,
) {
  return vi.fn((table: string) => ({
    withIndex: vi.fn((indexName: string, apply: (q: { eq: (field: string, value: string) => unknown }) => unknown) => {
      if (table === "devices" && indexName === "by_workspace_status") {
        let requestedWorkspaceId: string | undefined;
        let requestedStatus: string | undefined;
        const q = {
          eq(field: string, value: string) {
            if (field === "workspaceId") {
              requestedWorkspaceId = value;
              return q;
            }
            if (field === "status") {
              requestedStatus = value;
              return q;
            }
            throw new Error(`Unexpected devices.by_workspace_status field: ${field}`);
          },
        };
        apply(q);
        return {
          collect: vi.fn(async () =>
            devices.filter(
              (device) =>
                device.workspaceId === (requestedWorkspaceId ?? workspaceId) &&
                device.status === requestedStatus,
            ),
          ),
        };
      }

      throw new Error(`Unexpected query: ${table}.${indexName}`);
    }),
  }));
}

function makeCreateRegistrationCodeCtx(options: {
  workspace?: WorkspaceRow;
  devices?: Array<ReturnType<typeof makeDevice>>;
} = {}) {
  const workspace = options.workspace ?? makeWorkspace();
  const devices = options.devices ?? [];

  const get = vi.fn(async (id: string) => (id === workspace._id ? workspace : null));
  const insert = vi.fn(async (table: string) => `${table}_created`);
  const query = createStatusIndexQuery(devices, workspace._id);

  return {
    ctx: {
      db: {
        get,
        insert,
        query,
      },
    },
    workspace,
    mocks: {
      get,
      insert,
      query,
    },
  };
}

function makeClaimRegistrationCodeCtx(options: {
  workspace?: WorkspaceRow;
  devices?: Array<ReturnType<typeof makeDevice>>;
  bootstrapAttempt?: {
    _id: string;
    workspaceId: string;
    scope: "claim_code";
    keyHash: string;
    firstAttemptAt: number;
    lastAttemptAt: number;
    attemptCount: number;
    blockedUntil?: number;
  } | null;
} = {}) {
  const workspace = options.workspace ?? makeWorkspace();
  const devices = options.devices ?? [];
  const bootstrapAttempt = options.bootstrapAttempt ?? null;
  const codeRow = {
    _id: "code_pending",
    _creationTime: 1,
    workspaceId: workspace._id,
    codeHash: "hash:GOOD-CODE",
    createdByUserId: "user_admin",
    createdAt: 10,
    expiresAt: Date.now() + 60_000,
    claimedAt: undefined,
    claimedByDeviceId: undefined,
    revokedAt: undefined,
  };

  const get = vi.fn(async (id: string) => (id === workspace._id ? workspace : null));
  const insert = vi.fn(async (table: string) => `${table}_created`);
  const patch = vi.fn(async (id: string, value: Record<string, unknown>) => {
    if (id === codeRow._id) {
      Object.assign(codeRow, value);
    }
    if (bootstrapAttempt && id === bootstrapAttempt._id) {
      Object.assign(bootstrapAttempt, value);
    }
  });
  const delete_ = vi.fn(async () => undefined);
  const statusQuery = createStatusIndexQuery(devices, workspace._id);
  const query = vi.fn((table: string) => ({
    withIndex: vi.fn((indexName: string, apply?: (q: { eq: (field: string, value: string) => unknown }) => unknown) => {
      if (table === "device_bootstrap_attempts" && indexName === "by_workspace_scope_key_hash") {
        return { unique: vi.fn(async () => bootstrapAttempt) };
      }

      if (table === "device_registration_codes" && indexName === "by_workspace_code_hash") {
        return { unique: vi.fn(async () => codeRow) };
      }

      if (table === "devices" && indexName === "by_workspace_status") {
        return statusQuery(table).withIndex(indexName, apply as never);
      }

      throw new Error(`Unexpected query: ${table}.${indexName}`);
    }),
  }));

  return {
    ctx: {
      db: {
        get,
        insert,
        patch,
        delete: delete_,
        query,
      },
    },
    bootstrapAttempt,
    codeRow,
    workspace,
    mocks: {
      delete: delete_,
      get,
      insert,
      patch,
      query,
    },
  };
}

function makeUpdateDeviceCtx(options: {
  workspace?: WorkspaceRow;
  device?: ReturnType<typeof makeDevice>;
} = {}) {
  const workspace = options.workspace ?? makeWorkspace();
  const device =
    options.device ??
    makeDevice("device_123", {
      workspaceId: workspace._id,
      label: "Front Desk Tablet",
    });

  const get = vi.fn(async (id: string) => {
    if (id === device._id) {
      return device;
    }
    if (id === workspace._id) {
      return workspace;
    }
    return null;
  });
  const insert = vi.fn(async () => "audit_log_created");
  const patch = vi.fn(async (id: string, value: Record<string, unknown>) => {
    if (id === device._id) {
      Object.assign(device, value);
    }
  });

  return {
    ctx: {
      db: {
        get,
        insert,
        patch,
      },
    },
    device,
    workspace,
    mocks: {
      get,
      insert,
      patch,
    },
  };
}

describe("devices plan limits", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    requireWorkspaceRole.mockResolvedValue({
      user: { _id: "user_admin" },
      membership: {
        _id: "membership_admin",
        workspaceId: "workspace_free",
        userId: "user_admin",
        role: "superadmin",
        isActive: true,
      },
    });
  });

  it("createRegistrationCode rejects when active devices already hit the plan limit", async () => {
    const { createRegistrationCode } = await import("../convex/devices.js");
    const { ctx, mocks, workspace } = makeCreateRegistrationCodeCtx({
      devices: [makeDevice("device_active_1")],
    });

    await expect(
      createRegistrationCode._handler(ctx as never, {
        workspaceId: workspace._id as never,
      }),
    ).rejects.toMatchObject({
      data: {
        code: "PLAN_LIMIT_REACHED",
        message: expect.stringMatching(/device/i),
      },
    });

    expect(mocks.insert).not.toHaveBeenCalledWith(
      "device_registration_codes",
      expect.anything(),
    );
  });

  it("excludes revoked devices from active-device counting for the cap", async () => {
    const { createRegistrationCode } = await import("../convex/devices.js");
    const { ctx, mocks, workspace } = makeCreateRegistrationCodeCtx({
      devices: [
        makeDevice("device_revoked_1", {
          status: "revoked",
          revokedAt: 123,
          revokedByUserId: "user_admin",
        }),
      ],
    });

    const result = await createRegistrationCode._handler(ctx as never, {
      workspaceId: workspace._id as never,
    });

    expect(result.status).toBe("pending");
    expect(mocks.insert).toHaveBeenCalledWith(
      "device_registration_codes",
      expect.objectContaining({
        workspaceId: workspace._id,
      }),
    );
  });

  it("claimRegistrationCode rejects too, so pending codes cannot bypass the cap", async () => {
    const { claimRegistrationCode } = await import("../convex/devices.js");
    const { codeRow, ctx, mocks, workspace } = makeClaimRegistrationCodeCtx({
      devices: [makeDevice("device_active_1")],
    });

    await expect(
      claimRegistrationCode._handler(ctx as never, {
        workspaceId: workspace._id as never,
        code: "GOOD-CODE",
        label: "Front Desk Tablet",
        rateLimitKey: "ip:203.0.113.1|ua:Vitest",
      }),
    ).rejects.toMatchObject({
      data: {
        code: "PLAN_LIMIT_REACHED",
        message: expect.stringMatching(/device/i),
      },
    });

    expect(mocks.insert).not.toHaveBeenCalledWith("devices", expect.anything());
    expect(mocks.patch).not.toHaveBeenCalledWith(
      codeRow._id,
      expect.objectContaining({
        claimedAt: expect.any(Number),
      }),
    );
  });

  it("keeps returning PLAN_LIMIT_REACHED on repeated cap hits without poisoning the abuse limiter", async () => {
    const { claimRegistrationCode } = await import("../convex/devices.js");
    const { bootstrapAttempt, ctx, mocks, workspace } = makeClaimRegistrationCodeCtx({
      devices: [makeDevice("device_active_1")],
      bootstrapAttempt: {
        _id: "attempt_1",
        workspaceId: "workspace_free",
        scope: "claim_code",
        keyHash: "hash:ip:203.0.113.1|ua:Vitest",
        firstAttemptAt: Date.now() - 1_000,
        lastAttemptAt: Date.now() - 500,
        attemptCount: 3,
      },
    });

    const claimArgs = {
      workspaceId: workspace._id as never,
      code: "GOOD-CODE",
      label: "Front Desk Tablet",
      rateLimitKey: "ip:203.0.113.1|ua:Vitest",
    };

    await expect(claimRegistrationCode._handler(ctx as never, claimArgs)).rejects.toMatchObject({
      data: {
        code: "PLAN_LIMIT_REACHED",
      },
    });
    await expect(claimRegistrationCode._handler(ctx as never, claimArgs)).rejects.toMatchObject({
      data: {
        code: "PLAN_LIMIT_REACHED",
      },
    });

    expect(bootstrapAttempt?.blockedUntil).toBeUndefined();
    expect(mocks.insert).not.toHaveBeenCalledWith(
      "device_bootstrap_attempts",
      expect.anything(),
    );
    expect(mocks.patch).not.toHaveBeenCalledWith(
      "attempt_1",
      expect.objectContaining({
        attemptCount: expect.any(Number),
      }),
    );
  });
});

describe("devices revoke behavior", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    requireWorkspaceRole.mockResolvedValue({
      user: { _id: "user_admin" },
      membership: {
        _id: "membership_admin",
        workspaceId: "workspace_free",
        userId: "user_admin",
        role: "superadmin",
        isActive: true,
      },
    });
  });

  it("keeps revoke idempotent for an already revoked device", async () => {
    const { updateDevice } = await import("../convex/devices.js");
    const { ctx, device, mocks, workspace } = makeUpdateDeviceCtx({
      device: makeDevice("device_revoked_1", {
        workspaceId: "workspace_free",
        label: "Front Desk Tablet",
        status: "revoked",
        revokedAt: 123456,
        revokedByUserId: "user_original",
      }),
    });

    const result = await updateDevice._handler(ctx as never, {
      workspaceId: workspace._id as never,
      deviceId: device._id as never,
      revoke: true,
    });

    expect(result).toEqual({
      deviceId: device._id,
      label: "Front Desk Tablet",
      status: "revoked",
    });
    expect(device.revokedAt).toBe(123456);
    expect(device.revokedByUserId).toBe("user_original");
    expect(mocks.patch).not.toHaveBeenCalled();
    expect(mocks.insert).not.toHaveBeenCalled();
  });
});
