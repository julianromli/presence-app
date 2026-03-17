'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowsClockwise,
  CaretDown,
  Copy,
  Eye,
  EyeSlash,
  Key,
  PencilSimple,
  ShieldCheck,
} from '@phosphor-icons/react/dist/ssr';
import { useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ConfirmationDialog } from '@/components/ui/confirmation-dialog';
import { Input } from '@/components/ui/input';
import { Menu, MenuPopup, MenuRadioGroup, MenuRadioItem, MenuTrigger } from '@/components/ui/menu';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type {
  WorkspaceManagementPayload,
  AdminUsersPage,
  AdminUserRow,
  WorkspaceSettingsPayload,
} from '@/types/dashboard';
import { recoverWorkspaceScopeViolation, workspaceFetch } from '@/lib/workspace-client';
import { parseApiErrorResponse } from '@/lib/client-error';
import {
  buildAttendanceScheduleDraft,
  serializeAttendanceScheduleDraft,
  type AttendanceScheduleDraftRow,
} from '@/lib/workspace-attendance-schedule';
import {
  buildUsersQueryString,
  DEFAULT_USERS_FILTERS,
  resolveUsersFilters,
  type UsersPanelFilters,
} from '@/lib/users-filters';
import {
  formatWorkspaceDeviceUsageCopy,
  formatWorkspaceMemberUsageCopy,
  getAttendanceScheduleUpgradeCopy,
  getWorkspacePlanBadgeText,
  isAttendanceScheduleSaveDisabled,
  refreshWorkspaceSubscription,
  useWorkspaceSubscriptionClient,
} from '@/lib/workspace-subscription-client';
import {
  beginWorkspacePanelRefresh,
  buildWorkspaceDeleteConfirmation,
  canStartWorkspaceMutation,
  finishWorkspaceMemberAction,
  isWorkspaceMemberActionPending,
  isLatestWorkspacePanelRefresh,
  isWorkspaceMutationBusy,
  resolveWorkspaceButtonLoadingState,
  startWorkspaceMemberAction,
  type WorkspaceMemberPendingState,
  type WorkspacePanelBusyAction,
  type WorkspacePanelRefreshState,
} from '@/components/dashboard/workspace-panel-state';

type NoticeTone = 'info' | 'success' | 'warning' | 'error';

type InlineNotice = {
  tone: NoticeTone;
  text: string;
};

const INVITE_EXPIRY_DAY_MS = 24 * 60 * 60 * 1000;

const INVITE_EXPIRY_OPTIONS = [
  { value: 'never', label: 'Tidak kedaluwarsa' },
  { value: '1d', label: '1 hari', durationMs: INVITE_EXPIRY_DAY_MS },
  { value: '7d', label: '7 hari', durationMs: 7 * INVITE_EXPIRY_DAY_MS },
  { value: '30d', label: '30 hari', durationMs: 30 * INVITE_EXPIRY_DAY_MS },
] as const;

type InviteExpiryOptionValue = (typeof INVITE_EXPIRY_OPTIONS)[number]['value'];
type InviteExpirySelectValue = InviteExpiryOptionValue | '';

function noticeClass(tone: NoticeTone) {
  switch (tone) {
    case 'success':
      return 'border-emerald-200 bg-emerald-50 text-emerald-900';
    case 'warning':
      return 'border-amber-200 bg-amber-50 text-amber-900';
    case 'error':
      return 'border-rose-200 bg-rose-50/50 text-rose-900';
    default:
      return 'border-zinc-200 bg-zinc-50 text-zinc-900';
  }
}

function resolveInviteExpiryOption(expiresAt?: number): InviteExpirySelectValue {
  if (expiresAt === undefined) {
    return 'never';
  }

  const remaining = expiresAt - Date.now();
  if (remaining <= 0) {
    return '';
  }

  const toleranceMs = 5 * 60 * 1000;

  for (const option of INVITE_EXPIRY_OPTIONS) {
    if (!('durationMs' in option)) {
      continue;
    }

    if (Math.abs(remaining - option.durationMs) <= toleranceMs) {
      return option.value;
    }
  }

  return '';
}

