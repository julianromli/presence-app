import { ConvexError } from 'convex/values';

import type { AppRole } from '@/lib/auth';
import {
  getConvexTokenOrNull,
  requireWorkspaceRoleApiFromDb,
  requireWorkspaceApiContextForMigration,
} from '@/lib/auth';
import { convexErrorResponse } from '@/lib/api-error';
import { normalizeUsersListQuery, parseUsersPatchBody } from '@/lib/admin-users';
import { getAuthedConvexHttpClient } from '@/lib/convex-http';
import type { AdminUsersPage } from '@/types/dashboard';

function responseFromParserError(error: unknown) {
  if (!(error instanceof Error)) {
    return Response.json({ code: 'BAD_REQUEST', message: 'Permintaan tidak valid.' }, { status: 400 });
  }

  if (error.message.startsWith('FORBIDDEN:')) {
    return Response.json(
      { code: 'FORBIDDEN', message: error.message.replace('FORBIDDEN:', '').trim() },
      { status: 403 },
    );
  }

  if (error.message.startsWith('VALIDATION_ERROR:')) {
    return Response.json(
      {
        code: 'VALIDATION_ERROR',
        message: error.message.replace('VALIDATION_ERROR:', '').trim(),
      },
      { status: 400 },
    );
  }

  return Response.json({ code: 'BAD_REQUEST', message: error.message }, { status: 400 });
}

export async function GET(req: Request) {
  const workspaceContext = requireWorkspaceApiContextForMigration(req);
  if ('error' in workspaceContext) {
    return workspaceContext.error;
  }
  const workspaceId =
    workspaceContext.workspace.workspaceId === 'default-global'
      ? undefined
      : workspaceContext.workspace.workspaceId;

  const role = await requireWorkspaceRoleApiFromDb(
    ['admin', 'superadmin'],
    workspaceContext.workspace.workspaceId,
  );
  if ('error' in role) return role.error;

  const token = await getConvexTokenOrNull();
  if (!token) {
    return Response.json({ code: 'UNAUTHENTICATED', message: 'Unauthorized' }, { status: 401 });
  }

  const convex = getAuthedConvexHttpClient(token);
  if (!convex) {
    return Response.json({ code: 'INTERNAL_ERROR', message: 'Convex URL missing' }, { status: 500 });
  }

  let query;
  try {
    query = normalizeUsersListQuery(new URL(req.url).searchParams);
  } catch (error) {
    return responseFromParserError(error);
  }

  try {
    const result = await convex.query<{
      rowsPage: {
        page: AdminUsersPage['rows'];
        continueCursor: string;
        isDone: boolean;
        splitCursor?: string | null;
        pageStatus?: 'SplitRecommended' | 'SplitRequired' | null;
      };
      summary: AdminUsersPage['summary'];
    }>('users:listPaginated', {
      workspaceId,
      q: query.q,
      role: query.role,
      isActive: query.isActive,
      paginationOpts: {
        numItems: query.limit,
        cursor: query.cursor,
      },
    });

    return Response.json({
      rows: result.rowsPage.page,
      pageInfo: {
        continueCursor: result.rowsPage.continueCursor,
        isDone: result.rowsPage.isDone,
        splitCursor: result.rowsPage.splitCursor ?? null,
        pageStatus: result.rowsPage.pageStatus ?? null,
      },
      summary: result.summary,
    } satisfies AdminUsersPage);
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('[api/admin/users] convex query failed', error);
    }
    return convexErrorResponse(error, 'Gagal memuat data user admin.');
  }
}

export async function PATCH(req: Request) {
  const workspaceContext = requireWorkspaceApiContextForMigration(req);
  if ('error' in workspaceContext) {
    return workspaceContext.error;
  }
  const workspaceId =
    workspaceContext.workspace.workspaceId === 'default-global'
      ? undefined
      : workspaceContext.workspace.workspaceId;

  const roleCheck = await requireWorkspaceRoleApiFromDb(
    ['admin', 'superadmin'],
    workspaceContext.workspace.workspaceId,
  );
  if ('error' in roleCheck) return roleCheck.error;
  if (!roleCheck.session.role) {
    return Response.json({ code: 'FORBIDDEN', message: 'Forbidden' }, { status: 403 });
  }

  const token = await getConvexTokenOrNull();
  if (!token) {
    return Response.json({ code: 'UNAUTHENTICATED', message: 'Unauthorized' }, { status: 401 });
  }

  const convex = getAuthedConvexHttpClient(token);
  if (!convex) {
    return Response.json({ code: 'INTERNAL_ERROR', message: 'Convex URL missing' }, { status: 500 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json(
      { code: 'BAD_REQUEST', message: 'Payload JSON tidak valid.' },
      { status: 400 },
    );
  }

  let payload: { userId: string; role?: AppRole; isActive?: boolean };
  try {
    payload = parseUsersPatchBody(body, roleCheck.session.role);
  } catch (error) {
    return responseFromParserError(error);
  }

  try {
    await convex.mutation('users:updateAdminManagedFields', {
      workspaceId,
      userId: payload.userId,
      role: payload.role,
      isActive: payload.isActive,
    });
    return Response.json({ ok: true });
  } catch (error) {
    if (error instanceof ConvexError) {
      return convexErrorResponse(error, 'Gagal memperbarui user.');
    }
    return convexErrorResponse(error, 'Gagal memperbarui user.');
  }
}
