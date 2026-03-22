import Image from 'next/image';
import { CheckCircle, ClockCounterClockwise, Receipt, WarningCircle } from '@phosphor-icons/react/dist/ssr';
import { SITE_NAME, SITE_URL } from '@/lib/site-config';
import { cn } from '@/lib/utils';
import type { WorkspaceBillingInvoiceDetailPayload } from '@/types/dashboard';

type WorkspaceInvoiceDocumentProps = {
  detail: WorkspaceBillingInvoiceDetailPayload;
  intent?: 'default' | 'print' | 'download';
};

function formatDateTime(value: number | undefined, timeZone: string) {
  if (!value) {
    return '-';
  }

  return new Date(value).toLocaleString('id-ID', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone,
  });
}

function formatDate(value: number | undefined, timeZone: string) {
  if (!value) {
    return '-';
  }

  return new Date(value).toLocaleDateString('id-ID', {
    dateStyle: 'medium',
    timeZone,
  });
}

function formatCurrencyIdr(value: number) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(value);
}

function getInvoiceStatusLabel(status: WorkspaceBillingInvoiceDetailPayload['invoice']['status']) {
  switch (status) {
    case 'paid':
      return 'Lunas';
    case 'pending':
      return 'Menunggu pembayaran';
    case 'pending_initializing':
      return 'Menyiapkan invoice';
    case 'expired':
      return 'Kedaluwarsa';
    case 'canceled':
      return 'Dibatalkan';
    case 'failed':
      return 'Gagal';
    default:
      return status;
  }
}

function getStatusTone(status: WorkspaceBillingInvoiceDetailPayload['invoice']['status']) {
  switch (status) {
    case 'paid':
      return 'border-emerald-200 bg-emerald-50 text-emerald-800';
    case 'pending':
    case 'pending_initializing':
      return 'border-amber-200 bg-amber-50 text-amber-800';
    case 'expired':
      return 'border-rose-200 bg-rose-50 text-rose-800';
    case 'canceled':
    case 'failed':
      return 'border-zinc-200 bg-zinc-100 text-zinc-700';
    default:
      return 'border-zinc-200 bg-zinc-50 text-zinc-700';
  }
}

function getInvoiceCoverageLabel(detail: WorkspaceBillingInvoiceDetailPayload) {
  const startsAt = detail.invoice.coveredPeriodStartsAt ?? detail.subscription?.currentPeriodStartsAt;
  const endsAt = detail.invoice.coveredPeriodEndsAt ?? detail.subscription?.currentPeriodEndsAt;
  const timeZone = detail.workspace.timezone;

  if (!startsAt || !endsAt) {
    return 'Periode layanan akan muncul setelah invoice aktif atau lunas.';
  }

  return `${formatDate(startsAt, timeZone)} - ${formatDate(endsAt, timeZone)}`;
}

function getStatusSummary(detail: WorkspaceBillingInvoiceDetailPayload) {
  if (detail.invoice.status === 'paid') {
    return {
      icon: CheckCircle,
      label: 'Pembayaran telah diterima dan periode workspace sudah aktif.',
      tone: 'text-emerald-700',
    };
  }

  if (detail.invoice.status === 'pending' || detail.invoice.status === 'pending_initializing') {
    return {
      icon: ClockCounterClockwise,
      label: 'Invoice masih menunggu pembayaran atau sinkronisasi dari provider.',
      tone: 'text-amber-700',
    };
  }

  return {
    icon: WarningCircle,
    label: 'Invoice ini tidak lagi aktif untuk digunakan sebagai checkout berjalan.',
    tone: 'text-rose-700',
  };
}

function MetaItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1">
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500">{label}</p>
      <p className="text-sm font-medium text-zinc-900">{value}</p>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-zinc-200/80 py-3 last:border-b-0 last:pb-0 first:pt-0">
      <span className="text-sm text-zinc-500">{label}</span>
      <span className="max-w-[58%] text-right text-sm font-medium text-zinc-900">{value}</span>
    </div>
  );
}

