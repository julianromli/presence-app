import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

const role = v.union(
  v.literal("superadmin"),
  v.literal("admin"),
  v.literal("karyawan"),
  v.literal("device-qr"),
);

const roleBucket = v.object({
  total: v.number(),
  active: v.number(),
});

const legacyCompatibleSourceDeviceId = v.union(
  v.id("devices"),
  v.id("users"),
);

const notificationType = v.union(
  v.literal("attendance_success"),
  v.literal("attendance_failure"),
  v.literal("attendance_reminder"),
  v.literal("workspace_announcement"),
);

const notificationSeverity = v.union(
  v.literal("info"),
  v.literal("success"),
  v.literal("warning"),
  v.literal("critical"),
);

const notificationActionType = v.union(
  v.literal("open_scan"),
  v.literal("open_history"),
  v.literal("open_history_day"),
  v.literal("none"),
);

const attendanceScheduleDay = v.union(
  v.literal("monday"),
  v.literal("tuesday"),
  v.literal("wednesday"),
  v.literal("thursday"),
  v.literal("friday"),
  v.literal("saturday"),
  v.literal("sunday"),
);

const attendanceScheduleRow = v.object({
  day: attendanceScheduleDay,
  enabled: v.boolean(),
  checkInTime: v.optional(v.string()),
});

