import { DashboardLayout } from '@/components/dashboard/layout';

type DashboardAppShellProps = {
  role: string;
  name: string;
  email: string;
  children: React.ReactNode;
};

export function DashboardAppShell({ role, name, email, children }: DashboardAppShellProps) {
  return <DashboardLayout role={role} name={name} email={email}>{children}</DashboardLayout>;
}
