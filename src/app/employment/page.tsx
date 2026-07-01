export const dynamic = "force-dynamic";

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Federal Employment Data",
  description:
    "Browse and filter current federal workforce employment records by agency, state, occupation, grade, and pay.",
  alternates: { canonical: "/employment" },
};
import { query } from "@/lib/db";
import { buildQuery, type FilterParams } from "@/lib/queries";
import { getFilterOptions } from "@/lib/filters";
import { FilterSidebar, MobileFilterButton } from "@/components/filter-sidebar";
import { DataTable } from "@/components/data-table";
import { getParam } from "@/lib/params";
import { formatNumber } from "@/lib/format";

interface Props {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

async function EmploymentContent({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const filters: FilterParams = {
    agency_code: getParam(searchParams, "agency_code"),
    duty_station_state_abbreviation: getParam(
      searchParams,
      "duty_station_state_abbreviation"
    ),
    occupational_group_code: getParam(
      searchParams,
      "occupational_group_code"
    ),
    occupational_series_code: getParam(
      searchParams,
      "occupational_series_code"
    ),
    grade: getParam(searchParams, "grade"),
    pay_plan_code: getParam(searchParams, "pay_plan_code"),
    education_level_code: getParam(searchParams, "education_level_code"),
    age_bracket: getParam(searchParams, "age_bracket"),
    work_schedule_code: getParam(searchParams, "work_schedule_code"),
    pay_bracket: getParam(searchParams, "pay_bracket"),
    sensitive_occupation: getParam(searchParams, "sensitive_occupation"),
    sort: getParam(searchParams, "sort"),
    sortDir: getParam(searchParams, "sortDir") as "asc" | "desc" | undefined,
    page: getParam(searchParams, "page")
      ? Number(getParam(searchParams, "page"))
      : undefined,
    pageSize: getParam(searchParams, "pageSize")
      ? Number(getParam(searchParams, "pageSize"))
      : undefined,
  };

  const {
    sql,
    params: qParams,
    countSql,
    countParams,
  } = buildQuery("employment", filters);

  const [rows, countResult, options] = await Promise.all([
    query(sql, qParams),
    query<{ count: string }>(countSql, countParams),
    getFilterOptions("employment"),
  ]);

  const total = Number(countResult[0]?.count ?? "0");

  const activeFilters: Record<string, string> = {};
  for (const [key, value] of Object.entries(searchParams)) {
    if (value && typeof value === "string") {
      activeFilters[key] = value;
    }
  }

  return (
    <div className="flex min-h-[calc(100vh-3.5rem)]">
      <FilterSidebar dataset="employment" options={options} />
      <div className="flex-1 overflow-hidden p-4">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              Federal Employment
            </h1>
            <p className="text-sm text-muted-foreground">
              Browse current federal workforce records
            </p>
            <p className="mt-1 text-sm font-medium text-foreground">
              {formatNumber(total)} records
            </p>
          </div>
          <MobileFilterButton dataset="employment" options={options} />
        </div>
        <DataTable
          initialData={rows as (Record<string, unknown> & { id: number })[]}
          total={total}
          dataset="employment"
          filters={activeFilters}
        />
      </div>
    </div>
  );
}

export default async function EmploymentPage({ searchParams }: Props) {
  const params = await searchParams;

  return <EmploymentContent searchParams={params} />;
}
