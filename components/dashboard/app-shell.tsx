import { DashboardSidebar } from '@/components/dashboard/sidebar';
import { DashboardTopbar } from '@/components/dashboard/topbar';

type DashboardAppShellProps = {
  role: string;
  name: string;
  email: string;
  children: React.ReactNode;
};

export function DashboardAppShell({ role, name, email, children }: DashboardAppShellProps) {
  return (
    <div className="min-h-[100dvh] bg-slate-50 text-slate-900">
      <div className="flex min-h-[100dvh]">
        <DashboardSidebar role={role} name={name} email={email} />
        <div className="flex min-w-0 flex-1 flex-col">
          <DashboardTopbar />
          <main className="flex-1 p-4 md:p-6">{children}</main>
        </div>
      </div>
    </div>
  );
}