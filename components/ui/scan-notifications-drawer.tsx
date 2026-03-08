'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  Bell,
  CaretRight,
  Info,
  CheckCircle,
  WarningCircle,
  WarningDiamond,
} from '@phosphor-icons/react';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Sheet,
  SheetClose,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetPanel,
  SheetPopup,
  SheetTitle,
} from '@/components/ui/sheet';
import { normalizeClientError, parseApiErrorResponse } from '@/lib/client-error';
import type { ApiErrorInfo } from '@/lib/client-error';
import { buildNotificationActionHref } from '@/lib/notification-navigation';
import { cn } from '@/lib/utils';
import { workspaceFetch } from '@/lib/workspace-client';
import type {
  EmployeeNotificationItem,
  EmployeeNotificationReadPayload,
  EmployeeNotificationsPayload,
} from '@/types/notifications';

type NotificationsStatus = 'loading' | 'ready' | 'error';

export type ScanNotificationsController = {
  status: NotificationsStatus;
  notifications: EmployeeNotificationItem[];
  unreadCount: number;
  error: ApiErrorInfo | null;
  refresh: () => Promise<void>;
  markRead: (notificationId: string) => Promise<void>;
  markAllRead: () => Promise<void>;
};

async function fetchNotifications(limit = 20) {
  try {
    const response = await workspaceFetch(`/api/karyawan/notifications?limit=${limit}`, {
      cache: 'no-store',
    });

    if (!response.ok) {
      throw await parseApiErrorResponse(response, 'Gagal memuat notifikasi.');
    }

    return (await response.json()) as EmployeeNotificationsPayload;
  } catch (error) {
    throw await normalizeClientError(error, 'Gagal memuat notifikasi.');
  }
}

async function requestMarkRead(notificationId: string) {
  try {
    const response = await workspaceFetch('/api/karyawan/notifications/read', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notificationId }),
    });

    if (!response.ok) {
      throw await parseApiErrorResponse(response, 'Gagal menandai notifikasi sebagai dibaca.');
    }

    return (await response.json()) as EmployeeNotificationReadPayload;
  } catch (error) {
    throw await normalizeClientError(error, 'Gagal menandai notifikasi sebagai dibaca.');
  }
}

async function requestMarkAllRead(beforeTs: number) {
  try {
    const response = await workspaceFetch('/api/karyawan/notifications/read-all', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ beforeTs }),
    });

    if (!response.ok) {
      throw await parseApiErrorResponse(response, 'Gagal menandai semua notifikasi sebagai dibaca.');
    }

    return (await response.json()) as EmployeeNotificationReadPayload;
  } catch (error) {
    throw await normalizeClientError(error, 'Gagal menandai semua notifikasi sebagai dibaca.');
  }
}

function formatRelativeTime(timestamp: number) {
  const diffMs = timestamp - Date.now();
  const diffMinutes = Math.round(diffMs / 60000);
  const rtf = new Intl.RelativeTimeFormat('id-ID', { numeric: 'auto' });

  if (Math.abs(diffMinutes) < 60) {
    return rtf.format(diffMinutes, 'minute');
  }

  const diffHours = Math.round(diffMinutes / 60);
  if (Math.abs(diffHours) < 24) {
    return rtf.format(diffHours, 'hour');
  }

  const diffDays = Math.round(diffHours / 24);
  return rtf.format(diffDays, 'day');
}

function notificationIcon(item: EmployeeNotificationItem) {
  if (item.severity === 'critical') {
    return <WarningDiamond className="w-5 h-5 text-rose-600" weight="fill" />;
  }
  if (item.type === 'attendance_success') {
    return <CheckCircle className="w-5 h-5 text-emerald-600" weight="fill" />;
  }
  if (item.type === 'attendance_failure' || item.type === 'attendance_reminder') {
    return <WarningCircle className="w-5 h-5 text-amber-600" weight="fill" />;
  }
  return <Info className="w-5 h-5 text-sky-600" weight="fill" />;
}

function actionLabel(item: EmployeeNotificationItem) {
  if (item.actionType === 'open_scan') return 'Buka Scan';
  if (item.actionType === 'open_history' || item.actionType === 'open_history_day') {
    return 'Buka Riwayat';
  }
  return null;
}

function optimisticMarkRead(
  payload: EmployeeNotificationsPayload | null,
  notificationId: string,
  readAt: number,
) {
  if (!payload) {
    return payload;
  }

  let unreadDelta = 0;
  const items = payload.items.map((item) => {
    if (item.notificationId !== notificationId || item.readAt !== undefined) {
      return item;
    }
    unreadDelta = 1;
    return { ...item, readAt };
  });

  return {
    ...payload,
    items,
    unreadCount: Math.max(0, payload.unreadCount - unreadDelta),
  };
}

