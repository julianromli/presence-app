export type TrendPoint = {
  dateKey: string;
  presentCount: number;
  attendanceRatePct: number;
};

export type RecentActivityItem = {
  attendanceId: string;
  employeeName: string;
  dateKey: string;
  happenedAt: number;
  status: 'check-in' | 'check-out';
  edited: boolean;
};

export type DashboardOverviewPayload = {
  cards: {
    activeEmployees: number;
    presentToday: number;
    attendanceRatePct: number;
    checkedOut: number;
    editedToday: number;
    deviceQrOnline: number;
  };
  trend7d: TrendPoint[];
  recentActivity: RecentActivityItem[];
  reportStatus: {
    weekKey: string;
    status: 'pending' | 'success' | 'failed';
    generatedAt?: number;
    lastTriggeredAt?: number;
  } | null;
};

export type AdminUserRow = {
  _id: string;
  clerkUserId: string;
  name: string;
  email: string;
  role: 'superadmin' | 'admin' | 'karyawan' | 'device-qr';
  isActive: boolean;
  createdAt: number;
  updatedAt: number;
};

export type AdminUsersPage = {
  rows: AdminUserRow[];
  pageInfo: {
    continueCursor: string;
    isDone: boolean;
    splitCursor: string | null;
    pageStatus: 'SplitRecommended' | 'SplitRequired' | null;
  };
  summary: {
    total: number;
    active: number;
    inactive: number;
  };
};

export type AdminAttendanceRow = {
  _id: string;
  employeeName: string;
  dateKey: string;
  checkInAt?: number;
  checkOutAt?: number;
  edited: boolean;
};

export type AdminAttendanceSummary = {
  total: number;
  checkedIn: number;
  checkedOut: number;
  edited: number;
};

export type AdminAttendancePage = {
  rows: AdminAttendanceRow[];
  pageInfo: {
    continueCursor: string;
    isDone: boolean;
    splitCursor: string | null;
    pageStatus: 'SplitRecommended' | 'SplitRequired' | null;
  };
  summary: AdminAttendanceSummary;
};

export type WorkspaceManagementPayload = {
  workspace: {
    _id: string;
    _creationTime: number;
    slug: string;
    name: string;
    isActive: boolean;
    createdAt: number;
    updatedAt: number;
    createdByUserId?: string;
  };
  activeInviteCode: {
    _id: string;
    code: string;
    isActive: boolean;
    createdAt: number;
    updatedAt: number;
    lastRotatedAt?: number;
    expiresAt?: number;
  } | null;
  memberSummary: {
    totalCount: number;
    activeCount: number;
    activeCountExcludingCurrentUser: number;
  };
};

export type DeviceRegistrationCodeRow = {
  codeId: string;
  createdAt: number;
  expiresAt: number;
  claimedAt?: number;
  claimedByDeviceId?: string;
  revokedAt?: number;
  status: "pending" | "claimed" | "expired" | "revoked";
};

export type ManagedDeviceRow = {
  deviceId: string;
  label: string;
  status: "active" | "revoked";
  online: boolean;
  lastSeenAt?: number;
  claimedAt: number;
  claimedFromCodeId: string;
};

export type EmployeeTrendPoint = {
  dateKey: string;
  checkInMinute: number | null;
  onTime: boolean;
  hasCheckIn: boolean;
};

export type EmployeeDashboardOverviewPayload = {
  cards: {
    disciplineScore: number;
    onTimeThisWeek: number;
    lateThisWeek: number;
    avgCheckInTime: string;
    improvementMinutes: number;
    weeklyPoints: number;
    streakDays: number;
  };
  trend14d: EmployeeTrendPoint[];
  insight: string;
  badgeProgress: {
    current: "none" | "bronze" | "silver" | "gold";
    next: "bronze" | "silver" | "gold" | null;
    currentPoints: number;
    targetPoints: number | null;
    remainingPoints: number | null;
  };
};

export type EmployeeAttendanceHistoryRow = {
  attendanceId: string;
  dateKey: string;
  checkInAt?: number;
  checkOutAt?: number;
  status: "on-time" | "late" | "incomplete" | "absent";
  workDurationMinutes: number;
  edited: boolean;
  points: number;
};

export type EmployeeAttendanceHistoryPayload = {
  timeZone: string;
  rows: EmployeeAttendanceHistoryRow[];
  pageInfo: {
    continueCursor: string;
    isDone: boolean;
  };
  summary: {
    totalRows: number;
    onTime: number;
    late: number;
    incomplete: number;
    absent: number;
  };
};

export type EmployeeAttendanceByDatePayload = {
  timeZone: string;
  row: EmployeeAttendanceHistoryRow | null;
};

export type EmployeeLeaderboardRow = {
  userId: string;
  name: string;
  points: number;
  onTimeDays: number;
  streakDays: number;
  disciplineScore: number;
  rank: number;
  isMe: boolean;
};

export type EmployeeLeaderboardPayload = {
  weekLabel: string;
  myRank: number | null;
  myPoints: number;
  rows: EmployeeLeaderboardRow[];
};