export function WorkspacePanel() {
  const searchParams = useSearchParams();
  const headerQuery = (searchParams.get('q') ?? '').trim();
  const workspaceSubscriptionState = useWorkspaceSubscriptionClient();
  const [workspaceData, setWorkspaceData] = useState<WorkspaceManagementPayload | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [inviteVisible, setInviteVisible] = useState(false);
  const [inviteExpiryValue, setInviteExpiryValue] = useState<InviteExpirySelectValue>('never');
  const [loadingWorkspace, setLoadingWorkspace] = useState(true);
  const [loadingSettings, setLoadingSettings] = useState(true);
  const [busyAction, setBusyAction] = useState<WorkspacePanelBusyAction>('none');
  const [savingInviteExpiry, setSavingInviteExpiry] = useState(false);
  const [copyingInviteCode, setCopyingInviteCode] = useState(false);
  const [savingSchedule, setSavingSchedule] = useState(false);
  const [deleteConfirmationOpen, setDeleteConfirmationOpen] = useState(false);
  const [notice, setNotice] = useState<InlineNotice | null>(null);
  const [scheduleRows, setScheduleRows] = useState<AttendanceScheduleDraftRow[]>(() =>
    buildAttendanceScheduleDraft(),
  );

  const initialFilters = useMemo<UsersPanelFilters>(
    () => ({
      ...DEFAULT_USERS_FILTERS,
      q: headerQuery,
    }),
    [headerQuery],
  );
  const [filters, setFilters] = useState<UsersPanelFilters>(initialFilters);
  const [appliedFilters, setAppliedFilters] = useState<UsersPanelFilters>(initialFilters);
  const [rows, setRows] = useState<AdminUserRow[]>([]);
  const [summary, setSummary] = useState<AdminUsersPage['summary']>({
    total: 0,
    active: 0,
    inactive: 0,
  });
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [isLastPage, setIsLastPage] = useState(true);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [membersAction, setMembersAction] = useState<'none' | 'apply' | 'reset' | 'load-more'>('none');
  const [memberPendingState, setMemberPendingState] =
    useState<WorkspaceMemberPendingState>({});
  const hasLoadedInitial = useRef(false);
  const prevHeaderQueryRef = useRef(headerQuery);
  const workspaceMutationLockRef = useRef(false);
  const latestRefreshStateRef = useRef<WorkspacePanelRefreshState>({
    members: 0,
    workspaceData: 0,
  });

  const hasFilter = useMemo(
    () =>
      appliedFilters.q.trim().length > 0 ||
      appliedFilters.role !== 'all' ||
      appliedFilters.isActive !== 'all',
    [appliedFilters],
  );

  const loadWorkspaceData = useCallback(async () => {
    const refresh = beginWorkspacePanelRefresh(
      latestRefreshStateRef.current,
      'workspaceData',
    );
    latestRefreshStateRef.current = refresh.nextState;
    setLoadingWorkspace(true);
    try {
      const res = await workspaceFetch('/api/admin/workspace', { cache: 'no-store' });
      if (!res.ok) {
        const parsed = await parseApiErrorResponse(res, 'Gagal memuat data workspace.');
        if (recoverWorkspaceScopeViolation(parsed.code)) {
          return;
        }
        if (
          !isLatestWorkspacePanelRefresh(
            latestRefreshStateRef.current,
            'workspaceData',
            refresh.requestId,
          )
        ) {
          return;
        }
        setNotice({ tone: 'error', text: `[${parsed.code}] ${parsed.message}` });
        return;
      }
      const payload = (await res.json()) as WorkspaceManagementPayload;
      if (
        !isLatestWorkspacePanelRefresh(
          latestRefreshStateRef.current,
          'workspaceData',
          refresh.requestId,
        )
      ) {
        return;
      }
      setWorkspaceData(payload);
      setRenameValue(payload.workspace.name);
    } finally {
      if (
        isLatestWorkspacePanelRefresh(
          latestRefreshStateRef.current,
          'workspaceData',
          refresh.requestId,
        )
      ) {
        setLoadingWorkspace(false);
      }
    }
  }, []);

  const loadSettingsData = useCallback(async () => {
    setLoadingSettings(true);
    try {
      const res = await workspaceFetch('/api/admin/settings', { cache: 'no-store' });
      if (!res.ok) {
        const parsed = await parseApiErrorResponse(res, 'Gagal memuat pengaturan workspace.');
        if (recoverWorkspaceScopeViolation(parsed.code)) {
          return;
        }
        setNotice({ tone: 'error', text: `[${parsed.code}] ${parsed.message}` });
        return;
      }

      const payload = (await res.json()) as WorkspaceSettingsPayload;
      setScheduleRows(buildAttendanceScheduleDraft(payload.attendanceSchedule));
    } finally {
      setLoadingSettings(false);
    }
  }, []);

  const loadMembers = useCallback(async (
    opts: { append: boolean; cursor: string | null; activeFilters?: UsersPanelFilters } = {
      append: false,
      cursor: null,
    },
  ) => {
    const activeFilters = resolveUsersFilters(appliedFilters, opts.activeFilters);
    const refresh = beginWorkspacePanelRefresh(
      latestRefreshStateRef.current,
      'members',
    );
    latestRefreshStateRef.current = refresh.nextState;
    setLoadingMembers(true);
    try {
      const res = await workspaceFetch(`/api/admin/users?${buildUsersQueryString(activeFilters, opts.cursor)}`, {
        cache: 'no-store',
      });
      if (!res.ok) {
        const parsed = await parseApiErrorResponse(res, 'Gagal memuat member workspace.');
        if (recoverWorkspaceScopeViolation(parsed.code)) {
          return;
        }
        if (
          !isLatestWorkspacePanelRefresh(
            latestRefreshStateRef.current,
            'members',
            refresh.requestId,
          )
        ) {
          return;
        }
        setNotice({ tone: 'error', text: `[${parsed.code}] ${parsed.message}` });
        return;
      }
      const payload = (await res.json()) as AdminUsersPage;
      if (
        !isLatestWorkspacePanelRefresh(
          latestRefreshStateRef.current,
          'members',
          refresh.requestId,
        )
      ) {
        return;
      }
      setRows((prev) => (opts.append ? [...prev, ...payload.rows] : payload.rows));
      setSummary(payload.summary);
      setNextCursor(payload.pageInfo.isDone ? null : payload.pageInfo.continueCursor);
      setIsLastPage(payload.pageInfo.isDone);
    } finally {
      if (
        isLatestWorkspacePanelRefresh(
          latestRefreshStateRef.current,
          'members',
          refresh.requestId,
        )
      ) {
        setLoadingMembers(false);
      }
    }
  }, [appliedFilters]);

  useEffect(() => {
    if (hasLoadedInitial.current) return;
    hasLoadedInitial.current = true;
    void loadWorkspaceData();
    void loadSettingsData();
    void loadMembers({ append: false, cursor: null, activeFilters: initialFilters });
  }, [initialFilters, loadMembers, loadSettingsData, loadWorkspaceData]);

  useEffect(() => {
    if (prevHeaderQueryRef.current === headerQuery) return;
    prevHeaderQueryRef.current = headerQuery;
    const nextFilters: UsersPanelFilters = {
      ...appliedFilters,
      q: headerQuery,
    };
    setFilters(nextFilters);
    setAppliedFilters(nextFilters);
    const timer = window.setTimeout(() => {
      void loadMembers({ append: false, cursor: null, activeFilters: nextFilters });
    }, 0);
    return () => window.clearTimeout(timer);
  }, [appliedFilters, headerQuery, loadMembers]);

  useEffect(() => {
    const refreshWorkspacePanel = () => {
      void loadWorkspaceData();
      void loadSettingsData();
      void loadMembers({ append: false, cursor: null, activeFilters: appliedFilters });
    };

    window.addEventListener('workspace:changed', refreshWorkspacePanel as EventListener);
    window.addEventListener('dashboard:refresh', refreshWorkspacePanel as EventListener);

    return () => {
      window.removeEventListener('workspace:changed', refreshWorkspacePanel as EventListener);
      window.removeEventListener('dashboard:refresh', refreshWorkspacePanel as EventListener);
    };
  }, [appliedFilters, loadMembers, loadSettingsData, loadWorkspaceData]);

  useEffect(() => {
    setInviteExpiryValue(resolveInviteExpiryOption(workspaceData?.activeInviteCode?.expiresAt));
  }, [workspaceData?.activeInviteCode?.expiresAt]);

  const runWorkspaceMutation = useCallback(
    async (action: Exclude<WorkspacePanelBusyAction, 'none'>, operation: () => Promise<void>) => {
      if (!canStartWorkspaceMutation(busyAction) || workspaceMutationLockRef.current) {
        return;
      }

      workspaceMutationLockRef.current = true;
      setBusyAction(action);
      setNotice(null);

      try {
        await operation();
      } catch (error) {
        const message =
          error instanceof Error && error.message
            ? error.message
            : 'Terjadi kesalahan tidak terduga saat memproses perubahan workspace.';
        console.error('workspace mutation failed', error);
        setNotice({ tone: 'error', text: `[UNEXPECTED_ERROR] ${message}` });
      } finally {
        workspaceMutationLockRef.current = false;
        setBusyAction('none');
      }
    },
    [busyAction],
  );

  const handleRename = async () => {
    await runWorkspaceMutation('rename', async () => {
      const res = await workspaceFetch('/api/admin/workspace', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: renameValue }),
      });
      if (!res.ok) {
        const parsed = await parseApiErrorResponse(res, 'Gagal mengubah nama workspace.');
        if (recoverWorkspaceScopeViolation(parsed.code)) {
          return;
        }
        setNotice({ tone: 'error', text: `[${parsed.code}] ${parsed.message}` });
        return;
      }
      await loadWorkspaceData();
      setNotice({ tone: 'success', text: 'Nama workspace berhasil diperbarui.' });
    });
  };

  const handleRotateInviteCode = async () => {
    await runWorkspaceMutation('rotate', async () => {
      const res = await workspaceFetch('/api/admin/workspace', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'rotateInviteCode' }),
      });
      if (!res.ok) {
        const parsed = await parseApiErrorResponse(res, 'Gagal merotasi invitation code.');
        if (recoverWorkspaceScopeViolation(parsed.code)) {
          return;
        }
        setNotice({ tone: 'error', text: `[${parsed.code}] ${parsed.message}` });
        return;
      }
      await loadWorkspaceData();
      setInviteVisible(true);
      setNotice({ tone: 'success', text: 'Invitation code baru berhasil dibuat.' });
    });
  };

  const handleInviteExpiryChange = async (nextValue: InviteExpiryOptionValue) => {
    if (
      !workspaceData?.activeInviteCode ||
      savingInviteExpiry ||
      workspaceMutationLockRef.current ||
      isWorkspaceMutationBusy(busyAction)
    ) {
      return;
    }

    const previousValue = inviteExpiryValue;
    setInviteExpiryValue(nextValue);
    setSavingInviteExpiry(true);
    workspaceMutationLockRef.current = true;
    setNotice(null);

    try {
      const res = await workspaceFetch('/api/admin/workspace', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'updateInviteExpiry', expiryPreset: nextValue }),
      });
      if (!res.ok) {
        const parsed = await parseApiErrorResponse(res, 'Gagal memperbarui masa berlaku invitation code.');
        setInviteExpiryValue(previousValue);
        if (recoverWorkspaceScopeViolation(parsed.code)) {
          return;
        }
        setNotice({ tone: 'error', text: `[${parsed.code}] ${parsed.message}` });
        return;
      }

      await loadWorkspaceData();
      setNotice({
        tone: 'success',
        text:
          nextValue === 'never'
            ? 'Invitation code tidak lagi memiliki masa berlaku.'
            : 'Masa berlaku invitation code berhasil diperbarui.',
      });
    } catch (error) {
      const message =
        error instanceof Error && error.message
          ? error.message
          : 'Terjadi kesalahan tidak terduga saat memperbarui masa berlaku invitation code.';
      console.error('invite expiry update failed', error);
      setInviteExpiryValue(previousValue);
      setNotice({ tone: 'error', text: `[UNEXPECTED_ERROR] ${message}` });
    } finally {
      workspaceMutationLockRef.current = false;
      setSavingInviteExpiry(false);
    }
  };

  const requestDeleteWorkspace = () => {
    if (!workspaceData || workspaceMutationLockRef.current) {
      return;
    }

    if (workspaceData.memberSummary.activeCountExcludingCurrentUser > 0) {
      setNotice({
        tone: 'warning',
        text: 'Kick atau nonaktifkan semua member lain sebelum menghapus workspace ini.',
      });
      return;
    }

    setDeleteConfirmationOpen(true);
  };

  const handleDeleteWorkspace = async () => {
    if (!workspaceData) {
      return;
    }

    await runWorkspaceMutation('delete', async () => {
      const res = await workspaceFetch('/api/admin/workspace', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'deleteWorkspace' }),
      });
      if (!res.ok) {
        const parsed = await parseApiErrorResponse(res, 'Gagal menghapus workspace.');
        if (recoverWorkspaceScopeViolation(parsed.code)) {
          return;
        }
        setNotice({ tone: 'error', text: `[${parsed.code}] ${parsed.message}` });
        return;
      }

      setNotice({ tone: 'info', text: 'Workspace berhasil dihapus. Mengalihkan akses...' });
      recoverWorkspaceScopeViolation('WORKSPACE_ACCESS_LOST');
      setDeleteConfirmationOpen(false);
    });
  };

  const copyInviteCode = async () => {
    if (!workspaceData?.activeInviteCode?.code) {
      return;
    }
    setCopyingInviteCode(true);
    try {
      await navigator.clipboard.writeText(workspaceData.activeInviteCode.code);
      setNotice({ tone: 'success', text: 'Invitation code berhasil disalin.' });
    } catch {
      setNotice({ tone: 'warning', text: 'Clipboard tidak tersedia. Salin secara manual.' });
    } finally {
      setCopyingInviteCode(false);
    }
  };

  const updateMember = async (payload: { userId: string; role?: AdminUserRow['role']; isActive?: boolean }) => {
    setMemberPendingState((prev) => startWorkspaceMemberAction(prev, payload.userId));
    setNotice(null);
    try {
      const res = await workspaceFetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const parsed = await parseApiErrorResponse(res, 'Gagal memperbarui member workspace.');
        if (recoverWorkspaceScopeViolation(parsed.code)) {
          return;
        }
        setNotice({ tone: 'error', text: `[${parsed.code}] ${parsed.message}` });
        return;
      }
      await Promise.all([
        loadMembers({ append: false, cursor: null, activeFilters: appliedFilters }),
        loadWorkspaceData(),
        refreshWorkspaceSubscription(),
      ]);
      setNotice({ tone: 'success', text: 'Perubahan member berhasil disimpan.' });
    } finally {
      setMemberPendingState((prev) => finishWorkspaceMemberAction(prev, payload.userId));
    }
  };

  const updateScheduleRow = useCallback(
    (
      day: AttendanceScheduleDraftRow['day'],
      next: Partial<Pick<AttendanceScheduleDraftRow, 'enabled' | 'checkInTime'>>,
    ) => {
      setScheduleRows((prev) =>
        prev.map((row) => {
          if (row.day !== day) return row;
          return {
            ...row,
            ...next,
          };
        }),
      );
    },
    [],
  );

  const handleSaveSchedule = async () => {
    setSavingSchedule(true);
    setNotice({ tone: 'info', text: 'Menyimpan jadwal jam masuk workspace...' });

    try {
      const res = await workspaceFetch('/api/admin/settings', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          attendanceSchedule: serializeAttendanceScheduleDraft(scheduleRows),
        }),
      });

      if (!res.ok) {
        const parsed = await parseApiErrorResponse(res, 'Gagal menyimpan jadwal jam masuk.');
        if (recoverWorkspaceScopeViolation(parsed.code)) {
          return;
        }
        setNotice({ tone: 'error', text: `[${parsed.code}] ${parsed.message}` });
        return;
      }

      await loadSettingsData();
      setNotice({ tone: 'success', text: 'Jadwal jam masuk workspace berhasil disimpan.' });
    } finally {
      setSavingSchedule(false);
    }
  };

  if (loadingWorkspace && !workspaceData) {
    return (
      <div className="space-y-4">
        <div className="h-36 animate-pulse rounded-xl border border-zinc-200 bg-white" />
        <div className="h-60 animate-pulse rounded-xl border border-zinc-200 bg-white" />
      </div>
    );
  }

  const maskedCode = workspaceData?.activeInviteCode?.code
    ? `${workspaceData.activeInviteCode.code.slice(0, 4)}-****-********`
    : '-';
  const activeMembersExcludingCurrentUser = workspaceData?.memberSummary.activeCountExcludingCurrentUser ?? 0;
  const deleteBlocked = activeMembersExcludingCurrentUser > 0;
  const actionLoadingState = resolveWorkspaceButtonLoadingState({ busyAction, savingSchedule });
  const workspaceMutationBusy = isWorkspaceMutationBusy(busyAction) || savingInviteExpiry;
  const deleteConfirmation = workspaceData
    ? buildWorkspaceDeleteConfirmation(workspaceData.workspace.name)
    : null;
  const inviteExpiryEnabled = workspaceData?.subscription.features.inviteExpiry === true;
  const inviteExpiryHasCustomValue =
    workspaceData?.activeInviteCode?.expiresAt !== undefined && inviteExpiryValue === '';
  const inviteExpiryLabel =
    workspaceData?.activeInviteCode?.expiresAt !== undefined
      ? new Date(workspaceData.activeInviteCode.expiresAt).toLocaleString('id-ID')
      : 'Tidak kedaluwarsa';
  const subscription = workspaceSubscriptionState.ready
    ? workspaceSubscriptionState.subscription
    : workspaceData?.subscription ?? null;
  const planBadgeText = subscription
    ? getWorkspacePlanBadgeText(subscription.plan)
    : null;
  const memberUsageCopy = subscription
    ? formatWorkspaceMemberUsageCopy(
      subscription.usage.activeMembers,
      subscription.limits.maxMembersPerWorkspace,
    )
    : null;
  const deviceUsageCopy = subscription
    ? formatWorkspaceDeviceUsageCopy(
      subscription.usage.activeDevices,
      subscription.limits.maxDevicesPerWorkspace,
    )
    : null;
  const attendanceScheduleSaveDisabled =
    !workspaceSubscriptionState.ready || isAttendanceScheduleSaveDisabled(subscription);
  const attendanceScheduleUpgradeCopy = getAttendanceScheduleUpgradeCopy(subscription);

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      <ConfirmationDialog
        open={deleteConfirmationOpen && Boolean(deleteConfirmation)}
        title={deleteConfirmation?.title ?? ''}
        description={deleteConfirmation?.description ?? ''}
        confirmLabel={deleteConfirmation?.confirmLabel ?? 'Hapus Workspace'}
        cancelLabel={deleteConfirmation?.cancelLabel ?? 'Batal'}
        tone="destructive"
        isPending={actionLoadingState.deleteWorkspace}
        onConfirm={() => {
          void handleDeleteWorkspace();
        }}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteConfirmationOpen(false);
          }
        }}
      />

      {notice ? (
        <div className={`rounded-lg border px-3 py-2 text-sm ${noticeClass(notice.tone)}`}>
          {notice.text}
        </div>
      ) : null}

      <section className="grid gap-4 lg:grid-cols-2">
        <article className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-zinc-600">
              <Key weight="regular" className="h-4 w-4" />
              <h2 className="text-base font-semibold text-zinc-900">Invitation Code</h2>
            </div>
            <button
              type="button"
              className="inline-flex items-center gap-1 text-xs font-medium text-zinc-600 hover:text-zinc-900"
              onClick={() => setInviteVisible((prev) => !prev)}
            >
              {inviteVisible ? <EyeSlash weight="regular" className="h-4 w-4" /> : <Eye weight="regular" className="h-4 w-4" />}
              {inviteVisible ? 'Hide' : 'Reveal'}
            </button>
          </div>
          <div className="mt-4 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2">
            <p className="font-mono text-sm text-zinc-900">
              {inviteVisible ? workspaceData?.activeInviteCode?.code ?? '-' : maskedCode}
            </p>
            <p className="mt-1 text-xs text-zinc-500">
              Last rotated:{' '}
              {workspaceData?.activeInviteCode?.lastRotatedAt
                ? new Date(workspaceData.activeInviteCode.lastRotatedAt).toLocaleString('id-ID')
                : '-'}
            </p>
            <p className="mt-1 text-xs text-zinc-500">Kedaluwarsa: {inviteExpiryLabel}</p>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void copyInviteCode()}
              isLoading={copyingInviteCode}
            >
              {!copyingInviteCode ? <Copy weight="regular" className="mr-1 h-4 w-4" /> : null}
              Copy
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void handleRotateInviteCode()}
              disabled={workspaceMutationBusy}
              isLoading={actionLoadingState.rotateInviteCode}
            >
              {!actionLoadingState.rotateInviteCode ? (
                <ArrowsClockwise weight="regular" className="mr-1 h-4 w-4" />
              ) : null}
              Rotate
            </Button>
            <label className="flex items-center gap-2 rounded-md border border-zinc-200 bg-white px-2 py-1.5 text-xs text-zinc-700">
              <span className="whitespace-nowrap">Kedaluwarsa</span>
              <select
                className="min-w-[148px] bg-transparent text-xs text-zinc-900 outline-none disabled:cursor-not-allowed disabled:text-zinc-400"
                value={inviteExpiryValue}
                disabled={!inviteExpiryEnabled || !workspaceData?.activeInviteCode || workspaceMutationBusy}
                onChange={(event) =>
                  void handleInviteExpiryChange(event.target.value as InviteExpiryOptionValue)
                }
              >
                {inviteExpiryHasCustomValue ? (
                  <option value="" disabled>
                    Nilai tersimpan saat ini
                  </option>
                ) : null}
                {INVITE_EXPIRY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            {!inviteExpiryEnabled ? (
              <p className="text-xs font-medium text-amber-700">
                Pro: upgrade untuk mengatur masa berlaku kode.
              </p>
            ) : inviteExpiryHasCustomValue ? (
              <p className="text-xs text-zinc-500">
                Masa berlaku saat ini berasal dari nilai lama dan tidak akan berubah sampai Anda memilih preset baru.
              </p>
            ) : null}
          </div>
        </article>

        <article className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2 text-zinc-600">
            <PencilSimple weight="regular" className="h-4 w-4" />
            <h2 className="text-base font-semibold text-zinc-900">Workspace Profile</h2>
          </div>
          <div className="mt-4 space-y-3">
            <label className="space-y-1">
              <span className="text-sm font-medium text-zinc-700">Workspace name</span>
              <Input value={renameValue} onChange={(event) => setRenameValue(event.target.value)} />
            </label>
            <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-xs text-zinc-600">
              {planBadgeText ? (
                <div className="flex flex-wrap items-center gap-2">
                  <span>Plan:</span>
                  <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-800">
                    {planBadgeText}
                  </span>
                </div>
              ) : null}
              {memberUsageCopy ? (
                <p className="mt-2">
                  Member aktif:{' '}
                  <span className="font-semibold text-zinc-900">{memberUsageCopy}</span>
                </p>
              ) : null}
              {deviceUsageCopy ? (
                <p className="mt-1">
                  Device aktif:{' '}
                  <span className="font-semibold text-zinc-900">{deviceUsageCopy}</span>
                </p>
              ) : null}
              <p>Slug: <span className="font-mono text-zinc-900">{workspaceData?.workspace.slug ?? '-'}</span></p>
              <p className="mt-1">
                Created:{' '}
                {workspaceData?.workspace.createdAt
                  ? new Date(workspaceData.workspace.createdAt).toLocaleString('id-ID')
                  : '-'}
              </p>
            </div>
            <Button
              type="button"
              onClick={() => void handleRename()}
              disabled={renameValue.trim().length < 3 || workspaceMutationBusy}
              isLoading={actionLoadingState.renameWorkspace}
            >
              Simpan Nama Workspace
            </Button>
          </div>
        </article>
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-zinc-900">Jam Masuk Workspace</h2>
            <p className="mt-1 text-sm text-zinc-600">
              Atur jam masuk per hari untuk menentukan status tepat waktu atau terlambat.
            </p>
            {workspaceSubscriptionState.ready && attendanceScheduleUpgradeCopy ? (
              <p className="mt-2 text-sm font-medium text-amber-700">
                {attendanceScheduleUpgradeCopy}
              </p>
            ) : null}
          </div>
          <Button
            type="button"
            onClick={() => void handleSaveSchedule()}
            disabled={loadingSettings || savingSchedule || attendanceScheduleSaveDisabled}
            isLoading={actionLoadingState.saveSchedule}
            loadingText="Menyimpan..."
          >
            Simpan Jadwal
          </Button>
        </div>

        {loadingSettings ? (
          <div className="mt-4 h-56 animate-pulse rounded-xl border border-zinc-200 bg-zinc-50" />
        ) : (
          <div className="mt-4 overflow-hidden rounded-xl border border-zinc-200">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[180px]">Hari</TableHead>
                  <TableHead className="w-[120px]">Aktif</TableHead>
                  <TableHead>Jam masuk</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {scheduleRows.map((row) => (
                  <TableRow key={row.day}>
                    <TableCell className="font-medium text-zinc-900">{row.label}</TableCell>
                    <TableCell>
                      <label className="inline-flex items-center gap-2 text-sm text-zinc-700">
                        <Checkbox
                          checked={row.enabled}
                          disabled={attendanceScheduleSaveDisabled}
                          onCheckedChange={(checked) =>
                            updateScheduleRow(row.day, { enabled: checked === true })
                          }
                        />
                        {row.enabled ? 'Aktif' : 'Nonaktif'}
                      </label>
                    </TableCell>
                    <TableCell>
                      <div className="max-w-[180px]">
                        <Input
                          type="time"
                          step={60}
                          value={row.checkInTime}
                          disabled={!row.enabled || attendanceScheduleSaveDisabled}
                          onChange={(event) =>
                            updateScheduleRow(row.day, { checkInTime: event.target.value })
                          }
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>

      <section className="rounded-xl border border-rose-200 bg-rose-50/50 p-5 shadow-sm">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-rose-950">Danger Zone</h2>
            <p className="mt-1 text-sm text-rose-900/80">
              Workspace hanya bisa dihapus setelah semua member lain sudah di-kick atau dinonaktifkan.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            className="border-rose-300 text-rose-900 hover:bg-rose-100"
            disabled={deleteBlocked || workspaceMutationBusy}
            onClick={requestDeleteWorkspace}
            isLoading={actionLoadingState.deleteWorkspace}
          >
            Hapus Workspace
          </Button>
        </div>
        <div className="mt-4 grid gap-3 text-sm text-rose-950/85 md:grid-cols-3">
          <div className="rounded-lg border border-rose-200 bg-white/80 px-3 py-2">
            Member total: <span className="font-semibold">{workspaceData?.memberSummary.totalCount ?? 0}</span>
          </div>
          <div className="rounded-lg border border-rose-200 bg-white/80 px-3 py-2">
            Member aktif: <span className="font-semibold">{workspaceData?.memberSummary.activeCount ?? 0}</span>
          </div>
          <div className="rounded-lg border border-rose-200 bg-white/80 px-3 py-2">
            Member aktif lain: <span className="font-semibold">{activeMembersExcludingCurrentUser}</span>
          </div>
        </div>
        <p className="mt-3 text-xs text-rose-900/75">
          {deleteBlocked
            ? 'Workspace belum dapat dihapus karena masih ada member aktif selain Anda.'
            : 'Workspace siap dihapus. Setelah berhasil, Anda akan dialihkan ke workspace lain atau onboarding.'}
        </p>
      </section>


      <section className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm md:p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-zinc-600">
            <ShieldCheck weight="regular" className="h-4 w-4" />
            <h2 className="text-base font-semibold text-zinc-900">Member Management</h2>
          </div>
          <p className="text-xs text-zinc-500">
            Total {summary.total} · Aktif {summary.active} · Non-aktif {summary.inactive}
          </p>
        </div>

        <form
          className="grid gap-3 md:grid-cols-[1fr_180px_160px_auto]"
          onSubmit={(event) => {
            event.preventDefault();
            const nextFilters = resolveUsersFilters(filters);
            setAppliedFilters(nextFilters);
            setMembersAction('apply');
            void loadMembers({ append: false, cursor: null, activeFilters: nextFilters }).finally(() =>
              setMembersAction('none'),
            );
          }}
        >
          <label className="space-y-1">
            <span className="text-sm font-medium text-zinc-700">Cari user</span>
            <Input
              value={filters.q}
              onChange={(event) => setFilters((prev) => ({ ...prev, q: event.target.value }))}
              placeholder="Nama atau email"
            />
          </label>
          <label className="space-y-1">
            <span className="text-sm font-medium text-zinc-700">Role</span>
            <Menu>
              <MenuTrigger
                render={
                  <Button
                    className="h-10 w-full justify-between rounded-md border-zinc-200 bg-white px-3 text-sm font-normal text-zinc-900"
                    variant="outline"
                  />
                }
              >
                {filters.role === 'all'
                  ? 'Semua'
                  : filters.role === 'superadmin'
                    ? 'Superadmin'
                    : filters.role === 'admin'
                      ? 'Admin'
                      : filters.role === 'karyawan'
                        ? 'Karyawan'
                        : 'Device QR'}
                <CaretDown weight="regular" className="h-4 w-4 text-zinc-500" />
              </MenuTrigger>
              <MenuPopup align="start" className="w-[var(--anchor-width)]">
                <MenuRadioGroup
                  value={filters.role}
                  onValueChange={(value) =>
                    setFilters((prev) => ({ ...prev, role: value as UsersPanelFilters['role'] }))
                  }
                >
                  <MenuRadioItem value="all">Semua</MenuRadioItem>
                  <MenuRadioItem value="superadmin">Superadmin</MenuRadioItem>
                  <MenuRadioItem value="admin">Admin</MenuRadioItem>
                  <MenuRadioItem value="karyawan">Karyawan</MenuRadioItem>
                  <MenuRadioItem value="device-qr">Device QR</MenuRadioItem>
                </MenuRadioGroup>
              </MenuPopup>
            </Menu>
          </label>
          <label className="space-y-1">
            <span className="text-sm font-medium text-zinc-700">Status</span>
            <Menu>
              <MenuTrigger
                render={
                  <Button
                    className="h-10 w-full justify-between rounded-md border-zinc-200 bg-white px-3 text-sm font-normal text-zinc-900"
                    variant="outline"
                  />
                }
              >
                {filters.isActive === 'all' ? 'Semua' : filters.isActive === 'true' ? 'Aktif' : 'Non-aktif'}
                <CaretDown weight="regular" className="h-4 w-4 text-zinc-500" />
              </MenuTrigger>
              <MenuPopup align="start" className="w-[var(--anchor-width)]">
                <MenuRadioGroup
                  value={filters.isActive}
                  onValueChange={(value) =>
                    setFilters((prev) => ({ ...prev, isActive: value as UsersPanelFilters['isActive'] }))
                  }
                >
                  <MenuRadioItem value="all">Semua</MenuRadioItem>
                  <MenuRadioItem value="true">Aktif</MenuRadioItem>
                  <MenuRadioItem value="false">Non-aktif</MenuRadioItem>
                </MenuRadioGroup>
              </MenuPopup>
            </Menu>
          </label>
          <div className="flex items-end gap-2">
            <Button type="submit" disabled={loadingMembers} isLoading={membersAction === 'apply'}>
              Terapkan
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={loadingMembers}
              isLoading={membersAction === 'reset'}
              onClick={() => {
                setFilters(DEFAULT_USERS_FILTERS);
                setAppliedFilters(DEFAULT_USERS_FILTERS);
                setMembersAction('reset');
                void loadMembers({ append: false, cursor: null, activeFilters: DEFAULT_USERS_FILTERS }).finally(() =>
                  setMembersAction('none'),
                );
              }}
            >
              Reset
            </Button>
          </div>
        </form>

        <div className="mt-4 rounded-xl border border-zinc-200 bg-white">
          <Table className="min-w-[900px]">
            <TableHeader>
              <TableRow>
                <TableHead className="w-[200px]">Nama</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loadingMembers && rows.length === 0 ? (
                <TableRow>
                  <TableCell className="h-24 text-center text-zinc-500" colSpan={5}>
                    Memuat member workspace...
                  </TableCell>
                </TableRow>
              ) : rows.length === 0 ? (
                <TableRow>
                  <TableCell className="h-24 text-center text-zinc-500" colSpan={5}>
                    {hasFilter ? 'Tidak ada member yang cocok dengan filter.' : 'Belum ada member workspace.'}
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((row) => (
                  <TableRow key={row._id}>
                    <TableCell className="font-medium text-zinc-900">{row.name}</TableCell>
                    <TableCell className="text-zinc-600">{row.email}</TableCell>
                    <TableCell>
                      <Menu>
                        <MenuTrigger
                          render={
                            <Button
                              className="h-8 min-w-[120px] justify-between rounded-md border-zinc-200 bg-white px-2 text-xs font-normal text-zinc-900"
                              variant="outline"
                            />
                          }
                          disabled={isWorkspaceMemberActionPending(row._id, memberPendingState)}
                        >
                          {row.role}
                          <CaretDown weight="regular" className="h-3.5 w-3.5 text-zinc-500" />
                        </MenuTrigger>
                        <MenuPopup align="start" className="min-w-[120px]">
                          <MenuRadioGroup
                            value={row.role}
                            onValueChange={(value) =>
                              void updateMember({ userId: row._id, role: value as AdminUserRow['role'] })
                            }
                          >
                            <MenuRadioItem value="superadmin">superadmin</MenuRadioItem>
                            <MenuRadioItem value="admin">admin</MenuRadioItem>
                            <MenuRadioItem value="karyawan">karyawan</MenuRadioItem>
                            <MenuRadioItem value="device-qr">device-qr</MenuRadioItem>
                          </MenuRadioGroup>
                        </MenuPopup>
                      </Menu>
                    </TableCell>
                    <TableCell>
                      <span
                        className={`rounded-full px-2 py-1 text-xs font-medium ${row.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                          }`}
                      >
                        {row.isActive ? 'Aktif' : 'Non-aktif'}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        isLoading={isWorkspaceMemberActionPending(row._id, memberPendingState)}
                        onClick={() => void updateMember({ userId: row._id, isActive: !row.isActive })}
                      >
                        {row.isActive ? 'Nonaktifkan' : 'Aktifkan'}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {!isLastPage ? (
          <div className="mt-3">
            <Button
              type="button"
              variant="outline"
              disabled={loadingMembers || !nextCursor}
              isLoading={membersAction === 'load-more'}
              onClick={() => {
                setMembersAction('load-more');
                void loadMembers({ append: true, cursor: nextCursor, activeFilters: appliedFilters }).finally(() =>
                  setMembersAction('none'),
                );
              }}
            >
              Muat Lagi
            </Button>
          </div>
        ) : null}
      </section>
    </div>
  );
}