export function WorkspaceInvoiceDocument({
  detail,
  intent = 'default',
}: WorkspaceInvoiceDocumentProps) {
  const statusSummary = getStatusSummary(detail);
  const StatusSummaryIcon = statusSummary.icon;
  const timeZone = detail.workspace.timezone;
  const issuedMonth = new Date(detail.invoice.issuedAt).toLocaleDateString('id-ID', {
    month: 'long',
    year: 'numeric',
    timeZone,
  });

  return (
    <div className="force-light-vars invoice-page-shell bg-[radial-gradient(circle_at_top_right,rgba(95,87,255,0.12),transparent_28%),linear-gradient(180deg,#f6f8fb_0%,#ffffff_42%)] px-4 py-6 text-zinc-950 md:px-6 md:py-8">
      <div className="invoice-page-grid mx-auto flex w-full max-w-[1120px] flex-col gap-5">
        <section className="invoice-sheet relative overflow-hidden rounded-[28px] border border-zinc-200 bg-white shadow-[0_24px_80px_-42px_rgba(13,13,18,0.35)] print:shadow-none">
          <div className="absolute inset-x-0 top-0 h-1.5 bg-[linear-gradient(90deg,rgba(95,87,255,0.82),rgba(64,196,170,0.74),rgba(95,87,255,0.16))]" />
          <div className="grid gap-10 px-5 pb-6 pt-8 md:px-8 md:pb-8 md:pt-10">
            <div className="grid gap-8 md:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)] md:items-start">
              <div className="space-y-5">
                <div className="inline-flex items-center gap-3 rounded-full border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-zinc-600">
                  <Receipt className="h-4 w-4 text-[var(--color-tagline)]" weight="regular" />
                  Invoice Workspace
                </div>
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <Image
                      alt={`${SITE_NAME} logo`}
                      className="h-11 w-auto"
                      height={44}
                      priority
                      src="/absensiid-logo.svg"
                      width={156}
                    />
                  </div>
                  <div className="max-w-xl space-y-3">
                    <div className="flex flex-wrap items-center gap-3">
                      <h1 className="font-heading text-3xl font-semibold tracking-[-0.04em] text-zinc-950 md:text-[2.7rem]">
                        Invoice {issuedMonth}
                      </h1>
                      <span
                        className={cn(
                          'inline-flex rounded-full border px-3 py-1 text-xs font-semibold',
                          getStatusTone(detail.invoice.status),
                        )}
                      >
                        {getInvoiceStatusLabel(detail.invoice.status)}
                      </span>
                    </div>
                    <p className="max-w-lg text-sm leading-6 text-zinc-600 md:text-[15px]">
                      Ringkasan billing langganan workspace {detail.workspace.name} untuk aktivasi Pro 30 hari melalui Mayar.
                      Detail invoice dirangkum dalam format yang rapi untuk arsip internal, cetak cepat, dan simpan PDF.
                    </p>
                  </div>
                </div>
              </div>

              <div className="relative overflow-hidden rounded-[24px] border border-zinc-200 bg-[linear-gradient(180deg,rgba(250,250,252,0.98),rgba(244,246,250,0.98))] p-5">
                <div className="pointer-events-none absolute inset-x-0 top-0 h-20 bg-[radial-gradient(circle_at_top_right,rgba(95,87,255,0.14),transparent_62%)]" />
                <div className="relative space-y-5">
                  <div className={cn('inline-flex items-center gap-2 text-sm font-medium', statusSummary.tone)}>
                    <StatusSummaryIcon className="h-4 w-4" weight="fill" />
                    {statusSummary.label}
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <MetaItem label="Invoice ID" value={detail.invoice.invoiceId} />
                    <MetaItem label="Plan" value={detail.workspace.plan.toUpperCase()} />
                    <MetaItem label="Dibuat" value={formatDateTime(detail.invoice.issuedAt, timeZone)} />
                    <MetaItem
                      label={detail.invoice.paidAt ? 'Dibayar' : 'Jatuh tempo'}
                      value={detail.invoice.paidAt ? formatDateTime(detail.invoice.paidAt, timeZone) : formatDateTime(detail.invoice.expiresAt, timeZone)}
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
              <section className="rounded-[24px] border border-zinc-200 bg-zinc-50/70 p-5 md:p-6">
                <div className="grid gap-6 md:grid-cols-2">
                  <div className="space-y-4">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500">Ditagihkan kepada</p>
                    <div className="space-y-2 text-sm leading-6 text-zinc-700">
                      <p className="font-heading text-xl font-semibold tracking-[-0.03em] text-zinc-950">
                        {detail.customer?.name ?? detail.workspace.name}
                      </p>
                      <p>{detail.customer?.email ?? 'Email billing belum tersimpan'}</p>
                      <p>{detail.customer?.phone ?? 'Nomor WhatsApp billing belum tersimpan'}</p>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500">Workspace</p>
                    <div className="space-y-2 text-sm leading-6 text-zinc-700">
                      <p className="font-semibold text-zinc-950">{detail.workspace.name}</p>
                      <p>Produk: Workspace Pro 30 hari</p>
                      <p>Website: {SITE_URL}</p>
                    </div>
                  </div>
                </div>
              </section>

              <section className="rounded-[24px] border border-zinc-200 bg-white p-5 md:p-6">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500">Referensi pembayaran</p>
                <div className="mt-4 space-y-1 rounded-[20px] border border-zinc-200 bg-zinc-50 px-4 py-4">
                  <InfoRow label="Referensi Mayar" value={detail.invoice.providerInvoiceId ?? '-'} />
                  <InfoRow label="Transaksi" value={detail.invoice.providerTransactionId ?? '-'} />
                  <InfoRow label="Status provider" value={detail.invoice.providerStatusText ?? getInvoiceStatusLabel(detail.invoice.status)} />
                </div>
              </section>
            </div>

            <div className="grid gap-4 lg:grid-cols-[minmax(0,1.08fr)_minmax(320px,0.92fr)]">
              <section className="rounded-[26px] border border-zinc-200 bg-white p-5 md:p-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500">Rincian layanan</p>
                    <h2 className="mt-2 font-heading text-2xl font-semibold tracking-[-0.03em] text-zinc-950">
                      Rincian aktivasi Workspace Pro
                    </h2>
                  </div>
                  <div className="rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-zinc-600">
                    {intent === 'download' ? 'Mode PDF' : intent === 'print' ? 'Mode Print' : 'Pratinjau'}
                  </div>
                </div>

                <div className="mt-6 overflow-hidden rounded-[22px] border border-zinc-200">
                  <table className="w-full border-collapse text-left text-sm text-zinc-700">
                    <thead className="bg-zinc-50/90 text-zinc-500">
                      <tr>
                        <th className="px-4 py-3 font-semibold">Layanan</th>
                        <th className="px-4 py-3 font-semibold">Periode</th>
                        <th className="px-4 py-3 text-right font-semibold">Jumlah</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-t border-zinc-200">
                        <td className="px-4 py-4 align-top">
                          <div className="space-y-1">
                            <p className="font-semibold text-zinc-950">Workspace Pro 30 hari</p>
                            <p className="text-xs leading-5 text-zinc-500">
                              Aktivasi billing workspace dengan referensi pembayaran Mayar dan histori yang bisa dicetak.
                            </p>
                          </div>
                        </td>
                        <td className="px-4 py-4 align-top text-sm text-zinc-700">{getInvoiceCoverageLabel(detail)}</td>
                        <td className="px-4 py-4 text-right align-top font-semibold text-zinc-950">
                          {formatCurrencyIdr(detail.invoice.amount)}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </section>

              <section className="rounded-[26px] border border-zinc-200 bg-[linear-gradient(180deg,#ffffff_0%,#fafafe_100%)] p-5 md:p-6">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500">Ringkasan biaya</p>
                <div className="mt-5 space-y-1 rounded-[22px] border border-zinc-200 bg-zinc-50/80 px-4 py-4">
                  <InfoRow label="Subtotal" value={formatCurrencyIdr(detail.invoice.amount)} />
                  <InfoRow label="Periode layanan" value={getInvoiceCoverageLabel(detail)} />
                  <InfoRow label="Zona waktu" value={timeZone} />
                </div>

                <div className="mt-4 rounded-[24px] border border-zinc-950 bg-zinc-950 px-5 py-5 text-white">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-300">Total</p>
                  <div className="mt-2 flex items-end justify-between gap-3">
                    <p className="font-heading text-3xl font-semibold tracking-[-0.04em]">
                      {formatCurrencyIdr(detail.invoice.amount)}
                    </p>
                    <p className="text-sm text-zinc-300">{detail.invoice.currency}</p>
                  </div>
                </div>

                <div className="mt-4 rounded-[22px] border border-[rgba(95,87,255,0.14)] bg-[rgba(95,87,255,0.06)] px-4 py-4 text-sm leading-6 text-zinc-700">
                  <p className="font-medium text-zinc-950">Catatan</p>
                  <p className="mt-1">
                    Dokumen ini adalah invoice billing workspace {SITE_NAME}. Ini bukan faktur pajak dan detail legal tambahan belum disertakan pada versi saat ini.
                  </p>
                </div>
              </section>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
