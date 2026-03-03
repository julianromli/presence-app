import { requireRoleApiFromDb } from '@/lib/auth';

export async function GET() {
  const result = await requireRoleApiFromDb(['admin', 'superadmin']);
  if ('error' in result) {
    return result.error;
  }

  return Response.json({ ok: true, role: result.session.role });
}
