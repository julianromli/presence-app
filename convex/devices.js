import { ConvexError, v } from "convex/values";

import { internalMutation, mutation, query } from "./_generated/server";
import { requireWorkspaceRole, sha256Hex } from "./helpers";
import { assertWorkspaceActiveDeviceLimitNotReached } from "./workspaceSubscription";

export const deviceStatusValidator = v.union(
  v.literal("active"),
  v.literal("revoked"),
);

export const registrationCodeStatusValidator = v.union(
  v.literal("pending"),
  v.literal("claimed"),
  v.literal("expired"),
  v.literal("revoked"),
);

export const registrationCodeRowValidator = v.object({
  _id: v.id("device_registration_codes"),
  _creationTime: v.number(),
  workspaceId: v.id("workspaces"),
  codeHash: v.string(),
  createdByUserId: v.id("users"),
  createdAt: v.number(),
  expiresAt: v.number(),
  claimedAt: v.optional(v.number()),
  claimedByDeviceId: v.optional(v.id("devices")),
  revokedAt: v.optional(v.number()),
});

export const deviceRowValidator = v.object({
  _id: v.id("devices"),
  _creationTime: v.number(),
  workspaceId: v.id("workspaces"),
  label: v.string(),
  deviceSecretHash: v.string(),
  status: deviceStatusValidator,
  claimedFromCodeId: v.id("device_registration_codes"),
  claimedAt: v.number(),
  createdAt: v.number(),
  updatedAt: v.number(),
  lastSeenAt: v.optional(v.number()),
  revokedAt: v.optional(v.number()),
  revokedByUserId: v.optional(v.id("users")),
  initialIpAddress: v.optional(v.string()),
  initialUserAgent: v.optional(v.string()),
});

const registrationCodePreviewValidator = v.object({
  ok: v.boolean(),
  status: v.optional(registrationCodeStatusValidator),
  expiresAt: v.optional(v.number()),
  workspace: v.optional(
    v.object({
      workspaceId: v.id("workspaces"),
      name: v.string(),
    }),
  ),
});

const registrationCodeListItemValidator = v.object({
  codeId: v.id("device_registration_codes"),
  createdAt: v.number(),
  expiresAt: v.number(),
  claimedAt: v.optional(v.number()),
  claimedByDeviceId: v.optional(v.id("devices")),
  revokedAt: v.optional(v.number()),
  status: registrationCodeStatusValidator,
});

const claimResultValidator = v.object({
  deviceId: v.id("devices"),
  label: v.string(),
  secret: v.string(),
  claimedAt: v.number(),
  workspace: v.object({
    workspaceId: v.id("workspaces"),
    name: v.string(),
  }),
});

const authenticatedDeviceValidator = v.object({
  device: v.object({
    deviceId: v.id("devices"),
    label: v.string(),
    claimedAt: v.number(),
  }),
  workspace: v.object({
    workspaceId: v.id("workspaces"),
    name: v.string(),
  }),
});

const deviceListItemValidator = v.object({
  deviceId: v.id("devices"),
  label: v.string(),
  status: deviceStatusValidator,
  online: v.boolean(),
  lastSeenAt: v.optional(v.number()),
  claimedAt: v.number(),
  claimedFromCodeId: v.id("device_registration_codes"),
});

const BOOTSTRAP_RATE_LIMIT_CONFIG = {
  validate_code: {
    maxAttempts: 6,
    windowMs: 10 * 60_000,
    blockMs: 15 * 60_000,
  },
  claim_code: {
    maxAttempts: 4,
    windowMs: 10 * 60_000,
    blockMs: 30 * 60_000,
  },
};

const NON_ABUSE_BOOTSTRAP_ERROR_CODES = new Set([
  "SPAM_DETECTED",
  "PLAN_LIMIT_REACHED",
  "WORKSPACE_INVALID",
]);

function normalizeRegistrationCode(input) {
  return input.trim().toUpperCase().replace(/\s+/g, "").replace(/-+/g, "-");
}

function normalizeDeviceLabel(input) {
  return input.trim().replace(/\s+/g, " ");
}

function generateRegistrationCode() {
  const head = crypto.randomUUID().slice(0, 8).toUpperCase();
  const tail = crypto.randomUUID().slice(0, 8).toUpperCase();
  return `${head}-${tail}`;
}

function generateDeviceSecret() {
  return `${crypto.randomUUID().replaceAll("-", "")}${crypto.randomUUID().replaceAll("-", "")}`;
}

export async function hashDeviceCredential(value) {
  return await sha256Hex(value);
}

