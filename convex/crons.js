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

crons.cron(
  "employee_checkout_reminder_notifications",
  "*/30 * * * *",
  internal.notifications.runCheckoutReminders,
);

crons.cron(
  "reconcile_pending_workspace_invoices",
  "*/15 * * * *",
  internal.workspaceBilling.reconcilePendingWorkspaceInvoices,
);

crons.cron(
  "expire_active_workspace_periods",
  "0 * * * *",
  internal.workspaceBilling.expireActiveWorkspacePeriods,
);

export default crons;
