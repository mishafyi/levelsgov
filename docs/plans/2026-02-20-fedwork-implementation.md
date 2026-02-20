# FedWork Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a public website to filter and browse OPM federal workforce data (employment, accessions, separations).

**Architecture:** Next.js App Router with Server Components for initial data loading and API routes for client-side refetches. PostgreSQL database. Python scripts for data import and auto-download. shadcn/ui + jolyui animated-table for the UI.

**Tech Stack:** Next.js 15, PostgreSQL 16, shadcn/ui, jolyui animated-table, Python 3, psycopg2, Tailwind CSS

**Key design decisions from review:**
- Server Components fetch DB directly for initial page load; API routes only for client-side filter/sort/pagination changes
- Cursor-based pagination (not offset) for the 2M-row employment table
- Combobox (Command+Popover) for large filter lists (agencies, occupations), plain Select for short lists
- `annualized_adjusted_basic_pay` stored as NUMERIC for sorting/filtering by pay range
- `REDACTED` values handled via PostgreSQL COPY `NULL 'REDACTED'` option
- Cascading filters deferred to V2
- Mobile: Sheet drawer for filters, horizontal scroll for table

---

### Task 0: Initialize Git Repository

**Step 1: Create .gitignore and init repo**

Create `.gitignore`:
```
node_modules/
.next/
data/*.txt
.env.local
.env
```

```bash
cd /Users/misha/claude_projects/fedwork
git init
git add .gitignore docs/
git commit -m "init: project with design docs"
```

---

### Task 1: Install PostgreSQL and Create Database

**Step 1: Install PostgreSQL via Homebrew**

Run: `brew install postgresql@16`
Run: `brew services start postgresql@16`
Run: `echo 'export PATH="/opt/homebrew/opt/postgresql@16/bin:$PATH"' >> ~/.zshrc && source ~/.zshrc`

**Step 2: Create the database**

Run: `createdb fedwork`

**Step 3: Verify**

Run: `psql fedwork -c "SELECT 1"`
Expected: Returns 1 row

**Step 4: Install Python dependencies**

Run: `pip3 install psycopg2-binary`

---

### Task 2: Create Database Schema

**Files:**
- Create: `scripts/schema.sql`

**Step 1: Write the schema file**

Key changes from original plan (review findings):
- `annualized_adjusted_basic_pay` is `NUMERIC(10,0)` not VARCHAR — enables pay range filtering and numeric sorting
- `count` column renamed to `employee_count` — avoids conflict with SQL aggregate function
- `pay_plan` tightened to `VARCHAR(200)` (longest observed value is ~170 chars for the law enforcement pay description)
- `data_imports` includes `file_hash` for idempotent imports
- `DROP TABLE IF EXISTS` for clean re-runs during development
- Composite indexes for common multi-filter queries
- `snapshot_yyyymm` has CHECK constraint for validation

