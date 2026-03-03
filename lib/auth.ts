import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';

import { getAuthedConvexHttpClient } from '@/lib/convex-http';

export const APP_ROLES = ['superadmin', 'admin', 'karyawan', 'device-qr'] as const;
export type AppRole = (typeof APP_ROLES)[number];

export type DbUserSession = {
  _id: string;
  name: string;
  email: string;
  role: AppRole;
  isActive: boolean;
  clerkUserId: string;
  createdAt: number;
  updatedAt: number;
  _creationTime: number;
};

function forbiddenResponse() {
  return new Response(JSON.stringify({ message: 'Forbidden' }), { status: 403 });
}

function unauthorizedResponse() {
  return new Response(JSON.stringify({ message: 'Unauthorized' }), { status: 401 });
}

export async function getConvexTokenOrNull() {
  const session = await auth();
  if (!session.userId) {
    return null;
  }

  return (await session.getToken({ template: 'convex' })) ?? null;
}

async function getCurrentDbUserFromConvex(): Promise<DbUserSession | null> {
  const token = await getConvexTokenOrNull();
  if (!token) {
    return null;
  }

  const convex = getAuthedConvexHttpClient(token);
  if (!convex) {
    return null;
  }

  try {
    const user = await convex.query<DbUserSession | null>('users:me', {});
    return user;
  } catch {
    return null;
  }
}

export async function getCurrentSession() {
  const session = await auth();
  const dbUser = await getCurrentDbUserFromConvex();

  return {
    userId: session.userId,
    role: dbUser?.role ?? null,
    user: dbUser,
  };
}

export async function requireUser() {
  const session = await getCurrentSession();
  if (!session.userId || !session.user) {
    return null;
  }
  return session;
}

export async function requireRolePageFromDb(roles: AppRole[]) {
  const session = await auth();
  if (!session.userId) {
    redirect('/sign-in');
  }

  const current = await requireUser();
  if (!current || !current.role || !roles.includes(current.role)) {
    redirect('/forbidden');
  }

  return current;
}

export async function requireRoleApiFromDb(roles: AppRole[]) {
  const clerkSession = await auth();
  if (!clerkSession.userId) {
    return { error: unauthorizedResponse() };
  }

  const session = await requireUser();
  if (!session || !session.role) {
    return { error: forbiddenResponse() };
  }

  if (!roles.includes(session.role)) {
    return { error: forbiddenResponse() };
  }

  return { session };
}

export const requireRolePage = requireRolePageFromDb;
export const requireRoleApi = requireRoleApiFromDb;