export function deriveRegistrationCodeStatus(row, now = Date.now()) {
  if (row.revokedAt) {
    return "revoked";
  }

  if (row.claimedAt) {
    return "claimed";
  }

  if (row.expiresAt <= now) {
    return "expired";
  }

  return "pending";
}

export function assertRegistrationCodeClaimable(row, now = Date.now()) {
  const status = deriveRegistrationCodeStatus(row, now);

  if (status === "revoked") {
    throw new ConvexError({
      code: "REGISTRATION_CODE_REVOKED",
      message: "Kode registrasi sudah tidak aktif.",
    });
  }

  if (status === "claimed") {
    throw new ConvexError({
      code: "REGISTRATION_CODE_CLAIMED",
      message: "Kode registrasi sudah dipakai.",
    });
  }

  if (status === "expired") {
    throw new ConvexError({
      code: "REGISTRATION_CODE_EXPIRED",
      message: "Kode registrasi sudah kedaluwarsa.",
    });
  }
}

export function pickExpiredRegistrationCodeIds(rows, now = Date.now()) {
  return rows
    .filter((row) => deriveRegistrationCodeStatus(row, now) === "expired")
    .map((row) => row._id);
}

async function getRegistrationCodeByHash(ctx, _workspaceId, normalizedCode) {
  const codeHash = await hashDeviceCredential(normalizedCode);
  return await ctx.db
    .query("device_registration_codes")
    .withIndex("by_code_hash", (q) => q.eq("codeHash", codeHash))
    .unique();
}

async function getBootstrapAttemptByKeyHash(ctx, scope, keyHash, workspaceId) {
  if (workspaceId) {
    return await ctx.db
      .query("device_bootstrap_attempts")
      .withIndex("by_workspace_scope_key_hash", (q) =>
        q.eq("workspaceId", workspaceId).eq("scope", scope).eq("keyHash", keyHash),
      )
      .unique();
  }

  return await ctx.db
    .query("device_bootstrap_attempts")
    .withIndex("by_scope_key_hash", (q) =>
      q.eq("scope", scope).eq("keyHash", keyHash),
    )
    .unique();
}

function getRateLimitMessage(scope, blockedUntil, now = Date.now()) {
  const retryAfterSeconds = Math.max(
    1,
    Math.ceil((blockedUntil - now) / 1000),
  );
  const actionLabel =
    scope === "claim_code" ? "aktivasi device" : "validasi kode registrasi";
  return `Terlalu banyak percobaan ${actionLabel}. Coba lagi dalam ${retryAfterSeconds} detik.`;
}

async function resolveBootstrapAttemptContext(
  ctx,
  { scope, rateLimitKey, workspaceId, now = Date.now() },
) {
  if (!rateLimitKey) {
    return null;
  }

  const keyHash = await hashDeviceCredential(rateLimitKey);
  const row = await getBootstrapAttemptByKeyHash(ctx, scope, keyHash, workspaceId);
  if (row?.blockedUntil && row.blockedUntil > now) {
    throw new ConvexError({
      code: "SPAM_DETECTED",
      message: getRateLimitMessage(scope, row.blockedUntil, now),
    });
  }

  return { keyHash, row };
}

async function clearBootstrapAttemptContext(ctx, attemptContext) {
  if (!attemptContext?.row) {
    return;
  }

  await ctx.db.delete(attemptContext.row._id);
}

async function recordBootstrapAttemptFailure(
  ctx,
  { workspaceId, scope, attemptContext, now = Date.now() },
) {
  if (!attemptContext?.keyHash) {
    return;
  }

  const config = BOOTSTRAP_RATE_LIMIT_CONFIG[scope];
  const currentRow =
    attemptContext.row ??
    (await getBootstrapAttemptByKeyHash(
      ctx,
      scope,
      attemptContext.keyHash,
      workspaceId,
    ));
  const shouldResetWindow =
    !currentRow ||
    (currentRow.blockedUntil !== undefined && currentRow.blockedUntil <= now) ||
    now - currentRow.firstAttemptAt >= config.windowMs;
  const nextAttemptCount = shouldResetWindow ? 1 : currentRow.attemptCount + 1;
  const blockedUntil =
    nextAttemptCount >= config.maxAttempts ? now + config.blockMs : undefined;
  const patch = {
    firstAttemptAt: shouldResetWindow ? now : currentRow.firstAttemptAt,
    lastAttemptAt: now,
    attemptCount: nextAttemptCount,
    blockedUntil,
  };

  if (currentRow) {
    await ctx.db.patch(currentRow._id, patch);
    return;
  }

  await ctx.db.insert("device_bootstrap_attempts", {
    workspaceId,
    scope,
    keyHash: attemptContext.keyHash,
    ...patch,
  });
}

