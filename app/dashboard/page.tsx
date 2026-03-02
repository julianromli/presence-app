import { UserButton } from '@clerk/nextjs';

import { requireRolePage } from '@/lib/auth';

import { DashboardPanel } from './dashboard-panel';

export default async function DashboardPage() {
  const session = await requireRolePage(['admin', 'superadmin']);

  return (
    <div className="container py-10">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Dashboard Admin</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Login role: <span className="font-semibold">{session.role}</span>
          </p>
        </div>
        <UserButton afterSignOutUrl="/" />
      </div>

      <DashboardPanel />
    </div>
  );
}
