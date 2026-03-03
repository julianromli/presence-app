import { getConvexTokenOrNull, requireRoleApiFromDb } from '@/lib/auth';
import { getAuthedConvexHttpClient } from '@/lib/convex-http';

export async function POST(req: Request) {
  const roleResult = await requireRoleApiFromDb(['karyawan']);
  if ('error' in roleResult) {
    return roleResult.error;
  }

  const body = (await req.json()) as {
    token?: string;
    latitude?: number;
    longitude?: number;
  };

  if (!body.token) {
    return Response.json({ message: 'Token wajib diisi' }, { status: 400 });
  }

  const ipAddress = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  const token = await getConvexTokenOrNull();
  if (!token) {
    return Response.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const convex = getAuthedConvexHttpClient(token);
  if (!convex) {
    return Response.json({ message: 'Convex URL missing' }, { status: 500 });
  }

  try {
    const response = await convex.mutation('attendance:recordScan', {
      token: body.token,
      ipAddress,
      latitude: body.latitude,
      longitude: body.longitude,
    });

    return Response.json(response);
  } catch (error) {
    return Response.json(
      {
        message: error instanceof Error ? error.message : 'Scan gagal',
      },
      { status: 400 },
    );
  }
}
