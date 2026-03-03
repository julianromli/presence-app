import { getConvexTokenOrNull, requireRoleApiFromDb } from '@/lib/auth';
import { convexErrorResponse } from '@/lib/api-error';
import { getAuthedConvexHttpClient } from '@/lib/convex-http';
import type { DashboardOverviewPayload } from '@/types/dashboard';

export async function GET() {
  const role = await requireRoleApiFromDb(['admin', 'superadmin']);
  if ('error' in role) return role.error;

  const token = await getConvexTokenOrNull();
  if (!token) {
    return Response.json({ code: 'UNAUTHENTICATED', message: 'Unauthorized' }, { status: 401 });
  }

  const convex = getAuthedConvexHttpClient(token);
  if (!convex) {
    return Response.json({ code: 'INTERNAL_ERROR', message: 'Convex URL missing' }, { status: 500 });
  }

  try {
    await convex.mutation('settings:ensureGlobal', {});
    const payload = await convex.query<DashboardOverviewPayload>('dashboard:getOverview', {});
    return Response.json(payload);
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('[api/admin/dashboard/overview] convex query failed', error);
    }
    return convexErrorResponse(error, 'Gagal memuat ringkasan dashboard.');
  }
}
