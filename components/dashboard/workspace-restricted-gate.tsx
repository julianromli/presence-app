'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useClerk } from '@clerk/nextjs';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { fetchWorkspaceRestrictions, normalizeWorkspaceBillingError } from '@/lib/workspace-billing-client';
import { workspaceFetch } from '@/lib/workspace-client';
import {
  getRestrictedWorkspaceOverlayCopy,
  refreshWorkspaceSubscription,
} from '@/lib/workspace-subscription-client';
import { cn } from '@/lib/utils';
import type { WorkspaceRestrictedExpiredStatePayload } from '@/types/dashboard';
import { WorkspaceBillingPanel } from '@/components/dashboard/workspace-billing-panel';

type WorkspaceRestrictedGateProps = {
  role?: string;
};

type NoticeTone = 'info' | 'success' | 'warning' | 'error';

type InlineNotice = {
  tone: NoticeTone;
  text: string;
};

function formatDateTime(value?: number) {
  if (!value) {
    return '-';
  }

  return new Date(value).toLocaleString('id-ID', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

function noticeClass(tone: NoticeTone) {
  switch (tone) {
    case 'success':
      return 'border-emerald-200 bg-emerald-50 text-emerald-900';
    case 'warning':
      return 'border-amber-200 bg-amber-50 text-amber-900';
    case 'error':
      return 'border-rose-200 bg-rose-50 text-rose-900';
    default:
      return 'border-zinc-200 bg-zinc-50 text-zinc-900';
  }
}

export function WorkspaceRestrictedGate({ role = 'karyawan' }: WorkspaceRestrictedGateProps) {
  const { signOut } = useClerk();
  const [restrictionState, setRestrictionState] =
    useState<WorkspaceRestrictedExpiredStatePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<InlineNotice | null>(null);
  const [pendingKeys, setPendingKeys] = useState<Record<string, boolean>>({});

  const canAccessRestrictionGate = role === 'superadmin' || role === 'admin';
  const canManageRecovery = role === 'superadmin';

  const loadRestrictionState = useCallback(async () => {
    if (!canAccessRestrictionGate) {
      setRestrictionState(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const payload = await fetchWorkspaceRestrictions();
      setRestrictionState(payload);
    } catch (error) {
      const normalized = await normalizeWorkspaceBillingError(
        error,
        'Gagal memuat status pembatasan workspace.',
      );
      setNotice({ tone: 'error', text: `[${normalized.code}] ${normalized.message}` });
    } finally {
      setLoading(false);
    }
  }, [canAccessRestrictionGate]);

  useEffect(() => {
    void loadRestrictionState();
  }, [loadRestrictionState]);

  useEffect(() => {
    const handleRefresh = () => {
      void loadRestrictionState();
    };

    window.addEventListener('workspace:changed', handleRefresh as EventListener);
    window.addEventListener('dashboard:refresh', handleRefresh as EventListener);

    return () => {
      window.removeEventListener('workspace:changed', handleRefresh as EventListener);
      window.removeEventListener('dashboard:refresh', handleRefresh as EventListener);
    };
  }, [loadRestrictionState]);

  const runRecoveryAction = useCallback(
    async (key: string, input: RequestInfo | URL, init: RequestInit) => {
      setPendingKeys((prev) => ({ ...prev, [key]: true }));
      setNotice(null);

      try {
        const response = await workspaceFetch(input, init);
        if (!response.ok) {
          const normalized = await normalizeWorkspaceBillingError(
            response,
            'Gagal memproses pemulihan workspace.',
          );
          setNotice({ tone: 'error', text: `[${normalized.code}] ${normalized.message}` });
          return;
        }

        await Promise.all([loadRestrictionState(), refreshWorkspaceSubscription()]);
        window.dispatchEvent(new CustomEvent('dashboard:refresh'));
        setNotice({ tone: 'success', text: 'Status pembatasan workspace berhasil diperbarui.' });
      } finally {
        setPendingKeys((prev) => {
          const next = { ...prev };
          delete next[key];
          return next;
        });
      }
    },
    [loadRestrictionState],
  );

  const restrictedCopy = useMemo(
    () =>
      restrictionState
        ? getRestrictedWorkspaceOverlayCopy({
            activeDevices: restrictionState.activeDevices,
            activeMembers: restrictionState.activeMembers,
            canManageRecovery,
            overFreeDeviceLimit: restrictionState.overFreeDeviceLimit,
            overFreeMemberLimit: restrictionState.overFreeMemberLimit,
          })
        : null,
    [canManageRecovery, restrictionState],
  );

  if (!canAccessRestrictionGate || loading || !restrictionState?.isRestricted) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[70] bg-zinc-950/45 backdrop-blur-sm">
      <ScrollArea className="h-full w-full">
        <div className="mx-auto flex min-h-screen w-full max-w-7xl items-start justify-center px-4 py-6 md:px-6 md:py-8">
          <div className="w-full space-y-4">
            <Card className="border-amber-300 bg-white shadow-2xl shadow-zinc-950/10">
              <CardHeader>
                <CardTitle>{restrictedCopy?.title}</CardTitle>
                <CardDescription className="mt-2 text-sm leading-6 text-zinc-600">
                  Workspace ini tidak lagi punya entitlement berbayar aktif. Attendance tetap berjalan,
                  tetapi akses dashboard dibatasi sampai jumlah member dan device kembali sesuai batas Free
                  atau superadmin mengaktifkan Pro lagi.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                {notice ? (
                  <div
                    className={cn('rounded-lg border px-3 py-2 text-sm', noticeClass(notice.tone))}
                    role={notice.tone === 'error' ? 'alert' : 'status'}
                  >
                    {notice.text}
                  </div>
                ) : null}

                <div className="grid gap-3 md:grid-cols-4">
                  <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">Member aktif</p>
                    <p className="mt-2 text-2xl font-semibold text-zinc-950">{restrictionState.activeMembers}</p>
                    <p className="mt-1 text-sm text-zinc-600">{restrictedCopy?.memberTargetLabel}</p>
                  </div>
                  <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">Device aktif</p>
                    <p className="mt-2 text-2xl font-semibold text-zinc-950">{restrictionState.activeDevices}</p>
                    <p className="mt-1 text-sm text-zinc-600">{restrictedCopy?.deviceTargetLabel}</p>
                  </div>
                  <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">Status member</p>
                    <p className="mt-2 text-lg font-semibold text-zinc-950">
                      {restrictionState.overFreeMemberLimit ? 'Melebihi batas' : 'Sudah patuh'}
                    </p>
                  </div>
                  <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">Status device</p>
                    <p className="mt-2 text-lg font-semibold text-zinc-950">
                      {restrictionState.overFreeDeviceLimit ? 'Melebihi batas' : 'Sudah patuh'}
                    </p>
                  </div>
                </div>

                <div className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
                  <div className="space-y-4">
                    <div className="rounded-xl border border-zinc-200 bg-white p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h3 className="text-sm font-semibold text-zinc-950">Member aktif</h3>
                          <p className="mt-1 text-sm text-zinc-600">
                            Nonaktifkan member sampai jumlahnya kembali ke 5 aktif atau kurang.
                          </p>
                        </div>
                        <p className="text-xs text-zinc-500">{restrictionState.activeMemberRows.length} baris</p>
                      </div>

                      <div className="mt-4 overflow-hidden rounded-xl border border-zinc-200">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Nama</TableHead>
                              <TableHead>Role</TableHead>
                              <TableHead>Dibuat</TableHead>
                              <TableHead className="text-right">Aksi</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {restrictionState.activeMemberRows.map((row) => {
                              const pending = pendingKeys[`member:${row.userId}`] === true;

                              return (
                                <TableRow key={row.membershipId}>
                                  <TableCell>
                                    <div className="flex flex-col">
                                      <span className="font-medium text-zinc-950">{row.name}</span>
                                      <span className="text-xs text-zinc-500">{row.email}</span>
                                    </div>
                                  </TableCell>
                                  <TableCell>{row.role}</TableCell>
                                  <TableCell>{formatDateTime(row.createdAt)}</TableCell>
                                  <TableCell className="text-right">
                                    {canManageRecovery ? (
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        disabled={row.isCurrentUser || pending}
                                        isLoading={pending}
                                        loadingText="Memproses..."
                                        onClick={() =>
                                          void runRecoveryAction(`member:${row.userId}`, '/api/admin/users', {
                                            method: 'PATCH',
                                            headers: { 'content-type': 'application/json' },
                                            body: JSON.stringify({ userId: row.userId, isActive: false }),
                                          })
                                        }
                                      >
                                        {row.isCurrentUser ? 'Anda' : 'Nonaktifkan'}
                                      </Button>
                                    ) : (
                                      <span className="text-xs text-zinc-500">Read-only</span>
                                    )}
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </div>
                    </div>

                    <div className="rounded-xl border border-zinc-200 bg-white p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h3 className="text-sm font-semibold text-zinc-950">Device aktif</h3>
                          <p className="mt-1 text-sm text-zinc-600">
                            Cabut device sampai jumlahnya kembali ke 1 aktif atau kurang.
                          </p>
                        </div>
                        <p className="text-xs text-zinc-500">{restrictionState.activeDeviceRows.length} baris</p>
                      </div>

                      <div className="mt-4 overflow-hidden rounded-xl border border-zinc-200">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Label</TableHead>
                              <TableHead>Online</TableHead>
                              <TableHead>Last seen</TableHead>
                              <TableHead className="text-right">Aksi</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {restrictionState.activeDeviceRows.map((row) => {
                              const pending = pendingKeys[`device:${row.deviceId}`] === true;

                              return (
                                <TableRow key={row.deviceId}>
                                  <TableCell className="font-medium text-zinc-950">{row.label}</TableCell>
                                  <TableCell>{row.online ? 'Online' : 'Offline'}</TableCell>
                                  <TableCell>{formatDateTime(row.lastSeenAt)}</TableCell>
                                  <TableCell className="text-right">
                                    {canManageRecovery ? (
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        disabled={pending}
                                        isLoading={pending}
                                        loadingText="Memproses..."
                                        onClick={() =>
                                          void runRecoveryAction(
                                            `device:${row.deviceId}`,
                                            `/api/admin/device/devices/${row.deviceId}`,
                                            {
                                              method: 'PATCH',
                                              headers: { 'content-type': 'application/json' },
                                              body: JSON.stringify({ revoke: true }),
                                            },
                                          )
                                        }
                                      >
                                        Cabut akses
                                      </Button>
                                    ) : (
                                      <span className="text-xs text-zinc-500">Read-only</span>
                                    )}
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    {canManageRecovery ? <WorkspaceBillingPanel surface="overlay" /> : null}

                    <Card className="border-zinc-200 bg-zinc-50">
                      <CardHeader>
                        <CardTitle className="text-base">Aksi yang masih diizinkan</CardTitle>
                        <CardDescription>
                          {canManageRecovery
                            ? 'Kurangi member/device dari overlay ini atau aktifkan Pro lagi. Logout juga tetap tersedia.'
                            : 'Anda hanya mendapat akses baca. Minta superadmin menormalkan workspace atau aktifkan Pro lagi.'}
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <Button
                          variant="outline"
                          onClick={() => void signOut({ redirectUrl: '/' })}
                        >
                          Logout
                        </Button>
                      </CardContent>
                    </Card>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}
