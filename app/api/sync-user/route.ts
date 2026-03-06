import { auth } from '@clerk/nextjs/server';

import { getConvexTokenOrNull } from '@/lib/auth';
import { syncCurrentUserToConvex } from '@/lib/user-sync';

export async function POST() {
  const { userId } = await auth();
  if (!userId) {
    return Response.json(
      { code: 'UNAUTHENTICATED', message: 'Unauthorized' },
      { status: 401 },
    );
  }

  const token = await getConvexTokenOrNull();
  if (!token) {
    return Response.json(
      { code: 'UNAUTHENTICATED', message: 'Convex token missing' },
      { status: 401 },
    );
  }

  const syncResponse = await syncCurrentUserToConvex(token);
  if (syncResponse) {
    return syncResponse;
  }

  return Response.json({ ok: true });
}
