import Link from 'next/link';
import { FileX, ArrowLeft, House } from '@phosphor-icons/react/dist/ssr';
import { Button } from '@/components/ui/button';

export default function WorkspaceInvoiceNotFoundPage() {
  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#f5f7fb_0%,#ffffff_38%)] px-4 py-10 text-zinc-950 md:px-6 md:py-14">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
        <div className="rounded-[28px] border border-zinc-200 bg-white p-6 shadow-[0_24px_80px_-42px_rgba(13,13,18,0.35)] md:p-8">
          <div className="inline-flex items-center gap-3 rounded-full border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-zinc-600">
            <FileX className="h-4 w-4 text-rose-600" weight="regular" />
            Invoice Workspace
          </div>

          <div className="mt-6 max-w-2xl space-y-3">
            <h1 className="font-heading text-3xl font-semibold tracking-[-0.04em] text-zinc-950 md:text-4xl">
              Invoice tidak ditemukan
            </h1>
            <p className="text-sm leading-6 text-zinc-600 md:text-[15px]">
              Invoice yang kamu cari sudah tidak tersedia, tidak termasuk workspace aktif, atau tautannya sudah tidak valid.
              Silakan kembali ke billing workspace untuk membuka invoice lain.
            </p>
          </div>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Button render={<Link href="/settings/workspace" />}>
              <ArrowLeft className="h-4 w-4" weight="regular" />
              Kembali ke Billing Workspace
            </Button>
            <Button render={<Link href="/dashboard" />} variant="outline">
              <House className="h-4 w-4" weight="regular" />
              Kembali ke Dashboard
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