```sql
-- scripts/schema.sql

DROP TABLE IF EXISTS employment CASCADE;
DROP TABLE IF EXISTS accessions CASCADE;
DROP TABLE IF EXISTS separations CASCADE;
DROP TABLE IF EXISTS data_imports CASCADE;

CREATE TABLE data_imports (
    id SERIAL PRIMARY KEY,
    dataset_type VARCHAR(20) NOT NULL,
    filename VARCHAR(255) NOT NULL,
    file_hash VARCHAR(64),
    imported_at TIMESTAMP DEFAULT NOW(),
    row_count INTEGER,
    snapshot_month VARCHAR(6),
    status VARCHAR(20) DEFAULT 'pending'
);

CREATE TABLE employment (
    id SERIAL PRIMARY KEY,
    age_bracket VARCHAR(20),
    agency VARCHAR(200),
    agency_code VARCHAR(10),
    agency_subelement VARCHAR(200),
    agency_subelement_code VARCHAR(10),
    annualized_adjusted_basic_pay NUMERIC(10,0),
    appointment_type VARCHAR(200),
    appointment_type_code VARCHAR(10),
    employee_count INTEGER,
    duty_station_country VARCHAR(100),
    duty_station_country_code VARCHAR(10),
    duty_station_state VARCHAR(100),
    duty_station_state_abbreviation VARCHAR(10),
    duty_station_state_code VARCHAR(10),
    education_level VARCHAR(100),
    education_level_code VARCHAR(10),
    grade VARCHAR(10),
    length_of_service_years NUMERIC(5,1),
    occupational_group VARCHAR(200),
    occupational_group_code VARCHAR(10),
    occupational_series VARCHAR(200),
    occupational_series_code VARCHAR(10),
    pay_plan VARCHAR(200),
    pay_plan_code VARCHAR(10),
    snapshot_yyyymm VARCHAR(6) CHECK (snapshot_yyyymm ~ '^\d{6}$'),
    stem_occupation VARCHAR(100),
    stem_occupation_type VARCHAR(100),
    supervisory_status VARCHAR(100),
    supervisory_status_code VARCHAR(10),
    work_schedule VARCHAR(50),
    work_schedule_code VARCHAR(10)
);

CREATE TABLE accessions (
    id SERIAL PRIMARY KEY,
    accession_category VARCHAR(200),
    accession_category_code VARCHAR(10),
    age_bracket VARCHAR(20),
    agency VARCHAR(200),
    agency_code VARCHAR(10),
    agency_subelement VARCHAR(200),
    agency_subelement_code VARCHAR(10),
    annualized_adjusted_basic_pay NUMERIC(10,0),
    appointment_type VARCHAR(200),
    appointment_type_code VARCHAR(10),
    employee_count INTEGER,
    duty_station_country VARCHAR(100),
    duty_station_country_code VARCHAR(10),
    duty_station_state VARCHAR(100),
    duty_station_state_abbreviation VARCHAR(10),
    duty_station_state_code VARCHAR(10),
    education_level VARCHAR(100),
    education_level_code VARCHAR(10),
    grade VARCHAR(10),
    length_of_service_years NUMERIC(5,1),
    occupational_group VARCHAR(200),
    occupational_group_code VARCHAR(10),
    occupational_series VARCHAR(200),
    occupational_series_code VARCHAR(10),
    pay_plan VARCHAR(200),
    pay_plan_code VARCHAR(10),
    personnel_action_effective_date_yyyymm VARCHAR(6),
    stem_occupation VARCHAR(100),
    stem_occupation_type VARCHAR(100),
    supervisory_status VARCHAR(100),
    supervisory_status_code VARCHAR(10),
    work_schedule VARCHAR(50),
    work_schedule_code VARCHAR(10)
);

CREATE TABLE separations (
    id SERIAL PRIMARY KEY,
    age_bracket VARCHAR(20),
    agency VARCHAR(200),
    agency_code VARCHAR(10),
    agency_subelement VARCHAR(200),
    agency_subelement_code VARCHAR(10),
    annualized_adjusted_basic_pay NUMERIC(10,0),
    appointment_type VARCHAR(200),
    appointment_type_code VARCHAR(10),
    employee_count INTEGER,
    duty_station_country VARCHAR(100),
    duty_station_country_code VARCHAR(10),
    duty_station_state VARCHAR(100),
    duty_station_state_abbreviation VARCHAR(10),
    duty_station_state_code VARCHAR(10),
    education_level VARCHAR(100),
    education_level_code VARCHAR(10),
    grade VARCHAR(10),
    length_of_service_years NUMERIC(5,1),
    occupational_group VARCHAR(200),
    occupational_group_code VARCHAR(10),
    occupational_series VARCHAR(200),
    occupational_series_code VARCHAR(10),
    pay_plan VARCHAR(200),
    pay_plan_code VARCHAR(10),
    personnel_action_effective_date_yyyymm VARCHAR(6),
    separation_category VARCHAR(200),
    separation_category_code VARCHAR(10),
    stem_occupation VARCHAR(100),
    stem_occupation_type VARCHAR(100),
    supervisory_status VARCHAR(100),
    supervisory_status_code VARCHAR(10),
    work_schedule VARCHAR(50),
    work_schedule_code VARCHAR(10)
);

-- Single-column indexes
CREATE INDEX idx_emp_agency ON employment(agency_code);
CREATE INDEX idx_emp_state ON employment(duty_station_state_abbreviation);
CREATE INDEX idx_emp_occ ON employment(occupational_series_code);
CREATE INDEX idx_emp_occ_group ON employment(occupational_group_code);
CREATE INDEX idx_emp_grade ON employment(grade);
CREATE INDEX idx_emp_pay_plan ON employment(pay_plan_code);
CREATE INDEX idx_emp_education ON employment(education_level_code);
CREATE INDEX idx_emp_age ON employment(age_bracket);
CREATE INDEX idx_emp_snapshot ON employment(snapshot_yyyymm);
CREATE INDEX idx_emp_pay ON employment(annualized_adjusted_basic_pay);

-- Composite indexes for common multi-filter patterns
CREATE INDEX idx_emp_agency_state ON employment(agency_code, duty_station_state_abbreviation);
CREATE INDEX idx_emp_agency_occ ON employment(agency_code, occupational_series_code);
CREATE INDEX idx_emp_snapshot_agency ON employment(snapshot_yyyymm, agency_code);

-- Accessions indexes
CREATE INDEX idx_acc_agency ON accessions(agency_code);
CREATE INDEX idx_acc_state ON accessions(duty_station_state_abbreviation);
CREATE INDEX idx_acc_occ ON accessions(occupational_series_code);
CREATE INDEX idx_acc_date ON accessions(personnel_action_effective_date_yyyymm);
CREATE INDEX idx_acc_date_agency ON accessions(personnel_action_effective_date_yyyymm, agency_code);

-- Separations indexes
CREATE INDEX idx_sep_agency ON separations(agency_code);
CREATE INDEX idx_sep_state ON separations(duty_station_state_abbreviation);
CREATE INDEX idx_sep_occ ON separations(occupational_series_code);
CREATE INDEX idx_sep_date ON separations(personnel_action_effective_date_yyyymm);
CREATE INDEX idx_sep_date_agency ON separations(personnel_action_effective_date_yyyymm, agency_code);
CREATE INDEX idx_sep_category ON separations(separation_category_code);
```

