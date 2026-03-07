import {
  requireWorkspaceDeviceApi,
} from '@/lib/auth';
import { convexErrorResponse } from '@/lib/api-error';
import { getPublicConvexHttpClient } from '@/lib/convex-http';

export async function POST(req: Request) {
  const result = await requireWorkspaceDeviceApi(req);
  if ('error' in result) {
    return result.error;
  }

  const convex = getPublicConvexHttpClient();
  if (!convex) {
    return Response.json({ code: 'INTERNAL_ERROR', message: 'Convex URL missing' }, { status: 500 });
  }

  const ipAddress = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  const userAgent = req.headers.get('user-agent') ?? undefined;

  try {
    const payload = await convex.mutation<{ ok: boolean; lastSeenAt: number }>('deviceHeartbeat:ping', {
      workspaceId: result.workspace.workspaceId,
      deviceId: result.device.deviceId,
      ipAddress,
      userAgent,
    });

    return Response.json({
      ok: payload.ok,
      lastSeenAt: payload.lastSeenAt,
    });
  } catch (error) {
    return convexErrorResponse(error, 'Gagal mengirim heartbeat device.');
  }
}

export async function GET(req: Request) {
  return POST(req);
}

