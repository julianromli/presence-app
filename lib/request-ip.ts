import { isIP } from "node:net";

const TRUSTED_SINGLE_IP_HEADERS = [
  "x-vercel-forwarded-for",
  "cf-connecting-ip",
  "fly-client-ip",
  "true-client-ip",
  "x-real-ip",
] as const;

function normalizeIpCandidate(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed || trimmed.includes(",")) {
    return null;
  }

  return isIP(trimmed) ? trimmed : null;
}

function getIpFromTrustedForwardedFor(request: Request) {
  const hasTrustedProxyMarker =
    request.headers.has("x-vercel-id") ||
    request.headers.has("cf-ray") ||
    request.headers.has("fly-request-id");
  if (!hasTrustedProxyMarker) {
    return null;
  }

  const forwardedFor = request.headers.get("x-forwarded-for");
  const firstIp = forwardedFor?.split(",")[0]?.trim();
  return normalizeIpCandidate(firstIp);
}

function normalizeUserAgent(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const normalized = value.trim().replace(/\s+/g, " ");
  if (!normalized) {
    return null;
  }

  return normalized.slice(0, 200);
}

export function getTrustedClientIp(request: Request) {
  for (const headerName of TRUSTED_SINGLE_IP_HEADERS) {
    const candidate = normalizeIpCandidate(request.headers.get(headerName));
    if (candidate) {
      return candidate;
    }
  }

  return getIpFromTrustedForwardedFor(request);
}

export function getRequestRateLimitKey(request: Request) {
  const ipAddress = getTrustedClientIp(request);
  const userAgent = normalizeUserAgent(request.headers.get("user-agent"));

  if (ipAddress && userAgent) {
    return `ip:${ipAddress}|ua:${userAgent}`;
  }

  if (ipAddress) {
    return `ip:${ipAddress}`;
  }

  if (userAgent) {
    return `ua:${userAgent}`;
  }

  return null;
}
