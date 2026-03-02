import { getConvexHttpClient } from '@/lib/convex-http';
import { requireRoleApi } from '@/lib/auth';

export async function GET() {
  const role = await requireRoleApi(['admin', 'superadmin']);
  if ('error' in role) return role.error;

  const convex = getConvexHttpClient();
  if (!convex) return Response.json({ message: 'Convex URL missing' }, { status: 500 });

  const rows = await convex.query('reports:listWeekly', {});
  return Response.json(rows);
}

export async function POST() {
  const role = await requireRoleApi(['admin', 'superadmin']);
  if ('error' in role) return role.error;

  const convex = getConvexHttpClient();
  if (!convex) return Response.json({ message: 'Convex URL missing' }, { status: 500 });

  const result = await convex.action('reports:triggerWeeklyReport', {});
  return Response.json(result);
}
