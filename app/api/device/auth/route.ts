import { getDeviceKeyFromRequest, requireWorkspaceDeviceApi } from "@/lib/auth";
import {
  createExpiredDeviceAuthCookieHeader,
  DEVICE_AUTH_COOKIE,
  DEVICE_KEY_HEADER,
} from "@/lib/device-auth";

export async function GET(req: Request) {
  const rawCookie = req.headers.get("cookie");
  const headerValue = req.headers.get(DEVICE_KEY_HEADER);
  const hasDeviceKeyHeader = typeof headerValue === "string" && headerValue.trim().length > 0;
  const hasDeviceAuthCookie =
    typeof rawCookie === "string" && rawCookie.includes(`${DEVICE_AUTH_COOKIE}=`);
  const deviceKey = getDeviceKeyFromRequest(req);

  if (!deviceKey) {
    if (!hasDeviceKeyHeader && !hasDeviceAuthCookie) {
      return Response.json({ ok: false });
    }

    const response = Response.json(
      { code: "DEVICE_UNAUTHORIZED", message: "Unauthorized device" },
      { status: 401 },
    );
    if (hasDeviceAuthCookie) {
      response.headers.append("Set-Cookie", createExpiredDeviceAuthCookieHeader());
    }
    return response;
  }

  const result = await requireWorkspaceDeviceApi(req);
  if ("error" in result) {
    if (result.error.status === 401) {
      result.error.headers.append("Set-Cookie", createExpiredDeviceAuthCookieHeader());
    }
    return result.error;
  }

  return Response.json({
    ok: true,
    device: result.device,
    workspace: result.workspace,
  });
}

export async function DELETE() {
  const response = Response.json({ ok: true });
  response.headers.append("Set-Cookie", createExpiredDeviceAuthCookieHeader());
  return response;
}
