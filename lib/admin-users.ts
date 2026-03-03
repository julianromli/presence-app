import { z } from 'zod';

import type { AppRole } from '@/lib/auth';

const roleFilterSchema = z
  .union([
    z.literal('superadmin'),
    z.literal('admin'),
    z.literal('karyawan'),
    z.literal('device-qr'),
  ])
  .optional();

const boolFilterSchema = z
  .union([z.literal('true'), z.literal('false')])
  .optional()
  .transform((value) => {
    if (value === undefined) {
      return undefined;
    }
    return value === 'true';
  });

const patchBodySchema = z.object({
  userId: z.string().min(1, 'userId wajib diisi'),
  role: z
    .union([
      z.literal('superadmin'),
      z.literal('admin'),
      z.literal('karyawan'),
      z.literal('device-qr'),
    ])
    .optional(),
  isActive: z.boolean().optional(),
});

export type ParsedUsersListQuery = {
  q?: string;
  role?: AppRole;
  isActive?: boolean;
  cursor: string | null;
  limit: number;
};

export function normalizeUsersListQuery(searchParams: URLSearchParams): ParsedUsersListQuery {
  const qRaw = searchParams.get('q')?.trim();
  const roleRaw = searchParams.get('role') ?? undefined;
  const isActiveRaw = searchParams.get('isActive') ?? undefined;
  const cursorRaw = searchParams.get('cursor');
  const limitRaw = Number(searchParams.get('limit') ?? 20);

  const roleResult = roleFilterSchema.safeParse(roleRaw);
  if (!roleResult.success) {
    throw new Error('VALIDATION_ERROR: role tidak valid.');
  }

  const isActiveResult = boolFilterSchema.safeParse(isActiveRaw);
  if (!isActiveResult.success) {
    throw new Error('VALIDATION_ERROR: isActive harus true/false.');
  }

  const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(Math.trunc(limitRaw), 1), 100) : 20;

  return {
    q: qRaw && qRaw.length > 0 ? qRaw : undefined,
    role: roleResult.data,
    isActive: isActiveResult.data,
    cursor: cursorRaw && cursorRaw.length > 0 ? cursorRaw : null,
    limit,
  };
}

export type ParsedUsersPatchBody = {
  userId: string;
  role?: AppRole;
  isActive?: boolean;
};

export function parseUsersPatchBody(payload: unknown, actorRole: AppRole): ParsedUsersPatchBody {
  const parsed = patchBodySchema.safeParse(payload);
  if (!parsed.success) {
    throw new Error(`VALIDATION_ERROR: ${parsed.error.issues[0]?.message ?? 'Payload tidak valid.'}`);
  }

  if (parsed.data.role !== undefined && actorRole !== 'superadmin') {
    throw new Error('FORBIDDEN: Hanya superadmin yang dapat mengubah role.');
  }

  if (parsed.data.role === undefined && parsed.data.isActive === undefined) {
    throw new Error('VALIDATION_ERROR: Tidak ada field yang diubah.');
  }

  return parsed.data;
}