**Step 2: Run the schema**

Run: `psql fedwork < scripts/schema.sql`
Expected: CREATE TABLE and CREATE INDEX statements succeed

**Step 3: Verify**

Run: `psql fedwork -c "\dt"`
Expected: Shows employment, accessions, separations, data_imports tables

**Step 4: Commit**

```bash
git add scripts/schema.sql
git commit -m "feat: add database schema with indexes"
```

---

### Task 3: Python Import Script

**Files:**
- Create: `scripts/import.py`

**Step 1: Write the import script**

The script should:
- Accept a file path and dataset type (employment/accessions/separations) as arguments
- Read the pipe-delimited header row to get column names
- Map file column `count` → DB column `employee_count`
- Use PostgreSQL COPY via psycopg2's `copy_expert` with explicit column list from file header
- Use `NULL 'REDACTED'` in the COPY command to convert all REDACTED values to NULL automatically (no file preprocessing needed)
- Compute SHA256 hash of the file for idempotent imports (check `data_imports.file_hash`)
- Log the import to `data_imports` table
- Print progress for the large employment file

**Critical implementation details:**
- The `id SERIAL` column auto-populates — COPY must use an explicit column list: `COPY employment (age_bracket, agency, ...) FROM STDIN WITH (FORMAT CSV, DELIMITER '|', HEADER TRUE, NULL 'REDACTED')`
- `annualized_adjusted_basic_pay` is now NUMERIC — values like "0" import fine, "REDACTED" becomes NULL via the NULL option
- Column name mapping: file header `count` → DB column `employee_count`
- Database connection: use `DATABASE_URL` env var with fallback to `dbname="fedwork"`

Usage: `python3 scripts/import.py accessions /Users/misha/claude_projects/fedwork/accessions_202512_1_2026-02-20.txt`

**Step 2: Test with the small accessions file first**

Run: `python3 scripts/import.py accessions /Users/misha/claude_projects/fedwork/accessions_202512_1_2026-02-20.txt`
Expected: "Imported 9724 rows into accessions"

**Step 3: Verify data**

Run: `psql fedwork -c "SELECT COUNT(*) FROM accessions"`
Expected: 9724

