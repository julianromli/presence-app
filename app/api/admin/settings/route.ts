import { auth } from '@clerk/nextjs/server';

import { getConvexHttpClient } from '@/lib/convex-http';
import { requireRoleApi } from '@/lib/auth';

export async function GET() {
  const role = await requireRoleApi(['admin', 'superadmin']);
  if ('error' in role) return role.error;

  const { userId } = await auth();
  if (!userId) {
    return Response.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const convex = getConvexHttpClient();
  if (!convex) return Response.json({ message: 'Convex URL missing' }, { status: 500 });

  const data = await convex.mutation('settings:getForServer', { clerkUserId: userId });
  return Response.json(data);
}

export async function PATCH(req: Request) {
  const role = await requireRoleApi(['superadmin']);
  if ('error' in role) return role.error;

  const { userId } = await auth();
  if (!userId) {
    return Response.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const convex = getConvexHttpClient();
  if (!convex) return Response.json({ message: 'Convex URL missing' }, { status: 500 });

  await convex.mutation('settings:updateByClerk', {
    clerkUserId: userId,
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
