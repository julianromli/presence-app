import { DashboardPageHeader } from '@/components/dashboard/page-header';
import { ReportPanel } from '@/components/dashboard/report-panel';

export default function DashboardReportPage() {
  return (
    <>
      <DashboardPageHeader title="Manajemen Laporan" />
      <div className="mx-auto w-full max-w-[1400px] px-4 py-4 md:px-6 md:py-6">
        <ReportPanel />
      </div>
    </>
  );
}
