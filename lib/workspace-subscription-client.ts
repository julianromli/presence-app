"use client";

import { useSyncExternalStore } from "react";

import {
  normalizeClientError,
  parseApiErrorResponse,
  type ApiErrorInfo,
} from "@/lib/client-error";
import {
  recoverWorkspaceScopeViolation,
  workspaceFetch,
} from "@/lib/workspace-client";
import type {
  WorkspacePlan,
  WorkspaceRestrictedExpiredStatePayload,
  WorkspaceSubscriptionSummary,
} from "@/types/dashboard";

type CurrentWorkspaceSubscriptionPayload = {
  workspaceId: string;
  subscription: WorkspaceSubscriptionSummary;
};

export type WorkspaceSubscriptionClientState = {
  workspaceId: string | null;
  subscription: WorkspaceSubscriptionSummary | null;
  loading: boolean;
  ready: boolean;
  error: ApiErrorInfo | null;
};

type WorkspaceSubscriptionListener = (
  snapshot: WorkspaceSubscriptionClientState,
) => void;

const PLAN_BADGE_TEXT: Record<WorkspacePlan, string> = {
  free: "Free",
  pro: "Pro",
  enterprise: "Enterprise",
};

let workspaceSubscriptionSnapshot: WorkspaceSubscriptionClientState = {
  workspaceId: null,
  subscription: null,
  loading: false,
  ready: false,
  error: null,
};

const workspaceSubscriptionListeners = new Set<WorkspaceSubscriptionListener>();

let workspaceSubscriptionRefreshPromise:
  | Promise<WorkspaceSubscriptionClientState>
  | null = null;
let workspaceSubscriptionInitialized = false;

function emitWorkspaceSubscriptionSnapshot() {
  for (const listener of workspaceSubscriptionListeners) {
    listener(workspaceSubscriptionSnapshot);
  }
}

function setWorkspaceSubscriptionSnapshot(
  nextSnapshot: WorkspaceSubscriptionClientState,
) {
  workspaceSubscriptionSnapshot = nextSnapshot;
  emitWorkspaceSubscriptionSnapshot();
}

function subscribeWorkspaceSubscription(listener: WorkspaceSubscriptionListener) {
  ensureWorkspaceSubscriptionInitialized();
  workspaceSubscriptionListeners.add(listener);
  return () => {
    workspaceSubscriptionListeners.delete(listener);
  };
}

function getWorkspaceSubscriptionSnapshot() {
  return workspaceSubscriptionSnapshot;
}

function handleWorkspaceSubscriptionRefreshEvent() {
  void refreshWorkspaceSubscription();
}

function ensureWorkspaceSubscriptionInitialized() {
  if (workspaceSubscriptionInitialized || typeof window === "undefined") {
    return;
  }

  workspaceSubscriptionInitialized = true;
  window.addEventListener(
    "workspace:changed",
    handleWorkspaceSubscriptionRefreshEvent as EventListener,
  );
  window.addEventListener(
    "dashboard:refresh",
    handleWorkspaceSubscriptionRefreshEvent as EventListener,
  );

  void refreshWorkspaceSubscription();
}

export function getWorkspacePlanBadgeText(plan: WorkspacePlan) {
  return PLAN_BADGE_TEXT[plan];
}

export function formatWorkspaceMemberUsageCopy(
  activeMembers: number,
  maxMembersPerWorkspace: number | null,
) {
  if (maxMembersPerWorkspace === null) {
    return `${activeMembers} member aktif`;
  }

  return `${activeMembers} / ${maxMembersPerWorkspace} member aktif`;
}

export function formatWorkspaceDeviceUsageCopy(
  activeDevices: number,
  maxDevicesPerWorkspace: number | null,
) {
  if (maxDevicesPerWorkspace === null) {
    return `${activeDevices} device aktif`;
  }

  return `${activeDevices} / ${maxDevicesPerWorkspace} device aktif`;
}

export function hasReachedWorkspaceDeviceLimit(
  activeDevices: number,
  maxDevicesPerWorkspace: number | null,
) {
  return maxDevicesPerWorkspace !== null && activeDevices >= maxDevicesPerWorkspace;
}

export function buildDeviceLimitNoticeCopy(
  activeDevices: number,
  maxDevicesPerWorkspace: number | null,
) {
  if (!hasReachedWorkspaceDeviceLimit(activeDevices, maxDevicesPerWorkspace)) {
    return null;
  }

  return "Plan workspace ini sudah mencapai batas device aktif";
}

