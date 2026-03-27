import { buildDeviceKey, createDeviceAuthCookieHeader } from "@/lib/device-auth";
import { convexErrorResponse } from "@/lib/api-error";
import { getPublicConvexHttpClient } from "@/lib/convex-http";
import { getRequestRateLimitKey, getTrustedClientIp } from "@/lib/request-ip";

type ClaimRegistrationResponse = {
  deviceId: string;
  label: string;
  secret: string;
  claimedAt: number;
  workspace: {
    workspaceId: string;
    name: string;
  };
};

export async function POST(req: Request) {
  let body: { code?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json(
      { code: "BAD_REQUEST", message: "Payload JSON tidak valid." },
      { status: 400 },
    );
  }

  const code = body.code?.trim();
  if (!code) {
    return Response.json(
      { code: "VALIDATION_ERROR", message: "Kode registrasi wajib diisi." },
      { status: 400 },
    );
  }

  const convex = getPublicConvexHttpClient();
  if (!convex) {
    return Response.json(
      { code: "INTERNAL_ERROR", message: "Convex URL missing" },
      { status: 500 },
    );
  }

  const ipAddress = getTrustedClientIp(req) ?? undefined;
  const userAgent = req.headers.get("user-agent") ?? undefined;

  try {
    const response = await convex.mutation<ClaimRegistrationResponse>(
      "devices:claimRegistrationCode",
      {
        code,
        ipAddress,
        userAgent,
        rateLimitKey: getRequestRateLimitKey(req) ?? undefined,
      },
    );

    const result = Response.json({
      deviceId: response.deviceId,
      label: response.label,
      claimedAt: response.claimedAt,
      workspace: response.workspace,
    });
    result.headers.append(
      "Set-Cookie",
      createDeviceAuthCookieHeader(
        buildDeviceKey({
          deviceId: response.deviceId,
          secret: response.secret,
        }),
      ),
    );
    return result;
  } catch (error) {
    return convexErrorResponse(error, "Gagal mengklaim device.");
  }
}
