export interface FilterParams {
  agency_code?: string;
  duty_station_state_abbreviation?: string;
  occupational_group_code?: string;
  occupational_series_code?: string;
  grade?: string;
  pay_plan_code?: string;
  education_level_code?: string;
  age_bracket?: string;
  work_schedule_code?: string;
  accession_category_code?: string;
  separation_category_code?: string;
  pay_bracket?: string;
  sensitive_occupation?: string;
  sort?: string;
  sortDir?: "asc" | "desc";
  cursor?: string;
  pageSize?: number;
  page?: number;
}

const SENSITIVE_SERIES_CODES = [
  "0007", "0082", "0083", "0084", "0132", "0134", "0401", "0436",
  "0512", "0840", "0930", "1169", "1171", "1801", "1802", "1811",
  "1812", "1816", "1854", "1881", "1884", "1890", "1895", "1896",
];

const PAY_BRACKETS: Record<string, [number | null, number | null]> = {
  "under_50k": [null, 50000],
  "50k_75k": [50000, 75000],
  "75k_100k": [75000, 100000],
  "100k_150k": [100000, 150000],
  "150k_200k": [150000, 200000],
  "200k_plus": [200000, null],
};

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
  occupational_group_code: "occupational_group_code",
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

  // Pay bracket filter
  if (filters.pay_bracket && PAY_BRACKETS[filters.pay_bracket]) {
    const [min, max] = PAY_BRACKETS[filters.pay_bracket];
    if (min !== null) {
      conditions.push(`annualized_adjusted_basic_pay >= $${paramIndex}`);
      params.push(min);
      paramIndex++;
    }
    if (max !== null) {
      conditions.push(`annualized_adjusted_basic_pay < $${paramIndex}`);
      params.push(max);
      paramIndex++;
    }
  }

  // Sensitive occupation filter
  if (filters.sensitive_occupation === "all_sensitive") {
    const placeholders = SENSITIVE_SERIES_CODES.map(
      (_, i) => `$${paramIndex + i}`
    ).join(", ");
    conditions.push(`occupational_series_code IN (${placeholders})`);
    params.push(...SENSITIVE_SERIES_CODES);
    paramIndex += SENSITIVE_SERIES_CODES.length;
  } else if (filters.sensitive_occupation === "non_sensitive") {
    const placeholders = SENSITIVE_SERIES_CODES.map(
      (_, i) => `$${paramIndex + i}`
    ).join(", ");
    conditions.push(
      `(occupational_series_code IS NULL OR occupational_series_code NOT IN (${placeholders}))`
    );
    params.push(...SENSITIVE_SERIES_CODES);
    paramIndex += SENSITIVE_SERIES_CODES.length;
  } else if (
    filters.sensitive_occupation &&
    SENSITIVE_SERIES_CODES.includes(filters.sensitive_occupation)
  ) {
    conditions.push(`occupational_series_code = $${paramIndex}`);
    params.push(filters.sensitive_occupation);
    paramIndex++;
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