function shouldCountBootstrapFailure(error) {
  if (!(error instanceof ConvexError) || !error.data?.code) {
    return false;
  }

  return !NON_ABUSE_BOOTSTRAP_ERROR_CODES.has(error.data.code);
}

async function insertAuditLog(ctx, entry) {
  await ctx.db.insert("audit_logs", entry);
}

async function getActiveWorkspaceOrThrow(ctx, workspaceId) {
  const workspace = await ctx.db.get(workspaceId);
  if (!workspace || !workspace.isActive) {
    throw new ConvexError({
      code: "WORKSPACE_INVALID",
      message: "Workspace tidak valid.",
    });
  }

  return workspace;
}

function buildAutoDeviceLabel(codeId) {
  const suffix = String(codeId).slice(-6).toUpperCase();
  return `QR Device ${suffix}`;
}

export const createRegistrationCode = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    ttlMs: v.optional(v.number()),
  },
  returns: v.object({
    codeId: v.id("device_registration_codes"),
    code: v.string(),
    createdAt: v.number(),
    expiresAt: v.number(),
    status: registrationCodeStatusValidator,
  }),
  handler: async (ctx, args) => {
    const { user } = await requireWorkspaceRole(ctx, args.workspaceId, ["superadmin"]);
    const workspace = await getActiveWorkspaceOrThrow(ctx, args.workspaceId);
    await assertWorkspaceActiveDeviceLimitNotReached(ctx, workspace);
    const now = Date.now();
    const ttlMs = Math.max(60_000, Math.trunc(args.ttlMs ?? 5 * 60_000));
    const code = generateRegistrationCode();
    const normalizedCode = normalizeRegistrationCode(code);
    const codeHash = await hashDeviceCredential(normalizedCode);
    const expiresAt = now + ttlMs;

    const codeId = await ctx.db.insert("device_registration_codes", {
      workspaceId: args.workspaceId,
      codeHash,
      createdByUserId: user._id,
      createdAt: now,
      expiresAt,
      claimedAt: undefined,
      claimedByDeviceId: undefined,
      revokedAt: undefined,
    });

    await insertAuditLog(ctx, {
      actorUserId: user._id,
      workspaceId: args.workspaceId,
      action: "device_registration_code.created",
      targetType: "device_registration_codes",
      targetId: String(codeId),
      payload: { expiresAt },
      createdAt: now,
    });

    return {
      codeId,
      code,
      createdAt: now,
      expiresAt,
      status: "pending",
    };
  },
});

export const listRegistrationCodes = query({
  args: {
    workspaceId: v.id("workspaces"),
  },
  returns: v.array(registrationCodeListItemValidator),
  handler: async (ctx, args) => {
    await requireWorkspaceRole(ctx, args.workspaceId, ["superadmin"]);
    const now = Date.now();
    const rows = await ctx.db
      .query("device_registration_codes")
      .withIndex("by_workspace_expires_at", (q) => q.eq("workspaceId", args.workspaceId))
      .collect();

    return rows
      .map((row) => ({
        codeId: row._id,
        createdAt: row.createdAt,
        expiresAt: row.expiresAt,
        claimedAt: row.claimedAt,
        claimedByDeviceId: row.claimedByDeviceId,
        revokedAt: row.revokedAt,
        status: deriveRegistrationCodeStatus(row, now),
      }))
      .sort((left, right) => right.createdAt - left.createdAt);
  },
});

