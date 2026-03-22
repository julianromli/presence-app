type NoticeTone = 'info' | 'success' | 'warning' | 'error';

export type WorkspaceRestrictedGateNotice = {
  tone: NoticeTone;
  text: string;
};

type RunWorkspaceRecoveryRequestOptions = {
  request: () => Promise<Response>;
  reloadRestrictionState: () => Promise<void>;
  refreshWorkspaceSubscription: () => Promise<unknown>;
  normalizeError: (error: unknown, fallbackMessage: string) => Promise<{ code: string; message: string }>;
  fallbackMessage: string;
};

export async function runWorkspaceRecoveryRequest({
  request,
  reloadRestrictionState,
  refreshWorkspaceSubscription: refreshSubscription,
  normalizeError,
  fallbackMessage,
}: RunWorkspaceRecoveryRequestOptions): Promise<
  | { ok: true; notice: WorkspaceRestrictedGateNotice }
  | { ok: false; notice: WorkspaceRestrictedGateNotice }
> {
  try {
    const response = await request();
    if (!response.ok) {
      const normalized = await normalizeError(response, fallbackMessage);
      return {
        ok: false,
        notice: { tone: 'error', text: `[${normalized.code}] ${normalized.message}` },
      };
    }

    await Promise.all([reloadRestrictionState(), refreshSubscription()]);
    return {
      ok: true,
      notice: {
        tone: 'success',
        text: 'Status pembatasan workspace berhasil diperbarui.',
      },
    };
  } catch (error) {
    const normalized = await normalizeError(error, fallbackMessage);
    return {
      ok: false,
      notice: { tone: 'error', text: `[${normalized.code}] ${normalized.message}` },
    };
  }
}
