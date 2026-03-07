import { requireWorkspaceDeviceApi } from "@/lib/auth";

export async function GET(req: Request) {
  const result = await requireWorkspaceDeviceApi(req);
  if ("error" in result) {
    return result.error;
  }

  return Response.json({
    ok: true,
    device: result.device,
  });
}
