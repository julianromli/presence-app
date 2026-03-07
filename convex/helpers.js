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

export async function requireIdentityUser(ctx) {
  return await getCurrentDbUser(ctx);
}

export async function requireRole(ctx, allowedRoles) {
  const user = await getCurrentDbUser(ctx);
  if (!allowedRoles.includes(user.role)) {
    throw new ConvexError({ code: 'FORBIDDEN', message: 'Role not allowed' });
  }
  return user;
}

export async function requireWorkspaceMember(ctx, workspaceId) {
  const user = await requireIdentityUser(ctx);
  const membership = await ctx.db
    .query('workspace_members')
    .withIndex('by_workspace_and_user', (q) => q.eq('workspaceId', workspaceId).eq('userId', user._id))
    .unique();

  if (!membership || !membership.isActive) {
    throw new ConvexError({ code: 'FORBIDDEN', message: 'Workspace membership required' });
  }

  return { user, membership };
}

export async function requireWorkspaceRole(ctx, workspaceId, allowedRoles) {
  const { user, membership } = await requireWorkspaceMember(ctx, workspaceId);
  if (!allowedRoles.includes(membership.role)) {
    throw new ConvexError({ code: 'FORBIDDEN', message: 'Workspace role not allowed' });
  }
  return { user, membership };
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

function buildDefaultGlobalSettings(now = Date.now(), workspaceId) {
  return {
    key: 'global',
    workspaceId,
    timezone: 'Asia/Jakarta',
    geofenceEnabled: false,
    geofenceRadiusMeters: 100,
    scanCooldownSeconds: 30,
    minLocationAccuracyMeters: 100,
    enforceDeviceHeartbeat: false,
    geofenceLat: undefined,
    geofenceLng: undefined,
    whitelistEnabled: false,
    whitelistIps: [],
    updatedBy: undefined,
    updatedAt: now,
  };
}

export async function getGlobalSettingsOrNull(ctx, workspaceId) {
  return await ctx.db
    .query('settings')
    .withIndex('by_workspace', (q) => q.eq('workspaceId', workspaceId))
    .unique();
}

export async function getGlobalSettingsOrThrow(ctx, workspaceId) {
  const existing = await getGlobalSettingsOrNull(ctx, workspaceId);
  if (existing) {
    return existing;
  }

  throw new ConvexError({
    code: 'SETTINGS_NOT_INITIALIZED',
    message: 'Global settings belum diinisialisasi.',
  });
}

export async function ensureGlobalSettingsForMutation(ctx, workspaceId) {
  const existing = await getGlobalSettingsOrNull(ctx, workspaceId);
  if (existing) {
    const patch = {};

    if (existing.scanCooldownSeconds === undefined) {
      patch.scanCooldownSeconds = 30;
    }
    if (existing.minLocationAccuracyMeters === undefined) {
      patch.minLocationAccuracyMeters = 100;
    }
    if (existing.enforceDeviceHeartbeat === undefined) {
      patch.enforceDeviceHeartbeat = false;
    }

    if (Object.keys(patch).length > 0) {
      await ctx.db.patch(existing._id, patch);
      const updated = await ctx.db.get(existing._id);
      if (updated) {
        return updated;
      }
    }

    return existing;
  }

  const _id = await ctx.db.insert('settings', buildDefaultGlobalSettings(Date.now(), workspaceId));
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
  const normalized = ip.trim().toLowerCase();
  return whitelistIps.map((item) => item.trim().toLowerCase()).includes(normalized);
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

export async function sha256Hex(input) {
  const bytes = new TextEncoder().encode(input);
  const hashBuffer = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(hashBuffer))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}
