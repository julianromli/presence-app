import { auth } from '@clerk/nextjs/server';

import { getConvexHttpClient } from '@/lib/convex-http';
import { requireRoleApi } from '@/lib/auth';

export async function GET() {
  const result = await requireRoleApi(['device-qr']);
  if ('error' in result) {
    return result.error;
  }

  const { userId } = await auth();
  if (!userId) {
    return Response.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const convex = getConvexHttpClient();
  if (!convex) {
    return Response.json({ message: 'Convex URL missing' }, { status: 500 });
  }

  const issued = await convex.mutation('qrTokens:issueForDevice', {
    clerkUserId: userId,
  });

  return Response.json(issued);
}
