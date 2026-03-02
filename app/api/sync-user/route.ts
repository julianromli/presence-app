import { auth, currentUser } from '@clerk/nextjs/server';

import { getConvexHttpClient } from '@/lib/convex-http';

export async function POST() {
  const { userId } = await auth();
  if (!userId) {
    return Response.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const user = await currentUser();
  if (!user) {
    return Response.json({ message: 'User not found' }, { status: 404 });
  }

  const convex = getConvexHttpClient();
  if (!convex) {
    return Response.json({ message: 'Convex URL missing, skip sync' }, { status: 200 });
  }

  const metadataRole = user.publicMetadata?.role;
  const role =
    metadataRole === 'superadmin' ||
    metadataRole === 'admin' ||
    metadataRole === 'device-qr' ||
    metadataRole === 'karyawan'
      ? metadataRole
      : 'karyawan';

  await convex.mutation('users:upsertFromClerk', {
    clerkUserId: user.id,
    name: [user.firstName, user.lastName].filter(Boolean).join(' ') || user.username || 'Unknown',
    email: user.primaryEmailAddress?.emailAddress ?? `${user.id}@unknown.local`,
    role,
  });

  return Response.json({ ok: true });
}
