import { NextRequest, NextResponse } from "next/server";
import { buildQuery, type FilterParams } from "@/lib/queries";
import { query } from "@/lib/db";

export const maxDuration = 30;

export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams;
    const filters: FilterParams = {
      agency_code: params.get("agency_code") ?? undefined,
      duty_station_state_abbreviation:
        params.get("duty_station_state_abbreviation") ?? undefined,
      occupational_group_code:
        params.get("occupational_group_code") ?? undefined,
      occupational_series_code:
        params.get("occupational_series_code") ?? undefined,
      grade: params.get("grade") ?? undefined,
      pay_plan_code: params.get("pay_plan_code") ?? undefined,
      education_level_code: params.get("education_level_code") ?? undefined,
      age_bracket: params.get("age_bracket") ?? undefined,
      work_schedule_code: params.get("work_schedule_code") ?? undefined,
      pay_bracket: params.get("pay_bracket") ?? undefined,
      sensitive_occupation: params.get("sensitive_occupation") ?? undefined,
      separation_category_code:
        params.get("separation_category_code") ?? undefined,
      sort: params.get("sort") ?? undefined,
      sortDir: (params.get("sortDir") as "asc" | "desc") ?? undefined,
      cursor: params.get("cursor") ?? undefined,
      page: params.get("page") ? Number(params.get("page")) : undefined,
      pageSize: params.get("pageSize")
        ? Number(params.get("pageSize"))
        : undefined,
    };

    const {
      sql,
      params: qParams,
      countSql,
      countParams,
    } = buildQuery("separations", filters);

    const [rows, countResult] = await Promise.all([
      query(sql, qParams),
      query<{ count: string }>(countSql, countParams),
    ]);

    return NextResponse.json({
      data: rows,
      total: Number(countResult[0].count),
      page: filters.page ?? 1,
      pageSize: filters.pageSize ?? 50,
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch separations data", message: String(error) },
      { status: 500 }
    );
  }
}
