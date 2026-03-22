import type {
  WorkspaceBillingInvoiceStatus,
  WorkspacePlan,
} from '@/types/dashboard';

export const FREE_WORKSPACE_MEMBER_LIMIT = 5;
export const FREE_WORKSPACE_DEVICE_LIMIT = 1;
export const WORKSPACE_PRO_PERIOD_DAYS = 30;

export type WorkspaceRestrictionRole = 'superadmin' | 'admin' | 'karyawan' | 'device-qr';
export type WorkspaceBillingInvoiceIntent = 'print' | 'download';
export type WorkspaceRestrictionAction =
  | 'billing_checkout'
  | 'billing_history'
  | 'billing_refresh'
  | 'billing_summary'
  | 'dashboard_overview'
  | 'device_recovery'
  | 'member_recovery'
  | 'restriction_context';

type DeriveRestrictedExpiredStateArgs = {
  activeDevices: number;
  activeMembers: number;
  hadPaidOrManualEntitlement: boolean;
  plan: WorkspacePlan;
};

type MapMayarInvoiceStatusArgs = {
  expiresAt?: number;
  now?: number;
  providerStatus: string | null | undefined;
};

const SUPERADMIN_ALLOWED_RESTRICTED_ACTIONS = new Set<WorkspaceRestrictionAction>([
  'billing_checkout',
  'billing_history',
  'billing_refresh',
  'billing_summary',
  'device_recovery',
  'member_recovery',
  'restriction_context',
]);

const ADMIN_ALLOWED_RESTRICTED_ACTIONS = new Set<WorkspaceRestrictionAction>([
  'restriction_context',
]);

export function deriveRestrictedExpiredState({
  activeDevices,
  activeMembers,
  hadPaidOrManualEntitlement,
  plan,
}: DeriveRestrictedExpiredStateArgs) {
  const overFreeMemberLimit = activeMembers > FREE_WORKSPACE_MEMBER_LIMIT;
  const overFreeDeviceLimit = activeDevices > FREE_WORKSPACE_DEVICE_LIMIT;

  return {
    isRestricted:
      plan === 'free' &&
      hadPaidOrManualEntitlement &&
      (overFreeMemberLimit || overFreeDeviceLimit),
    overFreeDeviceLimit,
    overFreeMemberLimit,
  };
}

export function isBillingActionAllowedDuringRestriction(
  role: WorkspaceRestrictionRole,
  action: WorkspaceRestrictionAction,
) {
  if (role === 'superadmin') {
    return SUPERADMIN_ALLOWED_RESTRICTED_ACTIONS.has(action);
  }

  if (role === 'admin') {
    return ADMIN_ALLOWED_RESTRICTED_ACTIONS.has(action);
  }

  return false;
}

export function mapMayarInvoiceStatus({
  expiresAt,
  now = Date.now(),
  providerStatus,
}: MapMayarInvoiceStatusArgs): WorkspaceBillingInvoiceStatus {
  const normalizedStatus = providerStatus?.trim().toLowerCase();

  if (normalizedStatus === 'paid') {
    return 'paid';
  }

  if (
    normalizedStatus === 'closed' ||
    normalizedStatus === 'canceled' ||
    normalizedStatus === 'cancelled'
  ) {
    return 'canceled';
  }

  if (normalizedStatus === 'failed') {
    return 'failed';
  }

  if (
    normalizedStatus === 'unpaid' ||
    normalizedStatus === 'created' ||
    normalizedStatus === 'open' ||
    normalizedStatus === 'active' ||
    normalizedStatus === undefined
  ) {
    if (typeof expiresAt === 'number' && expiresAt <= now) {
      return 'expired';
    }

    return 'pending';
  }

  if (typeof expiresAt === 'number' && expiresAt <= now) {
    return 'expired';
  }

  return 'failed';
}

export function buildRestrictedWorkspaceMessage() {
  return 'Dashboard diblokir sampai workspace kembali patuh ke batas paket Free atau mengaktifkan paket berbayar lagi.';
}

export function buildWorkspaceBillingInvoiceHref(
  invoiceId: string,
  intent?: WorkspaceBillingInvoiceIntent,
) {
  const basePath = `/settings/workspace/invoices/${encodeURIComponent(invoiceId)}`;
  if (!intent) {
    return basePath;
  }

  return `${basePath}?intent=${intent}`;
}