export const validateRegistrationCodePreview = mutation({
  args: {
    workspaceId: v.optional(v.id("workspaces")),
    code: v.string(),
    rateLimitKey: v.optional(v.string()),
  },
  returns: registrationCodePreviewValidator,
  handler: async (ctx, args) => {
    const normalizedCode = normalizeRegistrationCode(args.code);
    const attemptContext = await resolveBootstrapAttemptContext(ctx, {
      scope: "validate_code",
      rateLimitKey: args.rateLimitKey,
    });
    if (!normalizedCode) {
      await recordBootstrapAttemptFailure(ctx, {
        workspaceId: args.workspaceId,
        scope: "validate_code",
        attemptContext,
      });
      return { ok: false };
    }

    const row = await getRegistrationCodeByHash(ctx, args.workspaceId, normalizedCode);
    if (!row) {
      await recordBootstrapAttemptFailure(ctx, {
        workspaceId: args.workspaceId,
        scope: "validate_code",
        attemptContext,
      });
      return { ok: false };
    }

    const workspaceAttemptContext = await resolveBootstrapAttemptContext(ctx, {
      scope: "validate_code",
      rateLimitKey: args.rateLimitKey,
      workspaceId: row.workspaceId,
    });
    const workspace = await getActiveWorkspaceOrThrow(ctx, row.workspaceId);
    const status = deriveRegistrationCodeStatus(row, Date.now());
    if (status !== "pending") {
      await recordBootstrapAttemptFailure(ctx, {
        workspaceId: row.workspaceId,
        scope: "validate_code",
        attemptContext: workspaceAttemptContext,
      });
      return {
        ok: false,
        status,
        workspace: {
          workspaceId: workspace._id,
          name: workspace.name,
        },
      };
    }

    await clearBootstrapAttemptContext(ctx, workspaceAttemptContext ?? attemptContext);

    return {
      ok: true,
      status,
      expiresAt: row.expiresAt,
      workspace: {
        workspaceId: workspace._id,
        name: workspace.name,
      },
    };
  },
});

export const authenticateDevice = query({
  args: {
    deviceId: v.id("devices"),
    secret: v.string(),
  },
  returns: v.union(v.null(), authenticatedDeviceValidator),
  handler: async (ctx, args) => {
    const device = await ctx.db.get(args.deviceId);
    if (!device || device.status !== "active") {
      return null;
    }

    const secretHash = await hashDeviceCredential(args.secret);
    if (device.deviceSecretHash !== secretHash) {
      return null;
    }

    const workspace = await ctx.db.get(device.workspaceId);
    if (!workspace || !workspace.isActive) {
      return null;
    }

    return {
      device: {
        deviceId: device._id,
        label: device.label,
        claimedAt: device.claimedAt,
      },
      workspace: {
        workspaceId: workspace._id,
        name: workspace.name,
      },
    };
  },
});

export const listDevices = query({
  args: {
    workspaceId: v.id("workspaces"),
  },
  returns: v.array(deviceListItemValidator),
  handler: async (ctx, args) => {
    await requireWorkspaceRole(ctx, args.workspaceId, ["superadmin"]);
    const now = Date.now();
    const onlineThreshold = now - 60_000;
    const devices = await ctx.db
      .query("devices")
      .withIndex("by_workspace_status", (q) => q.eq("workspaceId", args.workspaceId))
      .collect();

    const rows = await Promise.all(
      devices.map(async (device) => {
        const heartbeat = await ctx.db
          .query("device_heartbeats")
          .withIndex("by_workspace_device_id", (q) =>
            q.eq("workspaceId", args.workspaceId).eq("deviceId", device._id),
          )
          .unique();

        return {
          deviceId: device._id,
          label: device.label,
          status: device.status,
          online:
            device.status === "active" &&
            (heartbeat?.lastSeenAt ?? 0) >= onlineThreshold,
          lastSeenAt: heartbeat?.lastSeenAt ?? device.lastSeenAt,
          claimedAt: device.claimedAt,
          claimedFromCodeId: device.claimedFromCodeId,
        };
      }),
    );

    rows.sort((left, right) => right.claimedAt - left.claimedAt);
    return rows;
  },
});

