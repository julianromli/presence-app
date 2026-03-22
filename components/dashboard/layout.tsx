import { DashboardHeader } from '@/components/dashboard/header';
import { MobileBottomNav } from '@/components/dashboard/mobile-bottom-nav';
import { WorkspaceRestrictedGate } from '@/components/dashboard/workspace-restricted-gate';
import { DashboardSidebar } from '@/components/dashboard/sidebar';
import { SidebarProvider } from '@/components/providers/sidebar-provider';
import { WorkspaceHubProvider } from '@/components/dashboard/workspace-hub-provider';
import { TallyPopupTrigger } from '@/components/dashboard/tally-popup-trigger';
import Script from 'next/script';

type DashboardLayoutProps = {
  role?: string;
  name?: string;
  email?: string;
  children: React.ReactNode;
};

export function DashboardLayout({ role = 'karyawan', name = 'Guest', email = 'guest@example.com', children }: DashboardLayoutProps) {
  return (
    <SidebarProvider>
      <WorkspaceHubProvider>
        <>
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
          <WorkspaceRestrictedGate role={role} />
          <TallyPopupTrigger />
          <Script id="tally-widget" src="https://tally.so/widgets/embed.js" strategy="afterInteractive" />
        </>
      </WorkspaceHubProvider>
    </SidebarProvider>
  );
}
