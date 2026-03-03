import { auth, currentUser } from '@clerk/nextjs/server';

import { getConvexTokenOrNull } from '@/lib/auth';
import { getAuthedConvexHttpClient } from '@/lib/convex-http';

export async function POST() {
  const { userId } = await auth();
  if (!userId) {
    return Response.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const user = await currentUser();
  if (!user) {
    return Response.json({ message: 'User not found' }, { status: 404 });
  }

  const token = await getConvexTokenOrNull();
  if (!token) {
    return Response.json({ message: 'Convex token missing' }, { status: 401 });
  }
  const convex = getAuthedConvexHttpClient(token);
  if (!convex) {
    return Response.json({ message: 'Convex URL missing, skip sync' }, { status: 200 });
  }

  await convex.mutation('users:upsertFromClerk', {
    name: [user.firstName, user.lastName].filter(Boolean).join(' ') || user.username || 'Unknown',
    email: user.primaryEmailAddress?.emailAddress ?? `${user.id}@unknown.local`,
  });

  return Response.json({ ok: true });
}
