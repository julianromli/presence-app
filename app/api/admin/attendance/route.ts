import { auth } from '@clerk/nextjs/server';

import { getConvexHttpClient } from '@/lib/convex-http';
import { requireRoleApi } from '@/lib/auth';

export async function GET(req: Request) {
  const role = await requireRoleApi(['admin', 'superadmin']);
  if ('error' in role) return role.error;

  const { userId } = await auth();
  if (!userId) {
    return Response.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const dateKey = new URL(req.url).searchParams.get('dateKey');
  if (!dateKey) {
    return Response.json({ message: 'dateKey wajib' }, { status: 400 });
  }

  const convex = getConvexHttpClient();
  if (!convex) return Response.json({ message: 'Convex URL missing' }, { status: 500 });

  const rows = await convex.mutation('attendance:listByDateByClerk', {
    clerkUserId: userId,
    dateKey,
  });

  return Response.json(rows);
}
