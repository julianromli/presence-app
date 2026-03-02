import { auth } from '@clerk/nextjs/server';

import { getConvexHttpClient } from '@/lib/convex-http';
import { requireRoleApi } from '@/lib/auth';

export async function PATCH(req: Request) {
  const role = await requireRoleApi(['admin', 'superadmin']);
  if ('error' in role) return role.error;

  const { userId } = await auth();
  if (!userId) {
    return Response.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  if (!body.attendanceId || !body.reason) {
    return Response.json({ message: 'attendanceId dan reason wajib' }, { status: 400 });
  }

  const convex = getConvexHttpClient();
  if (!convex) return Response.json({ message: 'Convex URL missing' }, { status: 500 });

  await convex.mutation('attendance:editAttendanceByClerk', {
    clerkUserId: userId,
    attendanceId: body.attendanceId,
    checkInAt: body.checkInAt,
    checkOutAt: body.checkOutAt,
    reason: body.reason,
  });

  return Response.json({ ok: true });
}
