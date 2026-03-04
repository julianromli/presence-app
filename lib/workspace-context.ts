export const ACTIVE_WORKSPACE_COOKIE = "active_workspace_id";

export function isValidWorkspaceId(value: string) {
  return /^[A-Za-z0-9_-]{6,128}$/.test(value);
}
