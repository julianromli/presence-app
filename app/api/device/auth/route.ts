import { requireWorkspaceDeviceApi } from "@/lib/auth";
import { createExpiredDeviceAuthCookieHeader } from "@/lib/device-auth";

export async function GET(req: Request) {
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
  });
}
