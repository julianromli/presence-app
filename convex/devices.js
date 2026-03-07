import { ConvexError, v } from "convex/values";

import { internalMutation, mutation, query } from "./_generated/server";
import { requireWorkspaceRole, sha256Hex } from "./helpers";

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
});

const authenticatedDeviceValidator = v.object({
  deviceId: v.id("devices"),
  label: v.string(),
  claimedAt: v.number(),
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

async function getRegistrationCodeByHash(ctx, workspaceId, normalizedCode) {
  const codeHash = await hashDeviceCredential(normalizedCode);
  return await ctx.db
    .query("device_registration_codes")
    .withIndex("by_workspace_code_hash", (q) =>
      q.eq("workspaceId", workspaceId).eq("codeHash", codeHash),
    )
    .unique();
}

async function insertAuditLog(ctx, entry) {
  await ctx.db.insert("audit_logs", entry);
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

export const validateRegistrationCodePreview = query({
  args: {
    workspaceId: v.id("workspaces"),
    code: v.string(),
  },
  returns: registrationCodePreviewValidator,
  handler: async (ctx, args) => {
    const normalizedCode = normalizeRegistrationCode(args.code);
    if (!normalizedCode) {
      return { ok: false };
    }

    const row = await getRegistrationCodeByHash(ctx, args.workspaceId, normalizedCode);
    if (!row) {
      return { ok: false };
    }

    const status = deriveRegistrationCodeStatus(row, Date.now());
    if (status !== "pending") {
      return { ok: false, status };
    }

    return {
      ok: true,
      status,
      expiresAt: row.expiresAt,
    };
  },
});

export const authenticateDevice = query({
  args: {
    workspaceId: v.id("workspaces"),
    deviceId: v.id("devices"),
    secret: v.string(),
  },
  returns: v.union(v.null(), authenticatedDeviceValidator),
  handler: async (ctx, args) => {
    const device = await ctx.db.get(args.deviceId);
    if (!device || device.workspaceId !== args.workspaceId || device.status !== "active") {
      return null;
    }

    const secretHash = await hashDeviceCredential(args.secret);
    if (device.deviceSecretHash !== secretHash) {
      return null;
    }

    return {
      deviceId: device._id,
      label: device.label,
      claimedAt: device.claimedAt,
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
    workspaceId: v.id("workspaces"),
    code: v.string(),
    label: v.string(),
    ipAddress: v.optional(v.string()),
    userAgent: v.optional(v.string()),
  },
  returns: claimResultValidator,
  handler: async (ctx, args) => {
    const normalizedCode = normalizeRegistrationCode(args.code);
    if (!normalizedCode) {
      throw new ConvexError({
        code: "VALIDATION_ERROR",
        message: "Kode registrasi wajib diisi.",
      });
    }

    const label = normalizeDeviceLabel(args.label);
    if (label.length < 3) {
      throw new ConvexError({
        code: "VALIDATION_ERROR",
        message: "Nama device minimal 3 karakter.",
      });
    }

    const codeRow = await getRegistrationCodeByHash(ctx, args.workspaceId, normalizedCode);
    if (!codeRow) {
      throw new ConvexError({
        code: "REGISTRATION_CODE_INVALID",
        message: "Kode registrasi tidak valid.",
      });
    }

    const claimedAt = Date.now();
    assertRegistrationCodeClaimable(codeRow, claimedAt);

    const secret = generateDeviceSecret();
    const deviceSecretHash = await hashDeviceCredential(secret);
    const deviceId = await ctx.db.insert("devices", {
      workspaceId: args.workspaceId,
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
      workspaceId: args.workspaceId,
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

    return {
      deviceId,
      label,
      secret,
      claimedAt,
    };
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

    const shouldRevoke = args.revoke === true;
    const now = Date.now();
    await ctx.db.patch(device._id, {
      label: nextLabel,
      status: shouldRevoke ? "revoked" : device.status,
      revokedAt: shouldRevoke ? now : device.revokedAt,
      revokedByUserId: shouldRevoke ? user._id : device.revokedByUserId,
      updatedAt: now,
    });

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