Run: `psql fedwork -c "SELECT agency, duty_station_state_abbreviation, annualized_adjusted_basic_pay FROM accessions WHERE annualized_adjusted_basic_pay IS NOT NULL LIMIT 5"`
Expected: Shows numeric pay values; rows with REDACTED show NULL

**Step 4: Import separations**

Run: `python3 scripts/import.py separations /Users/misha/claude_projects/fedwork/separations_202512_1_2026-02-20.txt`
Expected: "Imported 31738 rows into separations"

**Step 5: Import employment (large file — takes ~1-2 minutes)**

Run: `python3 scripts/import.py employment /Users/misha/claude_projects/fedwork/employment_202512_1_2026-02-20.txt`
Expected: "Imported ~2074649 rows into employment"

**Step 6: Verify all tables**

Run: `psql fedwork -c "SELECT 'employment' as t, COUNT(*) FROM employment UNION ALL SELECT 'accessions', COUNT(*) FROM accessions UNION ALL SELECT 'separations', COUNT(*) FROM separations"`

**Step 7: Commit**

```bash
git add scripts/import.py
git commit -m "feat: add Python import script with COPY bulk loading"
```

---

### Task 4: Scaffold Next.js Project

**Step 1: Initialize Next.js**

Run from `/Users/misha/claude_projects/fedwork`:

```bash
npx create-next-app@latest . --typescript --tailwind --eslint --app --src --no-import-alias --yes
```

Note: If it complains about existing files (scripts/, docs/, data/), it may need `--force` or temporarily moving those dirs.

**Step 2: Create .env.local**

```
DATABASE_URL=postgresql://localhost/fedwork
```

**Step 3: Install shadcn/ui**

Run: `npx shadcn@latest init --defaults`

**Step 4: Install jolyui animated-table**

Run: `npx shadcn@latest add "https://jolyui.dev/r/animated-table"`

**Step 5: Install shadcn components**

Run: `npx shadcn@latest add select badge button input label separator sheet command popover skeleton tooltip scroll-area`

Note: Includes `skeleton` (loading states), `tooltip` (truncated headers), `scroll-area` (sidebar overflow) — flagged as missing in review.

**Step 6: Install PostgreSQL client**

Run: `npm install pg @types/pg`

**Step 7: Verify dev server starts**

Run: `npm run dev`
Expected: Server starts on http://localhost:3000

**Step 8: Commit**

```bash
git add .
git commit -m "feat: scaffold Next.js with shadcn/ui and jolyui animated-table"
```

---

### Task 5: Database Connection Library

**Files:**
- Create: `src/lib/db.ts`

**Step 1: Write the database connection module**

Uses `DATABASE_URL` env var (not hardcoded). Attaches pool to `globalThis` in development to prevent hot-reload re-instantiation.

```typescript
// src/lib/db.ts
import { Pool } from "pg";

const globalForPg = globalThis as typeof globalThis & { pgPool?: Pool };

const pool =
  globalForPg.pgPool ??
  new Pool({
    connectionString: process.env.DATABASE_URL ?? "postgresql://localhost/fedwork",
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  });

if (process.env.NODE_ENV !== "production") globalForPg.pgPool = pool;

export async function query<T extends Record<string, unknown>>(
  text: string,
  params?: (string | number | null)[]
): Promise<T[]> {
  const result = await pool.query(text, params);
  return result.rows as T[];
}

export default pool;
```

**Step 2: Create health check route**

Create `src/app/api/health/route.ts`:

```typescript
import { query } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET() {
  const rows = await query("SELECT COUNT(*) as count FROM employment");
  return NextResponse.json({ status: "ok", employment_count: rows[0].count });
}
```

Run: `curl http://localhost:3000/api/health`
Expected: `{"status":"ok","employment_count":"2074649"}`

**Step 3: Commit**

```bash
git add src/lib/db.ts src/app/api/health/route.ts .env.local
git commit -m "feat: add PostgreSQL connection with globalThis pool pattern"
```

---

### Task 6: Query Builder and Filter Cache

**Files:**
- Create: `src/lib/queries.ts`
- Create: `src/lib/filters.ts`

**Step 1: Write the query builder**

