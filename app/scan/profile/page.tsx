import { currentUser } from '@clerk/nextjs/server';

import { requireWorkspaceRolePageFromDb } from '@/lib/auth';

import { ProfilePanel } from './profile-panel';

export default async function ProfilePage() {
  const [session, clerkUser] = await Promise.all([
    requireWorkspaceRolePageFromDb(['karyawan']),
    currentUser(),
  ]);

  return (
    <ProfilePanel
      initialProfile={{
        name: session.user.name,
        email: session.user.email,
        role: session.role,
        workspaceName: session.workspace.name,
        imageUrl: clerkUser?.imageUrl ?? null,
      }}
    />
  );
}
