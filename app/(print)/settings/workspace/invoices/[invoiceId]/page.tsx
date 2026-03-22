import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { getConvexTokenOrNull, requireWorkspaceRolePageFromDb } from '@/lib/auth';
import { getAuthedConvexHttpClient } from '@/lib/convex-http';
import { SITE_NAME } from '@/lib/site-config';
import { WorkspaceInvoiceDocument } from '@/components/dashboard/workspace-invoice-document';
import { WorkspaceInvoicePrintToolbar } from '@/components/dashboard/workspace-invoice-print-toolbar';
import type { WorkspaceBillingInvoiceDetailPayload } from '@/types/dashboard';

type InvoiceIntent = 'default' | 'print' | 'download';

type WorkspaceInvoicePageProps = {
  params: Promise<{ invoiceId: string }>;
  searchParams: Promise<{ intent?: string | string[] | undefined }>;
};

function resolveIntent(value?: string | string[]): InvoiceIntent {
  const raw = Array.isArray(value) ? value[0] : value;
  if (raw === 'print' || raw === 'download') {
    return raw;
  }

  return 'default';
}

function resolveErrorCode(error: unknown) {
  if (
    typeof error === 'object' &&
    error !== null &&
    'data' in error &&
    typeof (error as { data?: unknown }).data === 'object' &&
    (error as { data?: { code?: unknown } }).data?.code &&
    typeof (error as { data?: { code?: unknown } }).data?.code === 'string'
  ) {
    return (error as { data: { code: string } }).data.code;
  }

  return null;
}

async function loadInvoiceDetail(invoiceId: string, workspaceId: string) {
  const token = await getConvexTokenOrNull();
  if (!token) {
    redirect('/sign-in');
  }

  const convex = getAuthedConvexHttpClient(token);
  if (!convex) {
    throw new Error('Convex URL missing');
  }

  try {
    return await convex.query<WorkspaceBillingInvoiceDetailPayload>(
      'workspaceBilling:getWorkspaceBillingInvoiceDetail',
      { invoiceId, workspaceId },
    );
  } catch (error) {
    if (resolveErrorCode(error) === 'BILLING_INVOICE_NOT_FOUND') {
      notFound();
    }

    throw error;
  }
}

export async function generateMetadata({ params }: WorkspaceInvoicePageProps): Promise<Metadata> {
  const { invoiceId } = await params;

  return {
    title: `Invoice ${invoiceId} | ${SITE_NAME}`,
    robots: {
      index: false,
      follow: false,
    },
  };
}

export default async function WorkspaceInvoicePage({
  params,
  searchParams,
}: WorkspaceInvoicePageProps) {
  const session = await requireWorkspaceRolePageFromDb(['superadmin']);
  const [{ invoiceId }, resolvedSearchParams] = await Promise.all([params, searchParams]);
  const normalizedInvoiceId = invoiceId.trim();

  if (!normalizedInvoiceId) {
    redirect('/settings/workspace');
  }

  const detail = await loadInvoiceDetail(normalizedInvoiceId, session.workspace._id);
  const intent = resolveIntent(resolvedSearchParams.intent);

  return (
    <div className="min-h-screen bg-[#f3f6fb] text-zinc-950">
      <div className="mx-auto flex w-full max-w-[1160px] flex-col gap-5 px-4 py-6 md:px-6 md:py-8">
        <WorkspaceInvoicePrintToolbar
          backHref="/settings/workspace"
          intent={intent}
        />
        <WorkspaceInvoiceDocument detail={detail} intent={intent} />
      </div>
    </div>
  );
}