Builds parameterized SQL queries from filter params. Key requirements:
- Cursor-based pagination using `id` column: `WHERE id > $cursor ORDER BY id ASC LIMIT $pageSize`
- When a sort column is specified: use keyset pagination with `(sort_column, id)` tuple
- Sort column validated against an explicit allowlist
- `pageSize` capped at `MAX_PAGE_SIZE = 100`
- For count queries: use `SELECT COUNT(*)` with same WHERE filters (acceptable for filtered queries; for unfiltered, cache the total)
- Exclude NULL values from filter-relevant logic

```typescript
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
  cursor?: string;       // last row id for cursor pagination
  pageSize?: number;
}

const ALLOWED_SORT_COLUMNS = new Set([
  "agency", "duty_station_state", "occupational_series",
  "grade", "annualized_adjusted_basic_pay", "education_level",
  "age_bracket", "length_of_service_years"
]);

const MAX_PAGE_SIZE = 100;
```

Returns `{ sql, params, countSql, countParams }`.

**Step 2: Write the filter options cache**

Uses `unstable_cache` for filter dropdown data. Queries use `WHERE column IS NOT NULL AND column != ''` to exclude REDACTED/empty values.

```typescript
// src/lib/filters.ts
import { unstable_cache } from "next/cache";
import { query } from "@/lib/db";

type Dataset = "employment" | "accessions" | "separations";

export const getFilterOptions = unstable_cache(
  async (dataset: Dataset) => {
    const table = dataset; // table name matches dataset name
    const [agencies, states, grades, occGroups, educations, ages, payPlans, workSchedules] =
      await Promise.all([
        query(`SELECT DISTINCT agency_code, agency FROM ${table} WHERE agency_code IS NOT NULL ORDER BY agency`),
        query(`SELECT DISTINCT duty_station_state_abbreviation, duty_station_state FROM ${table} WHERE duty_station_state_abbreviation IS NOT NULL AND duty_station_state IS NOT NULL ORDER BY duty_station_state`),
        query(`SELECT DISTINCT grade FROM ${table} WHERE grade IS NOT NULL ORDER BY grade`),
        query(`SELECT DISTINCT occupational_group_code, occupational_group FROM ${table} WHERE occupational_group_code IS NOT NULL ORDER BY occupational_group`),
        query(`SELECT DISTINCT education_level_code, education_level FROM ${table} WHERE education_level_code IS NOT NULL ORDER BY education_level`),
        query(`SELECT DISTINCT age_bracket FROM ${table} WHERE age_bracket IS NOT NULL ORDER BY age_bracket`),
        query(`SELECT DISTINCT pay_plan_code, pay_plan FROM ${table} WHERE pay_plan_code IS NOT NULL ORDER BY pay_plan`),
        query(`SELECT DISTINCT work_schedule_code, work_schedule FROM ${table} WHERE work_schedule_code IS NOT NULL ORDER BY work_schedule`),
      ]);
    return { agencies, states, grades, occGroups, educations, ages, payPlans, workSchedules };
  },
  ["filter-options"],
  { revalidate: 86400, tags: ["filter-options"] }
);

export const getStats = unstable_cache(
  async () => {
    const [emp, acc, sep, agencies, states, snapshot] = await Promise.all([
      query("SELECT COUNT(*) as count FROM employment"),
      query("SELECT COUNT(*) as count FROM accessions"),
      query("SELECT COUNT(*) as count FROM separations"),
      query("SELECT COUNT(DISTINCT agency_code) as count FROM employment"),
      query("SELECT COUNT(DISTINCT duty_station_state_abbreviation) as count FROM employment WHERE duty_station_state_abbreviation IS NOT NULL"),
      query("SELECT MAX(snapshot_yyyymm) as latest FROM employment"),
    ]);
    return {
      total_employment: Number(emp[0].count),
      total_accessions: Number(acc[0].count),
      total_separations: Number(sep[0].count),
      agencies_count: Number(agencies[0].count),
      states_count: Number(states[0].count),
      latest_snapshot: snapshot[0].latest as string,
    };
  },
  ["stats"],
  { revalidate: 86400, tags: ["stats"] }
);
```

**Step 3: Commit**

```bash
git add src/lib/queries.ts src/lib/filters.ts
git commit -m "feat: add query builder with cursor pagination and filter cache"
```

---

