import { getConvexTokenOrNull, requireRoleApiFromDb } from '@/lib/auth';
import { getAuthedConvexHttpClient } from '@/lib/convex-http';

export async function PATCH(req: Request) {
  const role = await requireRoleApiFromDb(['admin', 'superadmin']);
  if ('error' in role) return role.error;

  const body = await req.json();
  if (!body.attendanceId || !body.reason) {
    return Response.json({ message: 'attendanceId dan reason wajib' }, { status: 400 });
  }

  const token = await getConvexTokenOrNull();
  if (!token) {
    return Response.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const convex = getAuthedConvexHttpClient(token);
  if (!convex) return Response.json({ message: 'Convex URL missing' }, { status: 500 });

  await convex.mutation('attendance:editAttendance', {
    attendanceId: body.attendanceId,
    checkInAt: body.checkInAt,
    checkOutAt: body.checkOutAt,
    reason: body.reason,
  });

  return Response.json({ ok: true });
}
