import { ConvexError } from 'convex/values';

export async function requireIdentity(ctx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new ConvexError({ code: 'UNAUTHENTICATED', message: 'Login required' });
  }
  return identity;
}

export async function getCurrentDbUser(ctx) {
  const identity = await requireIdentity(ctx);
  const user = await ctx.db
    .query('users')
    .withIndex('by_clerk_user_id', (q) => q.eq('clerkUserId', identity.subject))
    .unique();

  if (!user) {
    throw new ConvexError({ code: 'USER_NOT_FOUND', message: 'User row missing' });
  }
  if (!user.isActive) {
    throw new ConvexError({ code: 'INACTIVE_USER', message: 'User is inactive' });
  }

  return user;
}
export async function requireRole(ctx, allowedRoles) {
  const user = await getCurrentDbUser(ctx);
  if (!allowedRoles.includes(user.role)) {
    throw new ConvexError({ code: 'FORBIDDEN', message: 'Role not allowed' });
  }
  return user;
}

export function buildDateKey(ts, timezone) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(new Date(ts));
}

function buildDefaultGlobalSettings(now = Date.now()) {
  return {
    key: 'global',
    timezone: 'Asia/Jakarta',
    geofenceEnabled: false,
    geofenceRadiusMeters: 100,
    geofenceLat: undefined,
    geofenceLng: undefined,
    whitelistEnabled: false,
    whitelistIps: [],
    updatedBy: undefined,
    updatedAt: now,
  };
}

export async function getGlobalSettingsOrNull(ctx) {
  return await ctx.db
    .query('settings')
    .withIndex('by_key', (q) => q.eq('key', 'global'))
    .unique();
}

export async function getGlobalSettingsOrThrow(ctx) {
  const existing = await getGlobalSettingsOrNull(ctx);
  if (existing) {
    return existing;
  }

  throw new ConvexError({
    code: 'SETTINGS_NOT_INITIALIZED',
    message: 'Global settings belum diinisialisasi.',
  });
}

export async function ensureGlobalSettingsForMutation(ctx) {
  const existing = await getGlobalSettingsOrNull(ctx);
  if (existing) {
    return existing;
  }

  const _id = await ctx.db.insert('settings', buildDefaultGlobalSettings());
  const created = await ctx.db.get(_id);
  if (!created) {
    throw new ConvexError({
      code: 'INTERNAL_ERROR',
      message: 'Gagal membuat global settings.',
    });
  }
  return created;
}

export function ipAllowed(ip, whitelistIps) {
  if (!ip) return false;
  return whitelistIps.includes(ip);
}

export function distanceMeters(lat1, lng1, lat2, lng2) {
  const toRad = (n) => (n * Math.PI) / 180;
  const earthRadius = 6371000;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadius * c;
}
