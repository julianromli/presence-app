import { ConvexError, v } from 'convex/values';

import { internalMutation, mutation } from './_generated/server';
import { sha256Hex } from './helpers';
import { QR_TOKEN_ROTATION_INTERVAL_MS, QR_TOKEN_TTL_MS } from './qrPolicy';

async function issueToken(ctx, workspaceId, deviceId) {
  const issuedAt = Date.now();
  const ttlMs = QR_TOKEN_TTL_MS;
  const expiresAt = issuedAt + ttlMs;
  const nonce = crypto.randomUUID().replaceAll('-', '');
  const rawToken = crypto.randomUUID().replaceAll('-', '') + nonce;
  const tokenHash = await sha256Hex(rawToken);

  await ctx.db.insert('qr_tokens', {
    workspaceId,
    tokenHash,
    deviceId,
    issuedAt,
    expiresAt,
    usedAt: undefined,
    nonce,
  });

  return {
    token: rawToken,
    issuedAt,
    expiresAt,
    ttlMs,
    rotationIntervalMs: QR_TOKEN_ROTATION_INTERVAL_MS,
    serverTime: issuedAt,
  };
}

export const issue = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    deviceId: v.id("devices"),
  },
  returns: v.object({
    token: v.string(),
    expiresAt: v.number(),
    issuedAt: v.number(),
    ttlMs: v.number(),
    rotationIntervalMs: v.number(),
    serverTime: v.number(),
  }),
  handler: async (ctx, args) => {
    const device = await ctx.db.get(args.deviceId);
    if (!device || device.workspaceId !== args.workspaceId || device.status !== "active") {
      throw new ConvexError({
        code: "DEVICE_UNAUTHORIZED",
        message: "Unauthorized device",
      });
    }

    return await issueToken(ctx, args.workspaceId, device._id);
  },
});

export const validateAndConsume = internalMutation({
  args: {
    workspaceId: v.id("workspaces"),
    token: v.string(),
  },
  returns: v.object({
    valid: v.boolean(),
    reason: v.optional(v.string()),
    deviceId: v.optional(v.id('devices')),
  }),
  handler: async (ctx, args) => {
    const tokenHash = await sha256Hex(args.token);
    const tokenRow = await ctx.db
      .query('qr_tokens')
      .withIndex('by_workspace_token_hash', (q) =>
        q.eq('workspaceId', args.workspaceId).eq('tokenHash', tokenHash),
      )
      .unique();

    if (!tokenRow) {
      return { valid: false, reason: 'TOKEN_UNKNOWN' };
    }

    const now = Date.now();

    if (tokenRow.expiresAt < now) {
      return { valid: false, reason: 'TOKEN_EXPIRED' };
    }

    if (tokenRow.usedAt) {
      return { valid: false, reason: 'TOKEN_REPLAY' };
    }

    await ctx.db.patch(tokenRow._id, { usedAt: now });

    return {
      valid: true,
      deviceId: tokenRow.deviceId,
    };
  },
});

export const cleanupExpired = internalMutation({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    const now = Date.now();
    const rows = await ctx.db
      .query('qr_tokens')
      .filter((q) => q.lt(q.field('expiresAt'), now))
      .take(500);

    for (const row of rows) {
      await ctx.db.delete(row._id);
    }

    return rows.length;
  },
});

export const verifyTokenFormat = (token) => {
  if (typeof token !== 'string' || token.trim().length < 32) {
    throw new ConvexError({ code: 'INVALID_TOKEN_FORMAT', message: 'Malformed token' });
  }
};
