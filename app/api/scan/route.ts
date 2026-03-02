import { auth } from '@clerk/nextjs/server';

import { getConvexHttpClient } from '@/lib/convex-http';
import { requireRoleApi } from '@/lib/auth';

export async function POST(req: Request) {
  const roleResult = await requireRoleApi(['karyawan']);
  if ('error' in roleResult) {
    return roleResult.error;
  }

  const { userId } = await auth();
  if (!userId) {
    return Response.json({ message: 'Unauthorized' }, { status: 401 });
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
  const convex = getConvexHttpClient();
  if (!convex) {
    return Response.json({ message: 'Convex URL missing' }, { status: 500 });
  }

  try {
    const response = await convex.mutation('attendance:recordScanByClerk', {
      clerkUserId: userId,
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
