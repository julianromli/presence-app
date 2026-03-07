import { cronJobs } from "convex/server";

import { internal } from "./_generated/api";

const crons = cronJobs();

crons.cron(
  "weekly_absenin_id_report",
  "0 1 * * 1",
  internal.reportsNode.runWeeklyReportForAllWorkspaces,
);

crons.cron(
  "cleanup_expired_device_registration_codes",
  "15 * * * *",
  internal.devices.cleanupExpiredRegistrationCodes,
);

export default crons;
