import { getConvexTokenOrNull, requireRoleApiFromDb } from "@/lib/auth";
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
  page: AttendanceRow[];
  continueCursor: string;
  isDone: boolean;
  splitCursor?: string | null;
  pageStatus?: "SplitRecommended" | "SplitRequired" | null;
};

type AttendanceSummary = {
  total: number;
  checkedIn: number;
  checkedOut: number;
  edited: number;
};

export async function GET(req: Request) {
  const role = await requireRoleApiFromDb(["admin", "superadmin"]);
  if ("error" in role) return role.error;

  const searchParams = new URL(req.url).searchParams;
  const dateKey = searchParams.get("dateKey");
  if (!dateKey) {
    return Response.json({ message: "dateKey wajib" }, { status: 400 });
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
  const employeeName = searchParams.get("q")?.trim() || undefined;

  const token = await getConvexTokenOrNull();
  if (!token) {
    return Response.json({ message: "Unauthorized" }, { status: 401 });
  }

  const convex = getAuthedConvexHttpClient(token);
  if (!convex)
    return Response.json({ message: "Convex URL missing" }, { status: 500 });

  try {
    const [rowsPage, summary] = await Promise.all([
      convex.query<AttendancePageResponse>("attendance:listByDatePaginated", {
        dateKey,
        edited,
        employeeName,
        paginationOpts: {
          numItems: limit,
          cursor,
        },
      }),
      convex.query<AttendanceSummary>("attendance:getSummaryByDate", {
        dateKey,
      }),
    ]);

    return Response.json({
      rows: rowsPage.page,
      pageInfo: {
        continueCursor: rowsPage.continueCursor,
        isDone: rowsPage.isDone,
        splitCursor: rowsPage.splitCursor ?? null,
        pageStatus: rowsPage.pageStatus ?? null,
      },
      summary,
    });
  } catch (error) {
    return convexErrorResponse(error, "Gagal memuat data attendance.");
  }
}
