import { DashboardHeader } from '@/components/dashboard/header';
import { MobileBottomNav } from '@/components/dashboard/mobile-bottom-nav';
import { DashboardSidebar } from '@/components/dashboard/sidebar';

type DashboardLayoutProps = {
  role: string;
  name: string;
  email: string;
  children: React.ReactNode;
};

export function DashboardLayout({ role, name, email, children }: DashboardLayoutProps) {
  return (
    <div className="flex min-h-[100dvh] w-full flex-col overflow-hidden bg-zinc-50 text-zinc-900">
      <DashboardHeader role={role} name={name} email={email} />
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <DashboardSidebar role={role} name={name} email={email} />
        <main className="min-h-0 flex-1 overflow-y-auto">
          <div className="pb-24 md:pb-0">{children}</div>
        </main>
      </div>
      <MobileBottomNav role={role} name={name} email={email} />
    </div>
  );
}