export const claimRegistrationCode = mutation({
  args: {
    workspaceId: v.optional(v.id("workspaces")),
    code: v.string(),
    label: v.optional(v.string()),
    ipAddress: v.optional(v.string()),
    userAgent: v.optional(v.string()),
    rateLimitKey: v.optional(v.string()),
  },
  returns: claimResultValidator,
  handler: async (ctx, args) => {
    let attemptContext = null;
    let resolvedWorkspaceId = args.workspaceId;

    try {
      attemptContext = await resolveBootstrapAttemptContext(ctx, {
        scope: "claim_code",
        rateLimitKey: args.rateLimitKey,
      });
      const normalizedCode = normalizeRegistrationCode(args.code);
      if (!normalizedCode) {
        throw new ConvexError({
          code: "VALIDATION_ERROR",
          message: "Kode registrasi wajib diisi.",
        });
      }

      const codeRow = await getRegistrationCodeByHash(ctx, args.workspaceId, normalizedCode);
      resolvedWorkspaceId = codeRow?.workspaceId ?? args.workspaceId;
      attemptContext = await resolveBootstrapAttemptContext(ctx, {
        scope: "claim_code",
        rateLimitKey: args.rateLimitKey,
        workspaceId: resolvedWorkspaceId,
      });
      if (!codeRow) {
        throw new ConvexError({
          code: "REGISTRATION_CODE_INVALID",
          message: "Kode registrasi tidak valid.",
        });
      }

      const workspace = await getActiveWorkspaceOrThrow(ctx, codeRow.workspaceId);

      const claimedAt = Date.now();
      assertRegistrationCodeClaimable(codeRow, claimedAt);
      await assertWorkspaceActiveDeviceLimitNotReached(ctx, workspace);

      const providedLabel = args.label ? normalizeDeviceLabel(args.label) : "";
      if (providedLabel && providedLabel.length < 3) {
        throw new ConvexError({
          code: "VALIDATION_ERROR",
          message: "Nama device minimal 3 karakter.",
        });
      }
      const label = providedLabel || buildAutoDeviceLabel(codeRow._id);

      const secret = generateDeviceSecret();
      const deviceSecretHash = await hashDeviceCredential(secret);
      const deviceId = await ctx.db.insert("devices", {
        workspaceId: workspace._id,
        label,
        deviceSecretHash,
        status: "active",
        claimedFromCodeId: codeRow._id,
        claimedAt,
        createdAt: claimedAt,
        updatedAt: claimedAt,
        lastSeenAt: undefined,
        revokedAt: undefined,
        revokedByUserId: undefined,
        initialIpAddress: args.ipAddress,
        initialUserAgent: args.userAgent,
      });

      await ctx.db.patch(codeRow._id, {
        claimedAt,
        claimedByDeviceId: deviceId,
      });

      await insertAuditLog(ctx, {
        workspaceId: workspace._id,
        action: "device_registration_code.claimed",
        targetType: "device_registration_codes",
        targetId: String(codeRow._id),
        payload: {
          deviceId,
          label,
          actorType: "device-bootstrap",
          registrationCodeCreatorUserId: codeRow.createdByUserId,
        },
        createdAt: claimedAt,
      });

      await clearBootstrapAttemptContext(ctx, attemptContext);

      return {
        deviceId,
        label,
        secret,
        claimedAt,
        workspace: {
          workspaceId: workspace._id,
          name: workspace.name,
        },
      };
    } catch (error) {
      if (shouldCountBootstrapFailure(error)) {
        await recordBootstrapAttemptFailure(ctx, {
          workspaceId: resolvedWorkspaceId,
          scope: "claim_code",
          attemptContext,
        });
      }
      throw error;
    }
  },
});

export const updateDevice = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    deviceId: v.id("devices"),
    label: v.optional(v.string()),
    revoke: v.optional(v.boolean()),
  },
  returns: v.object({
    deviceId: v.id("devices"),
    label: v.string(),
    status: deviceStatusValidator,
  }),
  handler: async (ctx, args) => {
    const { user } = await requireWorkspaceRole(ctx, args.workspaceId, ["superadmin"]);
    const device = await ctx.db.get(args.deviceId);
    if (!device || device.workspaceId !== args.workspaceId) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Device tidak ditemukan.",
      });
    }

    const nextLabel =
      args.label === undefined ? device.label : normalizeDeviceLabel(args.label);
    if (!nextLabel) {
      throw new ConvexError({
        code: "VALIDATION_ERROR",
        message: "Nama device wajib diisi.",
      });
    }

    const shouldRevoke = args.revoke === true && device.status !== "revoked";
    const labelChanged = nextLabel !== device.label;
    const now = Date.now();
    if (labelChanged || shouldRevoke) {
      await ctx.db.patch(device._id, {
        label: nextLabel,
        status: shouldRevoke ? "revoked" : device.status,
        revokedAt: shouldRevoke ? now : device.revokedAt,
        revokedByUserId: shouldRevoke ? user._id : device.revokedByUserId,
        updatedAt: now,
      });
    }

    if (shouldRevoke || labelChanged) {
      await insertAuditLog(ctx, {
        actorUserId: user._id,
        workspaceId: args.workspaceId,
        action: shouldRevoke ? "device.revoked" : "device.renamed",
        targetType: "devices",
        targetId: String(device._id),
        payload: {
          label: nextLabel,
        },
        createdAt: now,
      });
    }

    return {
      deviceId: device._id,
      label: nextLabel,
      status: shouldRevoke ? "revoked" : device.status,
    };
  },
});

export const cleanupExpiredRegistrationCodes = internalMutation({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    const now = Date.now();
    const rows = await ctx.db.query("device_registration_codes").collect();
    const expiredIds = pickExpiredRegistrationCodeIds(rows, now);

    for (const codeId of expiredIds) {
      await ctx.db.delete(codeId);
    }

    return expiredIds.length;
  },
});
