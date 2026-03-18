import {
  getConvexTokenOrNull,
  requireWorkspaceRoleApiFromDb,
  requireWorkspaceApiContext,
} from "@/lib/auth";
import { getAuthedConvexHttpClient } from "@/lib/convex-http";
import { convexErrorResponse } from "@/lib/api-error";

type AttendanceRow = {
  _id: string;
  employeeName: string;
  dateKey: string;
  checkInAt?: number;
  checkOutAt?: number;
  edited: boolean;
};

type AttendancePageResponse = {
  rowsPage: {
    page: AttendanceRow[];
    continueCursor: string;
    isDone: boolean;
    splitCursor?: string | null;
    pageStatus?: "SplitRecommended" | "SplitRequired" | null;
  };
  summary: AttendanceSummary;
  timezone: string;
};

type AttendanceSummary = {
  total: number;
  checkedIn: number;
  checkedOut: number;
  edited: number;
};

const STATUS_FILTERS = new Set([
  "all",
  "not-checked-in",
  "checked-in",
  "incomplete",
  "completed",
]);

export async function GET(req: Request) {
  const workspaceContext = requireWorkspaceApiContext(req);
  if ("error" in workspaceContext) return workspaceContext.error;
  const workspaceId = workspaceContext.workspace.workspaceId;

  const role = await requireWorkspaceRoleApiFromDb(
    ["admin", "superadmin"],
    workspaceContext.workspace.workspaceId,
  );
  if ("error" in role) return role.error;

  const searchParams = new URL(req.url).searchParams;
  const dateKey = searchParams.get("dateKey");
  if (!dateKey) {
    return Response.json(
      { code: "VALIDATION_ERROR", message: "dateKey wajib diisi." },
      { status: 400 },
    );
  }
  const cursorParam = searchParams.get("cursor");
  const cursor = cursorParam && cursorParam.length > 0 ? cursorParam : null;
  const rawLimit = Number(searchParams.get("limit") ?? 50);
  const limit = Number.isFinite(rawLimit)
    ? Math.min(Math.max(Math.trunc(rawLimit), 1), 100)
    : 50;
  const editedParam = searchParams.get("edited");
  const edited =
    editedParam === "true" ? true : editedParam === "false" ? false : undefined;
  const statusParam = searchParams.get("status");
  const status =
    statusParam && STATUS_FILTERS.has(statusParam) && statusParam !== "all"
      ? statusParam
      : undefined;
  const employeeName = searchParams.get("q")?.trim() || undefined;

  const token = await getConvexTokenOrNull();
  if (!token) {
    return Response.json(
      { code: "UNAUTHENTICATED", message: "Unauthorized" },
      { status: 401 },
    );
  }

  const convex = getAuthedConvexHttpClient(token);
  if (!convex)
    return Response.json(
      { code: "INTERNAL_ERROR", message: "Convex URL missing" },
      { status: 500 },
    );

  try {
    const result = await convex.query<AttendancePageResponse>(
      "attendance:listByDatePaginated",
      {
        dateKey,
        workspaceId,
        edited,
        employeeName,
        status,
        paginationOpts: {
          numItems: limit,
          cursor,
        },
      },
    );

    return Response.json({
      rows: result.rowsPage.page,
      timezone: result.timezone,
      pageInfo: {
        continueCursor: result.rowsPage.continueCursor,
        isDone: result.rowsPage.isDone,
        splitCursor: result.rowsPage.splitCursor ?? null,
        pageStatus: result.rowsPage.pageStatus ?? null,
      },
      summary: result.summary,
    });
  } catch (error) {
    return convexErrorResponse(error, "Gagal memuat data attendance.");
  }
}

