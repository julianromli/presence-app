import { requireRoleApi } from '@/lib/auth';

export async function GET() {
  const result = await requireRoleApi(['admin', 'superadmin']);
  if ('error' in result) {
    return result.error;
  }

  return Response.json({ ok: true, role: result.session.role });
}