export function isReportExportDisabled(
  subscription: WorkspaceSubscriptionSummary | null,
) {
  return subscription?.features.reportExport === false;
}

export function getReportExportUpgradeCopy(
  subscription: WorkspaceSubscriptionSummary | null,
) {
  if (!isReportExportDisabled(subscription)) {
    return null;
  }

  return "Unduh report termasuk fitur Pro.";
}

export function getGeofencePremiumBannerCopy(
  subscription: WorkspaceSubscriptionSummary | null,
) {
  if (subscription?.features.geofence !== false) {
    return null;
  }

  return "Fitur geofence dan whitelist IP tersedia di paket Pro.";
}

export function isAttendanceScheduleSaveDisabled(
  subscription: WorkspaceSubscriptionSummary | null,
) {
  return subscription?.features.attendanceSchedule === false;
}

export function getAttendanceScheduleUpgradeCopy(
  subscription: WorkspaceSubscriptionSummary | null,
) {
  if (!isAttendanceScheduleSaveDisabled(subscription)) {
    return null;
  }

  return "Pro: upgrade untuk mengatur jadwal jam masuk workspace.";
}

export function formatWorkspaceBillingPeriod(
  startsAt?: number,
  endsAt?: number,
) {
  if (!startsAt || !endsAt) {
    return "Belum ada periode aktif";
  }

  const formatter = new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  return `${formatter.format(startsAt)} - ${formatter.format(endsAt)}`;
}

type RestrictedWorkspaceOverlayCopyArgs = Pick<
  WorkspaceRestrictedExpiredStatePayload,
  | "activeDevices"
  | "activeMembers"
  | "canManageRecovery"
  | "overFreeDeviceLimit"
  | "overFreeMemberLimit"
>;

export function getRestrictedWorkspaceOverlayCopy({
  canManageRecovery,
}: RestrictedWorkspaceOverlayCopyArgs) {
  return {
    title: "Akses dashboard dibatasi sementara",
    memberTargetLabel: "Target member: 5 aktif atau kurang",
    deviceTargetLabel: "Target device: 1 aktif atau kurang",
    actionLabel: canManageRecovery
      ? "Kurangi member/device atau aktifkan Pro lagi."
      : "Hubungi superadmin untuk menormalkan workspace ini.",
  };
}

export async function refreshWorkspaceSubscription() {
  if (workspaceSubscriptionRefreshPromise) {
    return workspaceSubscriptionRefreshPromise;
  }

  setWorkspaceSubscriptionSnapshot({
    ...workspaceSubscriptionSnapshot,
    loading: true,
    ready: false,
  });

  workspaceSubscriptionRefreshPromise = (async () => {
    try {
      const response = await workspaceFetch("/api/workspaces/current", {
        cache: "no-store",
      });

      if (!response.ok) {
        const error = await parseApiErrorResponse(
          response,
          "Gagal memuat paket workspace aktif.",
        );

        if (recoverWorkspaceScopeViolation(error.code)) {
          const nextSnapshot = {
            workspaceId: null,
            subscription: null,
            loading: false,
            ready: false,
            error: null,
          };
          setWorkspaceSubscriptionSnapshot(nextSnapshot);
          return nextSnapshot;
        }

        const nextSnapshot = {
          workspaceId: null,
          subscription: null,
          loading: false,
          ready: false,
          error,
        };
        setWorkspaceSubscriptionSnapshot(nextSnapshot);
        return nextSnapshot;
      }

      const payload =
        (await response.json()) as CurrentWorkspaceSubscriptionPayload;
      const nextSnapshot = {
        workspaceId: payload.workspaceId,
        subscription: payload.subscription,
        loading: false,
        ready: true,
        error: null,
      } satisfies WorkspaceSubscriptionClientState;

      setWorkspaceSubscriptionSnapshot(nextSnapshot);
      return nextSnapshot;
    } catch (error) {
      const normalizedError = await normalizeClientError(
        error,
        "Gagal memuat paket workspace aktif.",
      );
      const nextSnapshot = {
        workspaceId: null,
        subscription: null,
        loading: false,
        ready: false,
        error: normalizedError,
      };
      setWorkspaceSubscriptionSnapshot(nextSnapshot);
      return nextSnapshot;
    } finally {
      workspaceSubscriptionRefreshPromise = null;
    }
  })();

  return workspaceSubscriptionRefreshPromise;
}

export function useWorkspaceSubscriptionClient() {
  return useSyncExternalStore(
    subscribeWorkspaceSubscription,
    getWorkspaceSubscriptionSnapshot,
    getWorkspaceSubscriptionSnapshot,
  );
}
