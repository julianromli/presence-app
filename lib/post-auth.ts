import type { AppRole } from "@/lib/auth";

const POST_AUTH_ROUTE = "/auth/continue";

export function getRoleHomePath(role: AppRole) {
  switch (role) {
    case "karyawan":
      return "/scan";
    case "device-qr":
      return "/device-qr";
    case "admin":
    case "superadmin":
    default:
      return "/dashboard";
  }
}

export function sanitizePostAuthNextPath(
  value: string | string[] | undefined,
) {
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw) {
    return null;
  }

  const trimmed = raw.trim();
  if (!trimmed.startsWith("/") || trimmed.startsWith("//")) {
    return null;
  }

  try {
    const normalized = new URL(trimmed, "https://app.local");
    if (
      normalized.origin !== "https://app.local" ||
      normalized.pathname === POST_AUTH_ROUTE ||
      normalized.pathname === "/sign-in" ||
      normalized.pathname === "/sign-up"
    ) {
      return null;
    }

    return `${normalized.pathname}${normalized.search}${normalized.hash}`;
  } catch {
    return null;
  }
}

export function buildPostAuthContinuePath(nextPath?: string) {
  const safeNextPath = sanitizePostAuthNextPath(nextPath);
  if (!safeNextPath) {
    return POST_AUTH_ROUTE;
  }

  const params = new URLSearchParams({ next: safeNextPath });
  return `${POST_AUTH_ROUTE}?${params.toString()}`;
}
