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
};