export default defineSchema({
  workspaces: defineTable({
    slug: v.string(),
    name: v.string(),
    isActive: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
    createdByUserId: v.optional(v.id("users")),
  }).index("by_slug", ["slug"]),

  workspace_members: defineTable({
    workspaceId: v.id("workspaces"),
    userId: v.id("users"),
    role,
    isActive: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_workspace_and_user", ["workspaceId", "userId"])
    .index("by_user_and_workspace", ["userId", "workspaceId"])
    .index("by_workspace_role_active", ["workspaceId", "role", "isActive"]),

  workspace_invite_codes: defineTable({
    workspaceId: v.id("workspaces"),
    code: v.string(),
    isActive: v.boolean(),
    expiresAt: v.optional(v.number()),
    createdByUserId: v.id("users"),
    createdAt: v.number(),
    updatedAt: v.number(),
    lastRotatedAt: v.optional(v.number()),
  })
    .index("by_code", ["code"])
    .index("by_workspace", ["workspaceId"]),

  users: defineTable({
    clerkUserId: v.string(),
    name: v.string(),
    email: v.string(),
    role,
    isActive: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_clerk_user_id", ["clerkUserId"])
    .index("by_role_and_active", ["role", "isActive"])
    .index("by_active", ["isActive"]),

  users_metrics: defineTable({
    key: v.literal("global"),
    workspaceId: v.optional(v.id("workspaces")),
    total: v.number(),
    active: v.number(),
    inactive: v.number(),
    byRole: v.record(v.string(), roleBucket),
    updatedAt: v.number(),
  })
    .index("by_key", ["key"])
    .index("by_workspace", ["workspaceId"]),

  attendance: defineTable({
    workspaceId: v.optional(v.id("workspaces")),
    userId: v.id("users"),
    dateKey: v.string(),
    checkInAt: v.optional(v.number()),
    checkOutAt: v.optional(v.number()),
    checkInMeta: v.optional(
      v.object({
        ipAddress: v.optional(v.string()),
        latitude: v.optional(v.number()),
        longitude: v.optional(v.number()),
        accuracyMeters: v.optional(v.number()),
        scannedAt: v.number(),
        sourceDeviceId: v.optional(legacyCompatibleSourceDeviceId),
      }),
    ),
    checkOutMeta: v.optional(
      v.object({
        ipAddress: v.optional(v.string()),
        latitude: v.optional(v.number()),
        longitude: v.optional(v.number()),
        accuracyMeters: v.optional(v.number()),
        scannedAt: v.number(),
        sourceDeviceId: v.optional(legacyCompatibleSourceDeviceId),
      }),
    ),
    sourceDeviceId: v.optional(legacyCompatibleSourceDeviceId),
    edited: v.boolean(),
    editedBy: v.optional(v.id("users")),
    editedAt: v.optional(v.number()),
    editReason: v.optional(v.string()),
    lastScanAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user_and_date", ["userId", "dateKey"])
    .index("by_date_and_user", ["dateKey", "userId"])
    .index("by_date_and_edited", ["dateKey", "edited"])
    .index("by_workspace_and_date_user", ["workspaceId", "dateKey", "userId"])
    .index("by_workspace_user_date", ["workspaceId", "userId", "dateKey"]),

  settings: defineTable({
    key: v.literal("global"),
    workspaceId: v.optional(v.id("workspaces")),
    timezone: v.string(),
    geofenceEnabled: v.boolean(),
    geofenceRadiusMeters: v.number(),
    scanCooldownSeconds: v.optional(v.number()),
    minLocationAccuracyMeters: v.optional(v.number()),
    enforceDeviceHeartbeat: v.optional(v.boolean()),
    geofenceLat: v.optional(v.number()),
    geofenceLng: v.optional(v.number()),
    whitelistEnabled: v.boolean(),
    whitelistIps: v.array(v.string()),
    attendanceSchedule: v.array(attendanceScheduleRow),
    updatedBy: v.optional(v.id("users")),
    updatedAt: v.number(),
  })
    .index("by_key", ["key"])
    .index("by_workspace", ["workspaceId"]),

  device_registration_codes: defineTable({
    workspaceId: v.id("workspaces"),
    codeHash: v.string(),
    createdByUserId: v.id("users"),
    createdAt: v.number(),
    expiresAt: v.number(),
    claimedAt: v.optional(v.number()),
    claimedByDeviceId: v.optional(v.id("devices")),
    revokedAt: v.optional(v.number()),
  })
    .index("by_workspace_code_hash", ["workspaceId", "codeHash"])
    .index("by_workspace_expires_at", ["workspaceId", "expiresAt"]),

  devices: defineTable({
    workspaceId: v.id("workspaces"),
    label: v.string(),
    deviceSecretHash: v.string(),
    status: v.union(v.literal("active"), v.literal("revoked")),
    claimedFromCodeId: v.id("device_registration_codes"),
    claimedAt: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
    lastSeenAt: v.optional(v.number()),
    revokedAt: v.optional(v.number()),
    revokedByUserId: v.optional(v.id("users")),
    initialIpAddress: v.optional(v.string()),
    initialUserAgent: v.optional(v.string()),
  })
    .index("by_workspace_status", ["workspaceId", "status"])
    .index("by_workspace_device_secret_hash", ["workspaceId", "deviceSecretHash"]),

  qr_tokens: defineTable({
    workspaceId: v.optional(v.id("workspaces")),
    tokenHash: v.string(),
    deviceId: v.optional(v.id("devices")),
    deviceUserId: v.optional(v.id("users")),
    issuedAt: v.number(),
    expiresAt: v.number(),
    usedAt: v.optional(v.number()),
    nonce: v.string(),
  })
    .index("by_token_hash", ["tokenHash"])
    .index("by_device_and_expiry", ["deviceId", "expiresAt"])
    .index("by_workspace_token_hash", ["workspaceId", "tokenHash"]),

  device_heartbeats: defineTable({
    workspaceId: v.optional(v.id("workspaces")),
    deviceId: v.optional(v.id("devices")),
    deviceUserId: v.optional(v.id("users")),
    lastSeenAt: v.number(),
    ipAddress: v.optional(v.string()),
    userAgent: v.optional(v.string()),
    updatedAt: v.number(),
  })
    .index("by_device_id", ["deviceId"])
    .index("by_last_seen_at", ["lastSeenAt"])
    .index("by_workspace_device_id", ["workspaceId", "deviceId"]),

  scan_events: defineTable({
    workspaceId: v.optional(v.id("workspaces")),
    actorUserId: v.id("users"),
    deviceId: v.optional(v.id("devices")),
    deviceUserId: v.optional(v.id("users")),
    dateKey: v.string(),
    resultStatus: v.union(v.literal("accepted"), v.literal("rejected")),
    reasonCode: v.string(),
    attendanceStatus: v.optional(
      v.union(v.literal("check-in"), v.literal("check-out")),
    ),
    message: v.optional(v.string()),
    ipAddress: v.optional(v.string()),
    latitude: v.optional(v.number()),
    longitude: v.optional(v.number()),
    accuracyMeters: v.optional(v.number()),
    idempotencyKey: v.string(),
    scannedAt: v.number(),
    createdAt: v.number(),
  })
    .index("by_actor_and_scanned_at", ["actorUserId", "scannedAt"])
    .index("by_actor_and_idempotency", ["actorUserId", "idempotencyKey"])
    .index("by_date_and_status", ["dateKey", "resultStatus"])
    .index("by_reason_and_scanned_at", ["reasonCode", "scannedAt"])
    .index("by_workspace_date_status", ["workspaceId", "dateKey", "resultStatus"]),

  employee_notifications: defineTable({
    workspaceId: v.id("workspaces"),
    userId: v.id("users"),
    type: notificationType,
    title: v.string(),
    description: v.string(),
    severity: notificationSeverity,
    createdAt: v.number(),
    readAt: v.optional(v.number()),
    actionType: notificationActionType,
    actionPayload: v.optional(
      v.object({
        dateKey: v.optional(v.string()),
      }),
    ),
    sourceKey: v.string(),
    workspaceScopedSourceKey: v.optional(v.string()),
    expiresAt: v.optional(v.number()),
    metadata: v.optional(
      v.object({
        attendanceStatus: v.optional(
          v.union(v.literal("check-in"), v.literal("check-out")),
        ),
        reasonCode: v.optional(v.string()),
      }),
    ),
  })
    .index("by_user_workspace_created_at", ["userId", "workspaceId", "createdAt"])
    .index("by_user_workspace_read_at", ["userId", "workspaceId", "readAt"])
    .index("by_source_key", ["sourceKey"])
    .index("by_workspace_scoped_source_key", ["workspaceScopedSourceKey"]),

  audit_logs: defineTable({
    workspaceId: v.optional(v.id("workspaces")),
    actorUserId: v.optional(v.id("users")),
    action: v.string(),
    targetType: v.string(),
    targetId: v.string(),
    payload: v.optional(v.any()),
    createdAt: v.number(),
  })
    .index("by_actor_and_created", ["actorUserId", "createdAt"])
    .index("by_target_and_created", ["targetType", "createdAt"])
    .index("by_workspace_created", ["workspaceId", "createdAt"]),

  weekly_reports: defineTable({
    workspaceId: v.optional(v.id("workspaces")),
    weekKey: v.string(),
    startDate: v.string(),
    endDate: v.string(),
    fileUrl: v.optional(v.string()),
    storageId: v.optional(v.id("_storage")),
    fileName: v.optional(v.string()),
    mimeType: v.optional(v.string()),
    byteLength: v.optional(v.number()),
    status: v.union(
      v.literal("pending"),
      v.literal("success"),
      v.literal("failed"),
    ),
    generatedAt: v.optional(v.number()),
    errorMessage: v.optional(v.string()),
    startedAt: v.optional(v.number()),
    finishedAt: v.optional(v.number()),
    durationMs: v.optional(v.number()),
    triggerSource: v.optional(v.union(v.literal("manual"), v.literal("cron"))),
    triggeredBy: v.optional(v.id("users")),
    lastTriggeredAt: v.optional(v.number()),
    attempts: v.optional(v.number()),
  })
    .index("by_week_key", ["weekKey"])
    .index("by_workspace_week_key", ["workspaceId", "weekKey"]),
});
