import type { AuthConfig } from "convex/server";

export default {
  providers: [
    {
      domain: "https://clerk.absenin.id",
      applicationID: "convex",
    },
  ],
} satisfies AuthConfig;
