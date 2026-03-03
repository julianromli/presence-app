import { cronJobs } from 'convex/server';

import { internal } from './_generated/api';

const crons = cronJobs();

crons.cron(
  'weekly_presence_report',
  '0 1 * * 1',
  internal.reportsNode.runWeeklyReport,
  {},
);

export default crons;
