'use client';

import { useEffect, useRef } from 'react';
import { DownloadSimple, Printer, ArrowLeft } from '@phosphor-icons/react/dist/ssr';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

type WorkspaceInvoicePrintToolbarProps = {
  backHref?: string;
  intent?: 'default' | 'print' | 'download';
};

export function WorkspaceInvoicePrintToolbar({
  backHref = '/settings/workspace',
  intent = 'default',
}: WorkspaceInvoicePrintToolbarProps) {
  const hasTriggeredPrintRef = useRef(false);

  useEffect(() => {
    if (intent === 'default' || hasTriggeredPrintRef.current) {
      return;
    }

    hasTriggeredPrintRef.current = true;
    const timeoutId = window.setTimeout(() => {
      window.print();
    }, 180);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [intent]);

  return (
    <div className="invoice-toolbar print:hidden">
      <div className="flex flex-wrap items-center gap-2">
        <Button render={<Link href={backHref} />} size="sm" variant="outline">
          <ArrowLeft className="h-4 w-4" weight="regular" />
          Kembali
        </Button>
        <Button size="sm" variant="outline" onClick={() => window.print()}>
          <Printer className="h-4 w-4" weight="regular" />
          Print
        </Button>
        <Button size="sm" onClick={() => window.print()}>
          <DownloadSimple className="h-4 w-4" weight="regular" />
          Download PDF
        </Button>
      </div>
      <p className="text-xs text-zinc-500">
        {intent === 'download'
          ? 'Dialog print dibuka otomatis. Pilih Save as PDF untuk mengunduh invoice.'
          : 'Gunakan print browser untuk mencetak atau menyimpan invoice sebagai PDF.'}
      </p>
    </div>
  );
}