### Task 7: API Routes for Client-Side Refetches

**Files:**
- Create: `src/app/api/employment/route.ts`
- Create: `src/app/api/accessions/route.ts`
- Create: `src/app/api/separations/route.ts`

These routes are used ONLY for client-side filter/sort/pagination changes after the initial server-rendered page load. The initial page load uses Server Components calling the DB directly (see Task 11).

**Step 1: Write the employment API route**

`GET /api/employment?agency_code=AF&state=TX&cursor=12345&pageSize=50&sort=agency&sortDir=asc`

Returns:
```json
{
  "data": [...rows],
  "total": 12345,
  "nextCursor": 12395,
  "hasMore": true
}
```

- Parse and validate query params
- Cap `pageSize` at 100
- Validate `sort` column against allowlist
- Use query builder from Task 6
- Set `export const maxDuration = 30;` for route timeout

**Step 2: Write accessions and separations routes**

Same pattern + dataset-specific filter fields (accession_category_code, separation_category_code).

**Step 3: Test**

Run: `curl "http://localhost:3000/api/employment?pageSize=5"`
Run: `curl "http://localhost:3000/api/employment?agency_code=AF&pageSize=5"`

**Step 4: Commit**

```bash
git add src/app/api/employment/ src/app/api/accessions/ src/app/api/separations/
git commit -m "feat: add API routes for client-side data refetches"
```

---

### Task 8: Layout and Navigation

**Files:**
- Modify: `src/app/layout.tsx`
- Create: `src/components/nav.tsx`

**Step 1: Build the top navigation**

- App name "FedWork" on the left
- Links: Employment, Accessions, Separations
- Active link highlighted using `usePathname()`
- Use shadcn Button variant="ghost" for nav links
- Mobile: hamburger menu using shadcn Sheet (slide from left)
- Clean, professional look suitable for a government data site

**Step 2: Update root layout**

- Add the nav component
- Set metadata: `title: "FedWork — Federal Workforce Data Browser"`, `description: "Browse and filter federal employee data from OPM"`
- Clean default Next.js boilerplate

**Step 3: Verify navigation renders**

Run dev server, visit http://localhost:3000, check nav shows 3 links.

**Step 4: Commit**

```bash
git add src/app/layout.tsx src/components/nav.tsx
git commit -m "feat: add responsive navigation with mobile hamburger menu"
```

---

### Task 9: Filter Sidebar Component

**Files:**
- Create: `src/components/filter-sidebar.tsx`
- Create: `src/components/filter-combobox.tsx`

**Step 1: Build the filter Combobox component**

A reusable searchable dropdown using shadcn Command + Popover pattern. Used for Agency, Occupational Group, and Occupational Series (lists with many items). Plain shadcn Select used for shorter lists (State, Grade, Pay Plan, Education, Age, Work Schedule).

**Step 2: Build the filter sidebar**

- Receives filter options as props (passed from Server Component parent — NO client-side fetch on mount)
- Renders filters:
  - **Combobox** (searchable): Agency (~85 options), Occupational Group, Occupational Series
  - **Select** (plain dropdown): State, Grade, Pay Plan, Education Level, Age Bracket, Work Schedule
  - For accessions: also shows Accession Category (Select)
  - For separations: also shows Separation Category (Select)
- Each filter has a clear button (X icon)
- "Clear All Filters" button at bottom
- Shows active filter count badge
- Wrapped in shadcn ScrollArea for sidebar overflow on short viewports
- Syncs filters to URL search params using `useSearchParams()` + `useRouter().replace()` (not push — avoids polluting browser history)
- No cascading filters in V1 (deferred to V2)

**Step 3: Mobile filter drawer**

- On screens < md: sidebar is hidden, replaced by a "Filters" Button with Badge showing active filter count
- Button opens a Sheet (drawer from left) containing the same filter controls
- Sheet trigger has `aria-label="Filters, N active"` for screen readers

Props — receives options from Server Component parent:
```typescript
interface FilterSidebarProps {
  dataset: "employment" | "accessions" | "separations";
  options: FilterOptions;  // from getFilterOptions() — already loaded server-side
}
```

Marks: `"use client"` directive.

**Step 4: Commit**

