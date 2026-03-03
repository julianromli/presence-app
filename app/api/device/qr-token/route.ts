import { getConvexTokenOrNull, requireRoleApiFromDb } from '@/lib/auth';
import { getAuthedConvexHttpClient } from '@/lib/convex-http';

export async function GET() {
  const result = await requireRoleApiFromDb(['device-qr']);
  if ('error' in result) {
    return result.error;
  }

  const token = await getConvexTokenOrNull();
  if (!token) {
    return Response.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const convex = getAuthedConvexHttpClient(token);
  if (!convex) {
    return Response.json({ message: 'Convex URL missing' }, { status: 500 });
  }

  const issued = await convex.mutation('qrTokens:issue', {});

  return Response.json(issued);
}
