import { DeviceQrPanel } from "./device-qr-panel";

function readSingleSearchParam(value: string | string[] | undefined) {
  if (typeof value === "string") {
    return value;
  }

  return value?.[0] ?? null;
}

export default async function DeviceQrPage(props: PageProps<"/device-qr">) {
  const searchParams = await props.searchParams;
  const workspaceId = readSingleSearchParam(searchParams.workspaceId)?.trim() ?? null;

  return <DeviceQrPanel initialWorkspaceId={workspaceId} />;
}