```bash
git add src/components/filter-sidebar.tsx src/components/filter-combobox.tsx
git commit -m "feat: add filter sidebar with Combobox, mobile Sheet drawer, URL sync"
```

---

### Task 10: Data Table Component

**Files:**
- Create: `src/components/data-table.tsx`

**Step 1: Build the data table wrapper around jolyui AnimatedTable**

- Receives `initialData` and `total` as props from Server Component parent (SSR first render)
- On subsequent filter/sort/pagination changes: fetches from API route (client-side)
- Marks: `"use client"` directive

Column configuration:
- **Default visible (6 columns):** Agency, State, Occupation Series, Grade, Annual Pay, Education Level
- **Human-readable headers:** "Agency" not "agency", "Annual Pay" not "annualized_adjusted_basic_pay", "State" not "duty_station_state_abbreviation"
- **Hidden by default (toggleable via column visibility):** Agency Subelement, Age Bracket, Appointment Type, Pay Plan, Work Schedule, Supervisory Status, STEM Occupation, Length of Service, Duty Station Country, all code columns
- Pay values formatted as currency: `$85,000` (use Intl.NumberFormat)
- NULL/missing values shown as a subtle "Suppressed" Badge (for REDACTED data)

Expandable rows:
- Show all fields in a grouped 2-3 column grid layout
- Groups: Organization (agency, subelement), Location (state, country), Position (occupation, grade, pay plan, pay), Workforce (education, age, service length, work schedule, supervisory, STEM)
- Display suppressed values explicitly with "Suppressed" badge

Server-side sorting:
- Click column header → update URL sort/sortDir params → refetch from API
- Verify jolyui supports `aria-sort` on headers; add manually if not

Cursor-based pagination:
- "Load More" button or next/prev page controls using cursor
- Shows "Showing N of X records" count
- Uses Skeleton component while loading

**Step 2: Commit**

```bash
git add src/components/data-table.tsx
git commit -m "feat: add data table with animated-table, cursor pagination, formatted columns"
```

---

### Task 11: Dataset Pages (Server Components)

**Files:**
- Create: `src/app/employment/page.tsx`
- Create: `src/app/accessions/page.tsx`
- Create: `src/app/separations/page.tsx`

**Critical: Pages are async Server Components — NOT client components.**

They call the database directly for the initial render, then pass data as props to client components.

**Step 1: Build the employment page**

```typescript
// src/app/employment/page.tsx — Server Component (no "use client")
import { Suspense } from "react";
import { query } from "@/lib/db";
import { buildQuery } from "@/lib/queries";
import { getFilterOptions } from "@/lib/filters";
import { FilterSidebar } from "@/components/filter-sidebar";
import { DataTable } from "@/components/data-table";

interface Props {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function EmploymentPage({ searchParams }: Props) {
  // Next.js 15: searchParams is a Promise, must be awaited
  const params = await searchParams;
  const filters = parseFilters(params);

  const { sql, sqlParams, countSql, countParams } = buildQuery("employment", filters);
  const [rows, countResult, filterOptions] = await Promise.all([
    query(sql, sqlParams),
    query(countSql, countParams),
    getFilterOptions("employment"),
  ]);

  return (
    <div className="flex flex-col md:flex-row gap-4 p-4">
      <Suspense fallback={<FilterSidebarSkeleton />}>
        <FilterSidebar dataset="employment" options={filterOptions} />
      </Suspense>
      <Suspense fallback={<DataTableSkeleton />}>
        <DataTable
          dataset="employment"
          initialData={rows}
          total={Number(countResult[0].count)}
          filters={filters}
        />
      </Suspense>
    </div>
  );
}
```

Layout:
```
Desktop (md+):
+------------------+----------------------------------------+
| Filters          | Employment Data        [search] [cols] |
| (ScrollArea)     |                                        |
| Agency [search]  | Agency | State | Occupation | Grade .. |
| State ▼          | DOD    | TX    | Engineer   | 12    .. |
| Occupation [s]   | DOD    | TX    | Analyst    | 11    .. |
| Grade ▼          | ...                                    |
| Pay Plan ▼       |                                        |
| Education ▼      | Showing 50 of 2,074,649                |
| [Clear All]      | [Load More]                            |
+------------------+----------------------------------------+

Mobile (<md):
+----------------------------------------+
| [Filters (3)] Employment Data          |
|                                        |
| Agency | State | Occupation | Grade .. |
| (horizontal scroll)                    |
+----------------------------------------+
```

