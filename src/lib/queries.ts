export interface FilterParams {
  agency_code?: string;
  duty_station_state_abbreviation?: string;
  occupational_series_code?: string;
  grade?: string;
  pay_plan_code?: string;
  education_level_code?: string;
  age_bracket?: string;
  work_schedule_code?: string;
  accession_category_code?: string;
  separation_category_code?: string;
  sort?: string;
  sortDir?: "asc" | "desc";
  cursor?: string;
  pageSize?: number;
  page?: number;
}

export interface BuildQueryResult {
  sql: string;
  params: (string | number | null)[];
  countSql: string;
  countParams: (string | number | null)[];
}

const SORT_ALLOWLIST = new Set([
  "agency",
  "duty_station_state",
  "occupational_series",
  "grade",
  "annualized_adjusted_basic_pay",
  "education_level",
  "age_bracket",
  "length_of_service_years",
]);

const MAX_PAGE_SIZE = 100;
const DEFAULT_PAGE_SIZE = 50;
const MAX_OFFSET = 10000; // 200 pages * 50 per page

type Dataset = "employment" | "accessions" | "separations";

// Map of filter param keys to their corresponding database column names
const FILTER_COLUMN_MAP: Record<string, string> = {
  agency_code: "agency_code",
  duty_station_state_abbreviation: "duty_station_state_abbreviation",
  occupational_series_code: "occupational_series_code",
  grade: "grade",
  pay_plan_code: "pay_plan_code",
  education_level_code: "education_level_code",
  age_bracket: "age_bracket",
  work_schedule_code: "work_schedule_code",
  accession_category_code: "accession_category_code",
  separation_category_code: "separation_category_code",
};

export function buildQuery(
  dataset: Dataset,
  filters: FilterParams
): BuildQueryResult {
  const table = dataset;
  const conditions: string[] = [];
  const params: (string | number | null)[] = [];
  let paramIndex = 1;

  // Build WHERE conditions from filter params
  for (const [filterKey, column] of Object.entries(FILTER_COLUMN_MAP)) {
    const value = filters[filterKey as keyof FilterParams] as
      | string
      | undefined;
    if (value !== undefined && value !== "") {
      conditions.push(`${column} = $${paramIndex}`);
      params.push(value);
      paramIndex++;
    }
  }

  const whereClause =
    conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  // Count query
  const countSql = `SELECT COUNT(*) as count FROM ${table} ${whereClause}`;
  const countParams = [...params];

  // Sort validation
  let sortColumn: string | null = null;
  let sortDirection: "ASC" | "DESC" = "ASC";

  if (filters.sort && SORT_ALLOWLIST.has(filters.sort)) {
    sortColumn = filters.sort;
    sortDirection =
      filters.sortDir?.toUpperCase() === "DESC" ? "DESC" : "ASC";
  }

  // Pagination
  const pageSize = Math.min(
    Math.max(1, filters.pageSize ?? DEFAULT_PAGE_SIZE),
    MAX_PAGE_SIZE
  );
  const page = Math.max(1, filters.page ?? 1);

  let orderClause: string;
  let limitClause: string;

  if (filters.cursor && !sortColumn) {
    // Cursor-based pagination on id column
    conditions.push(`id > $${paramIndex}`);
    params.push(Number(filters.cursor));
    paramIndex++;
    orderClause = "ORDER BY id ASC";
    limitClause = `LIMIT $${paramIndex}`;
    params.push(pageSize);
    paramIndex++;
  } else {
    // Offset-based pagination (with or without sort)
    const offset = (page - 1) * pageSize;

    // Cap offset to prevent performance issues
    const cappedOffset = Math.min(offset, MAX_OFFSET);

    if (sortColumn) {
      orderClause = `ORDER BY ${sortColumn} ${sortDirection}, id ASC`;
    } else {
      orderClause = "ORDER BY id ASC";
    }

    limitClause = `LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(pageSize);
    params.push(cappedOffset);
    paramIndex += 2;
  }

  // Rebuild WHERE clause with cursor condition if added
  const fullWhereClause =
    conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const sql = `SELECT * FROM ${table} ${fullWhereClause} ${orderClause} ${limitClause}`;

  return { sql, params, countSql, countParams };
}
