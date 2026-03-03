import { getConvexTokenOrNull, requireRoleApiFromDb } from '@/lib/auth';
import { getAuthedConvexHttpClient } from '@/lib/convex-http';

export async function GET() {
  const role = await requireRoleApiFromDb(['admin', 'superadmin']);
  if ('error' in role) return role.error;

  const token = await getConvexTokenOrNull();
  if (!token) {
    return Response.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const convex = getAuthedConvexHttpClient(token);
  if (!convex) return Response.json({ message: 'Convex URL missing' }, { status: 500 });

  const data = await convex.query('settings:get', {});
  return Response.json(data);
}

export async function PATCH(req: Request) {
  const role = await requireRoleApiFromDb(['superadmin']);
  if ('error' in role) return role.error;

  const token = await getConvexTokenOrNull();
  if (!token) {
    return Response.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const convex = getAuthedConvexHttpClient(token);
  if (!convex) return Response.json({ message: 'Convex URL missing' }, { status: 500 });

  await convex.mutation('settings:update', {
    timezone: body.timezone,
    geofenceEnabled: body.geofenceEnabled,
    geofenceRadiusMeters: body.geofenceRadiusMeters,
    geofenceLat: body.geofenceLat,
    geofenceLng: body.geofenceLng,
    whitelistEnabled: body.whitelistEnabled,
    whitelistIps: body.whitelistIps,
  });

  return Response.json({ ok: true });
}