function optimisticMarkAllRead(payload: EmployeeNotificationsPayload | null, readAt: number) {
  if (!payload) {
    return payload;
  }

  return {
    ...payload,
    items: payload.items.map((item) =>
      item.readAt === undefined ? { ...item, readAt } : item,
    ),
    unreadCount: 0,
  };
}

export function useScanNotifications(limit = 20): ScanNotificationsController {
  const [status, setStatus] = React.useState<NotificationsStatus>('loading');
  const [payload, setPayload] = React.useState<EmployeeNotificationsPayload | null>(null);
  const [error, setError] = React.useState<ApiErrorInfo | null>(null);
  const latestRefreshRef = React.useRef(0);

  const refresh = React.useCallback(async () => {
    const requestId = ++latestRefreshRef.current;
    setStatus('loading');
    setError(null);

    try {
      const nextPayload = await fetchNotifications(limit);
      if (requestId !== latestRefreshRef.current) {
        return;
      }
      setPayload(nextPayload);
      setStatus('ready');
    } catch (nextError) {
      if (requestId !== latestRefreshRef.current) {
        return;
      }
      setError(nextError as ApiErrorInfo);
      setStatus('error');
    }
  }, [limit]);

  React.useEffect(() => {
    return () => {
      latestRefreshRef.current += 1;
    };
  }, []);

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  React.useEffect(() => {
    const handleRefresh = () => {
      void refresh();
    };

    window.addEventListener('dashboard:refresh', handleRefresh as EventListener);
    return () => window.removeEventListener('dashboard:refresh', handleRefresh as EventListener);
  }, [refresh]);

  const markRead = React.useCallback(async (notificationId: string) => {
    const optimisticReadAt = Date.now();
    latestRefreshRef.current += 1;
    React.startTransition(() => {
      setPayload((current) => optimisticMarkRead(current, notificationId, optimisticReadAt));
    });

    try {
      const next = await requestMarkRead(notificationId);
      latestRefreshRef.current += 1;
      React.startTransition(() => {
        setPayload((current) => {
          const optimistic = optimisticMarkRead(current, notificationId, next.readAt);
          return optimistic
            ? { ...optimistic, unreadCount: next.unreadCount }
            : optimistic;
        });
      });
    } catch (nextError) {
      await refresh();
      throw nextError;
    }
  }, [refresh]);

  const markAllRead = React.useCallback(async () => {
    const optimisticReadAt = Date.now();
    latestRefreshRef.current += 1;
    React.startTransition(() => {
      setPayload((current) => optimisticMarkAllRead(current, optimisticReadAt));
    });

    try {
      const next = await requestMarkAllRead(optimisticReadAt);
      latestRefreshRef.current += 1;
      React.startTransition(() => {
        setPayload((current) => {
          const optimistic = optimisticMarkAllRead(current, next.readAt);
          return optimistic
            ? { ...optimistic, unreadCount: next.unreadCount }
            : optimistic;
        });
      });
    } catch (nextError) {
      await refresh();
      throw nextError;
    }
  }, [refresh]);

  return {
    status,
    notifications: payload?.items ?? [],
    unreadCount: payload?.unreadCount ?? 0,
    error,
    refresh,
    markRead,
    markAllRead,
  };
}

interface ScanNotificationsDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  controller: ScanNotificationsController;
}

function NotificationCard({
  item,
  onOpen,
}: {
  item: EmployeeNotificationItem;
  onOpen: (item: EmployeeNotificationItem) => void;
}) {
  const cta = actionLabel(item);

  return (
    <button
      type="button"
      className={cn(
        'relative w-full rounded-3xl border p-4 text-left transition-all active:scale-[0.99]',
        item.readAt === undefined
          ? 'border-primary/15 bg-primary/[0.03] shadow-sm'
          : 'border-border/60 bg-background'
      )}
      onClick={() => onOpen(item)}
    >
      <div className="flex items-start gap-4">
        <div
          className={cn(
            'mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border',
            item.readAt === undefined
              ? 'border-primary/10 bg-background'
              : 'border-border/60 bg-secondary/60'
          )}
        >
          {notificationIcon(item)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h4 className="text-sm font-semibold text-foreground">{item.title}</h4>
              <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                {item.description}
              </p>
            </div>
            <span className="shrink-0 text-[11px] font-medium text-muted-foreground">
              {formatRelativeTime(item.createdAt)}
            </span>
          </div>

          <div className="mt-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              {item.readAt === undefined ? (
                <span className="inline-flex h-2.5 w-2.5 rounded-full bg-primary" />
              ) : (
                <span className="inline-flex text-[11px] font-medium text-muted-foreground">
                  Dibaca
                </span>
              )}
            </div>
            {cta ? (
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-primary">
                {cta}
                <CaretRight className="h-3.5 w-3.5" />
              </span>
            ) : null}
          </div>
        </div>
      </div>
    </button>
  );
}

