import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

import { OnboardingWorkspacePanel } from "./workspace-panel";

export default async function OnboardingWorkspacePage() {
  const { userId } = await auth();
  if (!userId) {
    redirect("/sign-in");
  }

  return <OnboardingWorkspacePanel />;
}
