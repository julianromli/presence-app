import { describe, expect, it, vi } from 'vitest';

import { runWorkspaceRecoveryRequest } from '../components/dashboard/workspace-restricted-gate-state';

describe('workspace restricted gate state', () => {
  it('surfaces thrown recovery errors as inline notices', async () => {
    const reloadRestrictionState = vi.fn(async () => undefined);
    const refreshWorkspaceSubscription = vi.fn(async () => undefined);

    const result = await runWorkspaceRecoveryRequest({
      fallbackMessage: 'Gagal memproses pemulihan workspace.',
      normalizeError: vi.fn(async () => ({
        code: 'NETWORK_ERROR',
        message: 'Jaringan sedang bermasalah.',
      })),
      refreshWorkspaceSubscription,
      reloadRestrictionState,
      request: vi.fn(async () => {
        throw new Error('socket hang up');
      }),
    });

    expect(result).toEqual({
      notice: {
        text: '[NETWORK_ERROR] Jaringan sedang bermasalah.',
        tone: 'error',
      },
      ok: false,
    });
    expect(reloadRestrictionState).not.toHaveBeenCalled();
    expect(refreshWorkspaceSubscription).not.toHaveBeenCalled();
  });
});