export function ScanNotificationsDrawer({
  open,
  onOpenChange,
  controller,
}: ScanNotificationsDrawerProps) {
  const router = useRouter();
  const [actionError, setActionError] = React.useState<ApiErrorInfo | null>(null);

  const attentionItems = React.useMemo(
    () =>
      controller.notifications.filter(
        (item) => item.severity === 'warning' || item.severity === 'critical',
      ),
    [controller.notifications],
  );
  const latestItems = React.useMemo(
    () =>
      controller.notifications.filter(
        (item) => item.severity !== 'warning' && item.severity !== 'critical',
      ),
    [controller.notifications],
  );

  const openNotification = React.useCallback(
    async (item: EmployeeNotificationItem) => {
      setActionError(null);

      try {
        if (item.readAt === undefined) {
          await controller.markRead(item.notificationId);
        }
      } catch (nextError) {
        setActionError(nextError as ApiErrorInfo);
        return;
      }

      const href = buildNotificationActionHref(item.actionType, item.actionPayload);
      if (href) {
        router.push(href);
        onOpenChange(false);
      }
    },
    [controller, onOpenChange, router],
  );

  const handleMarkAllRead = React.useCallback(async () => {
    setActionError(null);
    try {
      await controller.markAllRead();
    } catch (nextError) {
      setActionError(nextError as ApiErrorInfo);
    }
  }, [controller]);

  const showLoading = controller.status === 'loading' && controller.notifications.length === 0;
  const showError = controller.status === 'error' && controller.notifications.length === 0;
  const showEmpty =
    controller.status !== 'loading' &&
    controller.notifications.length === 0 &&
    !controller.error;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetPopup side="top" className="mx-auto h-[85vh] max-w-md overflow-hidden rounded-b-[28px]">
        <SheetHeader className="border-b border-border/50 pb-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2">
              <SheetTitle className="text-xl font-bold">Notifikasi</SheetTitle>
              {controller.unreadCount > 0 ? (
                <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold text-primary-foreground">
                  {controller.unreadCount > 99 ? '99+' : controller.unreadCount} baru
                </span>
              ) : null}
            </div>
            {controller.unreadCount > 0 ? (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 p-1 text-xs font-semibold text-primary"
                onClick={() => void handleMarkAllRead()}
              >
                Baca semua
              </Button>
            ) : null}
          </div>
          <SheetDescription className="text-xs">
            Fokus pada hasil scan, reminder absensi, dan info operasional yang relevan.
          </SheetDescription>
        </SheetHeader>

        <SheetPanel className="flex-1 space-y-5 overflow-y-auto p-4">
          {actionError ? (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
              [{actionError.code}] {actionError.message}
            </div>
          ) : null}

          {showLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="rounded-3xl border border-border/60 p-4">
                  <div className="flex gap-4">
                    <Skeleton className="h-10 w-10 rounded-full" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-40" />
                      <Skeleton className="h-3 w-full" />
                      <Skeleton className="h-3 w-32" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : null}

          {showError && controller.error ? (
            <div className="rounded-3xl border border-rose-200 bg-rose-50 p-5">
              <p className="text-sm font-semibold text-rose-900">Notifikasi tidak bisa dimuat</p>
              <p className="mt-1 text-sm text-rose-800">
                [{controller.error.code}] {controller.error.message}
              </p>
              <Button className="mt-4 rounded-full" variant="outline" onClick={() => void controller.refresh()}>
                Coba lagi
              </Button>
            </div>
          ) : null}

          {showEmpty ? (
            <div className="flex h-full flex-col items-center justify-center py-20 text-center opacity-70">
              <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-secondary">
                <Bell className="h-10 w-10 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-bold text-foreground">Belum ada notifikasi baru</h3>
              <p className="mt-2 max-w-[220px] text-sm text-muted-foreground">
                Hasil scan dan reminder penting akan muncul di sini.
              </p>
            </div>
          ) : null}

          {!showLoading && controller.notifications.length > 0 ? (
            <>
              {attentionItems.length > 0 ? (
                <section className="space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-amber-800">
                      Perlu perhatian
                    </span>
                  </div>
                  {attentionItems.map((item) => (
                    <NotificationCard
                      key={item.notificationId}
                      item={item}
                      onOpen={(nextItem) => void openNotification(nextItem)}
                    />
                  ))}
                </section>
              ) : null}

              {latestItems.length > 0 ? (
                <section className="space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-secondary px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                      Terbaru
                    </span>
                  </div>
                  {latestItems.map((item) => (
                    <NotificationCard
                      key={item.notificationId}
                      item={item}
                      onOpen={(nextItem) => void openNotification(nextItem)}
                    />
                  ))}
                </section>
              ) : null}
            </>
          ) : null}
        </SheetPanel>

        <SheetFooter className="rounded-b-[28px] border-t border-border/40 p-4">
          <SheetClose
            render={
              <Button className="h-12 w-full rounded-xl font-bold shadow-lg shadow-primary/20">
                Tutup
              </Button>
            }
          />
        </SheetFooter>
      </SheetPopup>
    </Sheet>
  );
}
