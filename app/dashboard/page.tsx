import { DashboardPageHeader } from '@/components/dashboard/page-header';
import { OverviewPanel } from '@/components/dashboard/overview-panel';

export default function DashboardPage() {
  return (
    <>
      <DashboardPageHeader title="Ringkasan Operasional" />
      <div className="mx-auto w-full max-w-[1400px] px-4 py-4 md:px-6 md:py-6">
        <OverviewPanel />
      </div>
    </>
  );
}
