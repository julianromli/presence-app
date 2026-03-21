import {
  getConvexTokenOrNull,
  requireWorkspaceRoleApiFromDb,
  requireWorkspaceApiContext,
} from "@/lib/auth";
import { convexErrorResponse } from "@/lib/api-error";
import { getAuthedConvexHttpClient } from "@/lib/convex-http";
import { enforceWorkspaceRestriction } from "@/lib/workspace-restriction-guard";
import { isValidTimeZone, normalizeTimeZone } from "@/lib/timezones";

type AttendanceScheduleDay =
  | "monday"
  | "tuesday"
  | "wednesday"
  | "thursday"
  | "friday"
  | "saturday"
  | "sunday";

type AttendanceScheduleRow = {
  day: AttendanceScheduleDay;
  enabled: boolean;
  checkInTime?: string;
};

const ATTENDANCE_SCHEDULE_DAYS: AttendanceScheduleDay[] = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
];

function isValidClock(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{2}:\d{2}$/.test(value)) {
    return false;
  }

  const [hourText, minuteText] = value.split(":");
  const hour = Number(hourText);
  const minute = Number(minuteText);
  return hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59;
}

function isValidAttendanceSchedule(
  value: unknown,
): value is AttendanceScheduleRow[] {
  if (!Array.isArray(value) || value.length !== ATTENDANCE_SCHEDULE_DAYS.length) {
    return false;
  }

  const seen = new Set<AttendanceScheduleDay>();
  for (const row of value) {
    if (
      !row ||
      typeof row !== "object" ||
      !("day" in row) ||
      !("enabled" in row) ||
      !ATTENDANCE_SCHEDULE_DAYS.includes(row.day as AttendanceScheduleDay) ||
      typeof row.enabled !== "boolean" ||
      seen.has(row.day as AttendanceScheduleDay)
    ) {
      return false;
    }

    seen.add(row.day as AttendanceScheduleDay);

    if (
      (row.enabled && !isValidClock("checkInTime" in row ? row.checkInTime : undefined)) ||
      ("checkInTime" in row && row.checkInTime !== undefined && !isValidClock(row.checkInTime))
    ) {
      return false;
    }
  }

  return seen.size === ATTENDANCE_SCHEDULE_DAYS.length;
}

export async function GET(req: Request) {
  const workspaceContext = requireWorkspaceApiContext(req);
  if ("error" in workspaceContext) return workspaceContext.error;
  const workspaceId = workspaceContext.workspace.workspaceId;

  const role = await requireWorkspaceRoleApiFromDb(
    ["superadmin"],
    workspaceContext.workspace.workspaceId,
  );
  if ("error" in role) return role.error;

  const token = await getConvexTokenOrNull();
  if (!token) {
    return Response.json(
      { code: "UNAUTHENTICATED", message: "Unauthorized" },
      { status: 401 },
    );
  }

  const convex = getAuthedConvexHttpClient(token);
  if (!convex)
    return Response.json(
      { code: "INTERNAL_ERROR", message: "Convex URL missing" },
      { status: 500 },
    );

  const restrictionResponse = await enforceWorkspaceRestriction(
    convex,
    workspaceId,
    role.session.role,
    "dashboard_overview",
  );
  if (restrictionResponse) return restrictionResponse;

  try {
    await convex.mutation("settings:ensureGlobal", { workspaceId });
    const data = await convex.query("settings:get", { workspaceId });
    return Response.json(data);
  } catch (error) {
    return convexErrorResponse(error, "Gagal memuat settings.");
  }
}

export async function PATCH(req: Request) {
  const workspaceContext = requireWorkspaceApiContext(req);
  if ("error" in workspaceContext) return workspaceContext.error;
  const workspaceId = workspaceContext.workspace.workspaceId;

  const role = await requireWorkspaceRoleApiFromDb(
    ["superadmin"],
    workspaceContext.workspace.workspaceId,
  );
  if ("error" in role) return role.error;

  const token = await getConvexTokenOrNull();
  if (!token) {
    return Response.json(
      { code: "UNAUTHENTICATED", message: "Unauthorized" },
      { status: 401 },
    );
  }

  let body: {
    timezone?: string;
    geofenceEnabled?: boolean;
    geofenceRadiusMeters?: number;
    scanCooldownSeconds?: number;
    minLocationAccuracyMeters?: number;
    enforceDeviceHeartbeat?: boolean;
    geofenceLat?: number;
    geofenceLng?: number;
    whitelistEnabled?: boolean;
    whitelistIps?: string[];
    attendanceSchedule?: AttendanceScheduleRow[];
  };
  try {
    body = await req.json();
  } catch {
    return Response.json(
      { code: "BAD_REQUEST", message: "Payload JSON tidak valid." },
      { status: 400 },
    );
  }

  if (
    body.attendanceSchedule !== undefined &&
    !isValidAttendanceSchedule(body.attendanceSchedule)
  ) {
    return Response.json(
      { code: "BAD_REQUEST", message: "Attendance schedule tidak valid." },
      { status: 400 },
    );
  }

  if (body.timezone !== undefined && !isValidTimeZone(body.timezone)) {
    return Response.json(
      { code: "BAD_REQUEST", message: "Timezone tidak valid." },
      { status: 400 },
    );
  }

  const timezone =
    body.timezone === undefined ? undefined : normalizeTimeZone(body.timezone);

  const convex = getAuthedConvexHttpClient(token);
  if (!convex)
    return Response.json(
      { code: "INTERNAL_ERROR", message: "Convex URL missing" },
      { status: 500 },
    );

  const restrictionResponse = await enforceWorkspaceRestriction(
    convex,
    workspaceId,
    role.session.role,
    "dashboard_overview",
  );
  if (restrictionResponse) return restrictionResponse;

  try {
    await convex.mutation("settings:update", {
      workspaceId,
      timezone,
      geofenceEnabled: body.geofenceEnabled,
      geofenceRadiusMeters: body.geofenceRadiusMeters,
      scanCooldownSeconds: body.scanCooldownSeconds,
      minLocationAccuracyMeters: body.minLocationAccuracyMeters,
      enforceDeviceHeartbeat: body.enforceDeviceHeartbeat,
      geofenceLat: body.geofenceLat,
      geofenceLng: body.geofenceLng,
      whitelistEnabled: body.whitelistEnabled,
      whitelistIps: body.whitelistIps,
      attendanceSchedule: body.attendanceSchedule,
    });

    return Response.json({ ok: true });
  } catch (error) {
    return convexErrorResponse(error, "Gagal menyimpan settings.");
  }
}

