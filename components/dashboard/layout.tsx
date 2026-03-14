import { DashboardHeader } from '@/components/dashboard/header';
import { MobileBottomNav } from '@/components/dashboard/mobile-bottom-nav';
import { DashboardSidebar } from '@/components/dashboard/sidebar';
import { SidebarProvider } from '@/components/providers/sidebar-provider';

type DashboardLayoutProps = {
  role?: string;
  name?: string;
  email?: string;
  children: React.ReactNode;
};

export function DashboardLayout({ role = 'karyawan', name = 'Guest', email = 'guest@example.com', children }: DashboardLayoutProps) {
  return (
    <SidebarProvider>
      <div className="flex min-h-[100dvh] w-full flex-col overflow-hidden bg-white text-zinc-900 selection:bg-indigo-100 selection:text-indigo-900">
        <DashboardHeader role={role} name={name} email={email} />
        <div className="flex min-h-0 flex-1 overflow-hidden">
          <DashboardSidebar role={role} name={name} email={email} />
          <main className="min-h-0 flex-1 overflow-y-auto bg-white">
            <div className="h-full pb-28 md:pb-0">{children}</div>
          </main>
        </div>
        <MobileBottomNav role={role} name={name} email={email} />
      </div>
    </SidebarProvider>
  );
}
