import { DashboardSidebar } from '@/components/dashboard/sidebar';
import { DashboardTopbar } from '@/components/dashboard/topbar';
import { MobileBottomNav } from '@/components/dashboard/mobile-bottom-nav';

type DashboardAppShellProps = {
  role: string;
  name: string;
  email: string;
  children: React.ReactNode;
};

export function DashboardAppShell({ role, name, email, children }: DashboardAppShellProps) {
  return (
    <div className="min-h-[100dvh] bg-gradient-to-b from-slate-50 to-slate-100 text-slate-900">
      <div className="flex min-h-[100dvh]">
        <DashboardSidebar role={role} name={name} email={email} />
        <div className="flex min-w-0 flex-1 flex-col">
          <DashboardTopbar />
          <main className="flex-1 p-4 pb-24 md:p-6 md:pb-6">
            <div className="mx-auto w-full max-w-[1400px]">{children}</div>
          </main>
        </div>
      </div>
      <MobileBottomNav role={role} name={name} email={email} />
    </div>
  );
}
