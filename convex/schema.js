import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';

const role = v.union(
  v.literal('superadmin'),
  v.literal('admin'),
  v.literal('karyawan'),
  v.literal('device-qr'),
);

export default defineSchema({
  users: defineTable({
    clerkUserId: v.string(),
    name: v.string(),
    email: v.string(),
    role,
    isActive: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_clerk_user_id', ['clerkUserId'])
    .index('by_role_and_active', ['role', 'isActive']),

  attendance: defineTable({
    userId: v.id('users'),
    dateKey: v.string(),
    checkInAt: v.optional(v.number()),
    checkOutAt: v.optional(v.number()),
    sourceDeviceId: v.optional(v.id('users')),
    edited: v.boolean(),
    editedBy: v.optional(v.id('users')),
    editedAt: v.optional(v.number()),
    editReason: v.optional(v.string()),
    lastScanAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_user_and_date', ['userId', 'dateKey'])
    .index('by_date_and_user', ['dateKey', 'userId'])
    .index('by_date_and_edited', ['dateKey', 'edited']),

  settings: defineTable({
    key: v.literal('global'),
    timezone: v.string(),
    geofenceEnabled: v.boolean(),
    geofenceRadiusMeters: v.number(),
    geofenceLat: v.optional(v.number()),
    geofenceLng: v.optional(v.number()),
    whitelistEnabled: v.boolean(),
    whitelistIps: v.array(v.string()),
    updatedBy: v.optional(v.id('users')),
    updatedAt: v.number(),
  }).index('by_key', ['key']),

  qr_tokens: defineTable({
    tokenHash: v.string(),
    deviceUserId: v.id('users'),
    issuedAt: v.number(),
    expiresAt: v.number(),
    usedAt: v.optional(v.number()),
    nonce: v.string(),
  })
    .index('by_token_hash', ['tokenHash'])
    .index('by_device_and_expiry', ['deviceUserId', 'expiresAt']),

  audit_logs: defineTable({
    actorUserId: v.id('users'),
    action: v.string(),
    targetType: v.string(),
    targetId: v.string(),
    payload: v.optional(v.any()),
    createdAt: v.number(),
  })
    .index('by_actor_and_created', ['actorUserId', 'createdAt'])
    .index('by_target_and_created', ['targetType', 'createdAt']),

  weekly_reports: defineTable({
    weekKey: v.string(),
    startDate: v.string(),
    endDate: v.string(),
    fileUrl: v.optional(v.string()),
    status: v.union(
      v.literal('pending'),
      v.literal('success'),
      v.literal('failed'),
    ),
    generatedAt: v.optional(v.number()),
    errorMessage: v.optional(v.string()),
  }).index('by_week_key', ['weekKey']),
});
