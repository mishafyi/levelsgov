# FedWork — Federal Workforce Data Browser

## Problem
OPM publishes monthly federal workforce data (employment, accessions, separations) as pipe-delimited text files. The employment file alone has 2M+ rows. There's no easy way for the public to filter and browse this data.

## Solution
A public website that lets users filter and browse federal employee records by agency, state, occupation, pay grade, education level, and more.

## Architecture

**Stack**: Next.js (App Router) + PostgreSQL + Python data pipeline
**UI**: shadcn/ui + jolyui animated-table (`npx shadcn@latest add "https://jolyui.dev/r/animated-table"`)
**Hosting**: VPS (develop locally first)

## Data

Three datasets from OPM, updated monthly:

| Dataset | Rows/month | Size | Unique fields |
|---------|-----------|------|---------------|
| Employment | ~2M | 776MB | snapshot_yyyymm |
| Accessions | ~10K | 4.3MB | accession_category, personnel_action_effective_date_yyyymm |
| Separations | ~32K | 12MB | separation_category, personnel_action_effective_date_yyyymm |

Common fields (30 columns): age_bracket, agency, agency_code, agency_subelement, agency_subelement_code, annualized_adjusted_basic_pay, appointment_type, appointment_type_code, count, duty_station_country, duty_station_country_code, duty_station_state, duty_station_state_abbreviation, duty_station_state_code, education_level, education_level_code, grade, length_of_service_years, occupational_group, occupational_group_code, occupational_series, occupational_series_code, pay_plan, pay_plan_code, stem_occupation, stem_occupation_type, supervisory_status, supervisory_status_code, work_schedule, work_schedule_code

Each row = one person. Some rows have REDACTED values for location/pay (privacy).

## Database Schema

### Tables

**employment** — Current workforce snapshot
- All common columns + snapshot_yyyymm
- Indexes: agency_code, duty_station_state_abbreviation, occupational_series_code, grade, pay_plan_code, education_level_code, age_bracket

**accessions** — New hires
- All common columns + accession_category, accession_category_code, personnel_action_effective_date_yyyymm
- Same indexes as employment

**separations** — Departures
- All common columns + separation_category, separation_category_code, personnel_action_effective_date_yyyymm
- Same indexes as employment

**data_imports** — Import tracking
- id, dataset_type, filename, imported_at, row_count, snapshot_month, status

## API

| Endpoint | Purpose |
|----------|---------|
| GET /api/employment | Paginated, filtered query |
| GET /api/accessions | Same + accession_category filter |
| GET /api/separations | Same + separation_category filter |
| GET /api/filters/:dataset | Distinct values for filter dropdowns (cached) |
| GET /api/stats | Overview stats for landing page |

Filter params: agency, state, grade, occupation, education, age, work_schedule, pay_plan, page, pageSize, sort, sortDir

## UI

### Pages
- `/` — Landing page with overview stats
- `/employment` — Browse current workforce
- `/accessions` — Browse new hires
- `/separations` — Browse departures

### Layout
- Top nav: app name + dataset links
- Left sidebar: filter dropdowns (shadcn Select/Combobox)
- Main area: jolyui AnimatedTable with sorting, search, pagination, expandable rows, column visibility

### Filter behavior
- URL-based (query params) for shareable/bookmarkable views
- Cascading filters (selecting agency updates sub-elements)
- Server-side filtering and pagination

## Data Pipeline (Python)

### Auto-download (scripts/download.py)
- Scrapes OPM data downloads page for latest files
- Downloads only new files not yet imported
- Cron: `0 6 1 * *` (6am, 1st of month)

### Import (scripts/import.py)
- Parses pipe-delimited text files
- Bulk loads via PostgreSQL COPY
- Creates/refreshes indexes
- Logs to data_imports table

## Project Structure

```
fedwork/
├── app/                    # Next.js App Router
│   ├── page.tsx            # Landing page
│   ├── employment/page.tsx
│   ├── accessions/page.tsx
│   ├── separations/page.tsx
│   ├── api/                # API routes
│   └── layout.tsx
├── components/
│   ├── ui/                 # shadcn components
│   ├── filter-sidebar.tsx
│   ├── data-table.tsx      # Wraps jolyui animated-table
│   └── stats-overview.tsx
├── lib/
│   ├── db.ts               # PostgreSQL connection
│   └── queries.ts          # SQL query builders
├── scripts/
│   ├── download.py         # OPM auto-downloader
│   └── import.py           # Parse & load into Postgres
└── data/                   # Raw downloaded files
```
