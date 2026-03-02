import { auth, currentUser } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';

export const APP_ROLES = ['superadmin', 'admin', 'karyawan', 'device-qr'] as const;

export type AppRole = (typeof APP_ROLES)[number];

function isAppRole(role: unknown): role is AppRole {
  return typeof role === 'string' && (APP_ROLES as readonly string[]).includes(role);
}

export async function getCurrentSession() {
  const { userId, sessionClaims } = await auth();
  const user = userId ? await currentUser() : null;

  const metadata = sessionClaims?.metadata as { role?: string } | undefined;
  const role = isAppRole(metadata?.role) ? metadata.role : 'karyawan';

  return {
    userId,
    role,
    user,
  };
}

export async function requireUser() {
  const session = await getCurrentSession();
  if (!session.userId) {
    return null;
  }
  return session;
}

export async function requireRolePage(roles: AppRole[]) {
  const session = await getCurrentSession();
  if (!session.userId) {
    redirect('/sign-in');
  }

  if (!roles.includes(session.role)) {
    redirect('/');
  }

  return session;
}

export async function requireRoleApi(roles: AppRole[]) {
  const session = await requireUser();
  if (!session) {
    return { error: new Response(JSON.stringify({ message: 'Unauthorized' }), { status: 401 }) };
  }

  if (!roles.includes(session.role)) {
    return { error: new Response(JSON.stringify({ message: 'Forbidden' }), { status: 403 }) };
  }

  return { session };
}