**Step 2: Build accessions and separations pages**

Same pattern with dataset-specific props.

**Step 3: Verify all 3 pages render with data**

Visit each page, apply a filter via URL params, verify table shows filtered data on first render (check page source — data should be in the HTML, not fetched client-side).

**Step 4: Commit**

```bash
git add src/app/employment/ src/app/accessions/ src/app/separations/
git commit -m "feat: add Server Component dataset pages with SSR data loading"
```

---

### Task 12: Landing Page

**Files:**
- Modify: `src/app/page.tsx`
- Create: `src/components/stats-overview.tsx`

**Step 1: Build the landing page (Server Component)**

- Calls `await getStats()` directly (cached via `unstable_cache`) — no API fetch
- Shows stat cards: Total Employees, New Hires (Dec 2025), Separations (Dec 2025), Agencies
  - Labels reference actual data period from `latest_snapshot`, not "this month"
  - Net change callout: separations minus accessions, with up/down arrow icon (not color-only)
- Brief description: what FedWork is, what "accessions" and "separations" mean
- CTA buttons to each dataset: "Browse 2M+ Employment Records", "View New Hires", "View Separations"
- Data source attribution: "Source: U.S. Office of Personnel Management"

**Step 2: Commit**

```bash
git add src/app/page.tsx src/components/stats-overview.tsx
git commit -m "feat: add landing page with cached stats and dataset CTAs"
```

---

### Task 13: Python Auto-Download Script

**Files:**
- Create: `scripts/download.py`

**Step 1: Write the download script**

- Fetches the OPM data downloads page at `https://data.opm.gov/explore-data/data/data-downloads`
- Finds download links for: Federal Accessions Raw Data, Federal Separations Raw Data, Federal Employment Raw Data
- Downloads each file to `data/` directory
- Checks `data_imports.file_hash` (SHA256) to skip already-imported files
- After download, runs import.py for each new file
- Supports `--dry-run` flag to show what would be downloaded
- Logs results

Usage: `python3 scripts/download.py`

**Step 2: Test**

Run: `python3 scripts/download.py --dry-run`
Expected: Shows which files would be downloaded

**Step 3: Commit**

```bash
git add scripts/download.py
git commit -m "feat: add OPM data auto-download script with hash-based dedup"
```

---

### Task 14: Cache Invalidation After Import

**Files:**
- Create: `src/app/api/revalidate/route.ts`
- Modify: `scripts/import.py` (add post-import cache bust)

**Step 1: Create revalidation API route**

A simple POST endpoint that calls `revalidateTag("filter-options")` and `revalidateTag("stats")` to bust the Next.js cache after a data import. Protected by a secret token from env var.

```typescript
import { revalidateTag } from "next/cache";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const { token } = await request.json();
  if (token !== process.env.REVALIDATE_TOKEN) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  revalidateTag("filter-options");
  revalidateTag("stats");
  return NextResponse.json({ revalidated: true });
}
```

**Step 2: Add cache bust call to import.py**

After successful import, the Python script calls `POST /api/revalidate` with the token to clear stale cached data.

**Step 3: Commit**

```bash
git add src/app/api/revalidate/ scripts/import.py
git commit -m "feat: add cache invalidation after data import"
```

---

### Task 15: Polish and Production Prep

**Step 1: Verify .env.local has all required vars**

```
DATABASE_URL=postgresql://localhost/fedwork
REVALIDATE_TOKEN=<random-secret>
```

**Step 2: Update .gitignore**

Ensure `data/*.txt`, `.env.local`, `.env`, `node_modules/`, `.next/` are listed.

**Step 3: Final review pass**

- Test all 3 dataset pages with various filters
- Test mobile layout (resize browser to 390px)
- Test expandable rows
- Verify cursor pagination works (click Load More multiple times)
- Verify filter URL sharing (copy URL, paste in new tab → same results)

**Step 4: Commit**

```bash
git add -A
git commit -m "feat: production polish and final verification"
```
