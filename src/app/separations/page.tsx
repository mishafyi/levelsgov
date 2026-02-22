import { Suspense } from "react";
import { query } from "@/lib/db";
import { buildQuery, type FilterParams } from "@/lib/queries";
import { getFilterOptions } from "@/lib/filters";
import { FilterSidebar, MobileFilterButton } from "@/components/filter-sidebar";
import { DataTable } from "@/components/data-table";

interface Props {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

function getParam(
  params: Record<string, string | string[] | undefined>,
  key: string
): string | undefined {
  const v = params[key];
  if (Array.isArray(v)) return v[0];
  return v || undefined;
}

async function SeparationsContent({
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
    separation_category_code: getParam(
      searchParams,
      "separation_category_code"
    ),
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
  } = buildQuery("separations", filters);

  const [rows, countResult, options] = await Promise.all([
    query(sql, qParams),
    query<{ count: string }>(countSql, countParams),
    getFilterOptions("separations"),
  ]);

  const total = Number(countResult[0].count);

  const activeFilters: Record<string, string> = {};
  for (const [key, value] of Object.entries(searchParams)) {
    if (value && typeof value === "string") {
      activeFilters[key] = value;
    }
  }

  return (
    <div className="flex min-h-[calc(100vh-3.5rem)]">
      <FilterSidebar dataset="separations" options={options} />
      <div className="flex-1 overflow-hidden p-4">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              Federal Separations
            </h1>
            <p className="text-sm text-muted-foreground">
              Browse departures from federal service including retirements,
              resignations, and terminations
            </p>
          </div>
          <MobileFilterButton dataset="separations" options={options} />
        </div>
        <DataTable
          initialData={rows as (Record<string, unknown> & { id: number })[]}
          total={total}
          dataset="separations"
          filters={activeFilters}
        />
      </div>
    </div>
  );
}

export default async function SeparationsPage({ searchParams }: Props) {
  const params = await searchParams;

  return (
    <Suspense
      fallback={
        <div className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center">
          <div className="text-muted-foreground">Loading...</div>
        </div>
      }
    >
      <SeparationsContent searchParams={params} />
    </Suspense>
  );
}
