import { UserButton } from '@clerk/nextjs';

import { requireRolePage } from '@/lib/auth';

export default async function DashboardPage() {
  const session = await requireRolePage(['admin', 'superadmin']);

  return (
    <div className="container py-10">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-bold">Dashboard Admin</h1>
        <UserButton afterSignOutUrl="/" />
      </div>
      <p className="text-muted-foreground">
        Anda login sebagai <span className="font-semibold">{session.role}</span>.
        Halaman ini hanya untuk role admin/superadmin.
      </p>
    </div>
  );
}
