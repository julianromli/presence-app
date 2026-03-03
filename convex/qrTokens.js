import { ConvexError, v } from 'convex/values';

import { internalMutation, mutation } from './_generated/server';
import { requireRole } from './helpers';

async function sha256Hex(input) {
  const bytes = new TextEncoder().encode(input);
  const hashBuffer = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

async function issueToken(ctx, deviceUserId) {
  const issuedAt = Date.now();
  const ttlMs = 20000;
  const expiresAt = issuedAt + ttlMs;
  const nonce = crypto.randomUUID().replaceAll('-', '');
  const rawToken = crypto.randomUUID().replaceAll('-', '') + nonce;
  const tokenHash = await sha256Hex(rawToken);

  await ctx.db.insert('qr_tokens', {
    tokenHash,
    deviceUserId,
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
    serverTime: issuedAt,
  };
}

export const issue = mutation({
  args: {},
  returns: v.object({
    token: v.string(),
    expiresAt: v.number(),
    issuedAt: v.number(),
    ttlMs: v.number(),
    serverTime: v.number(),
  }),
  handler: async (ctx) => {
    const deviceUser = await requireRole(ctx, ['device-qr']);
    return await issueToken(ctx, deviceUser._id);
  },
});

export const validateAndConsume = internalMutation({
  args: {
    token: v.string(),
  },
  returns: v.object({
    valid: v.boolean(),
    reason: v.optional(v.string()),
    deviceUserId: v.optional(v.id('users')),
  }),
  handler: async (ctx, args) => {
    const tokenHash = await sha256Hex(args.token);
    const tokenRow = await ctx.db
      .query('qr_tokens')
      .withIndex('by_token_hash', (q) => q.eq('tokenHash', tokenHash))
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
      deviceUserId: tokenRow.deviceUserId,
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
