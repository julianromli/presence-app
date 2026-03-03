import { describe, expect, it } from 'vitest';

import { normalizeUsersListQuery, parseUsersPatchBody } from '../lib/admin-users';

describe('admin users parser', () => {
  it('normalizes GET users query params', () => {
    const params = new URLSearchParams({
      q: '  budi  ',
      role: 'admin',
      isActive: 'true',
      limit: '500',
      cursor: 'abc123',
    });

    expect(normalizeUsersListQuery(params)).toEqual({
      q: 'budi',
      role: 'admin',
      isActive: true,
      limit: 100,
      cursor: 'abc123',
    });
  });

  it('rejects admin role update payload when role field is present', () => {
    expect(() =>
      parseUsersPatchBody(
        {
          userId: 'u1',
          role: 'superadmin',
        },
        'admin',
      ),
    ).toThrow(/FORBIDDEN/);
  });

  it('accepts superadmin role update payload', () => {
    const payload = parseUsersPatchBody(
      {
        userId: 'u1',
        role: 'admin',
        isActive: true,
      },
      'superadmin',
    );

    expect(payload).toEqual({ userId: 'u1', role: 'admin', isActive: true });
  });

  it('rejects invalid role values', () => {
    expect(() =>
      parseUsersPatchBody(
        {
          userId: 'u1',
          role: 'owner',
        },
        'superadmin',
      ),
    ).toThrow(/VALIDATION_ERROR/);
  });
});