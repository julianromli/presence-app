import { requireRoleApiFromDb } from '@/lib/auth';
import { getConvexTokenOrNull } from '@/lib/auth';
import { convexErrorResponse } from '@/lib/api-error';
import { getAuthedConvexHttpClient } from '@/lib/convex-http';

export async function POST(req: Request) {
  const result = await requireRoleApiFromDb(['device-qr']);
  if ('error' in result) {
    return result.error;
  }

  const token = await getConvexTokenOrNull();
  if (!token) {
    return Response.json({ code: 'UNAUTHENTICATED', message: 'Unauthorized' }, { status: 401 });
  }

  const convex = getAuthedConvexHttpClient(token);
  if (!convex) {
    return Response.json({ code: 'INTERNAL_ERROR', message: 'Convex URL missing' }, { status: 500 });
  }

  const ipAddress = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  const userAgent = req.headers.get('user-agent') ?? undefined;

  try {
    const payload = await convex.mutation<{ ok: boolean; lastSeenAt: number }>('deviceHeartbeat:ping', {
      ipAddress,
      userAgent,
    });

    return Response.json({
      ok: payload.ok,
      lastSeenAt: payload.lastSeenAt,
      role: result.session.role,
    });
  } catch (error) {
    return convexErrorResponse(error, 'Gagal mengirim heartbeat device.');
  }
}

export async function GET(req: Request) {
  return POST(req);
}
