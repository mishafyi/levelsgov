/**
 * fedwork DB access for the journalist worker — a slim `pg.Pool` + typed,
 * fully-parameterized query helpers. Reads the OPM flow tables (`accessions`/
 * `separations`), the snapshot table (`employment`), and the `posts` table.
 * Imports NOTHING from fedwork `src/**` — the worker is standalone.
 *
 * The tables (schema per scripts/schema.sql):
 *   - accessions / separations: monthly FLOW, keyed by
 *     `personnel_action_effective_date_yyyymm`; `employee_count` is the
 *     per-row headcount; `separation_category` distinguishes retirement vs quit.
 *   - employment: a point-in-time SNAPSHOT keyed by `snapshot_yyyymm`, carrying
 *     `annualized_adjusted_basic_pay` (per-row salary).
 */
import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 5,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
});

/** Thrown when an insert hits the unique(slug) — the engine's anti-repetition
 *  should have prevented it, so a collision is a real signal, not a no-op. */
export class SlugCollisionError extends Error {
  constructor(slug: string) {
    super(`post slug already exists: ${slug}`);
    this.name = "SlugCollisionError";
  }
}

async function q<T>(
  text: string,
  params: (string | number | null | string[])[],
): Promise<T[]> {
  const res = await pool.query(text, params);
  return res.rows as T[];
}

/** Flow tables the flow-month helper accepts (typed, not free string). */
export type FlowTable = "accessions" | "separations";

/** Runtime allowlist for the two sites where `FlowTable` is inlined into SQL
 *  (a table name can't be a bound parameter). TypeScript's union is erased at
 *  runtime, so this guards against a future caller smuggling an unvalidated
 *  string into the interpolated table name. */
function assertFlowTable(table: FlowTable): void {
  if (table !== "accessions" && table !== "separations") {
    throw new Error(`invalid flow table: ${JSON.stringify(table)}`);
  }
}

/** The latest employment snapshot month (YYYYMM). */
export async function latestSnapshot(): Promise<string> {
  const rows = await q<{ m: string | null }>(
    `SELECT MAX(snapshot_yyyymm) AS m FROM employment`,
    [],
  );
  const m = rows[0]?.m;
  if (!m) throw new Error("employment table has no snapshot_yyyymm");
  return m;
}

/** The latest flow month (YYYYMM) present in the given flow table. */
export async function latestFlowMonth(table: FlowTable): Promise<string> {
  // `table` is inlined below (a table name can't be a bound param) — guard the
  // union at runtime since types are erased.
  assertFlowTable(table);
  const rows = await q<{ m: string | null }>(
    `SELECT MAX(personnel_action_effective_date_yyyymm) AS m FROM ${table}`,
    [],
  );
  const m = rows[0]?.m;
  if (!m) throw new Error(`${table} table has no flow month`);
  return m;
}

/** One agency's month-over-month hiring/separation deltas + occupation/category mix. */
export interface SpikeRow {
  agency: string;
  agencyCode: string;
  hires: number;
  hiresPrev: number;
  seps: number;
  sepsPrev: number;
  /** Top occupations by hires this month (up to 3). */
  topHireOccupations: string[];
  /** Dominant separation categories this month (up to 3, by count). */
  topSepCategories: string[];
  /** max(|hires delta|, |seps delta|) — the ranking key. */
  absDelta: number;
}

interface FlowAggRow {
  agency: string | null;
  agency_code: string | null;
  cur: string;
  prev: string;
}

interface OccRow {
  agency_code: string | null;
  occupational_series: string | null;
  cnt: string;
}

interface CatRow {
  agency_code: string | null;
  separation_category: string | null;
  cnt: string;
}

/** The prior YYYYMM string (handles the Dec→Jan year rollover). */
function priorMonth(yyyymm: string): string {
  const year = Number(yyyymm.slice(0, 4));
  const month = Number(yyyymm.slice(4, 6));
  const d = month === 1 ? { y: year - 1, m: 12 } : { y: year, m: month - 1 };
  return `${d.y}${String(d.m).padStart(2, "0")}`;
}

/** Per-agency current + prior-month `employee_count` sums for one flow table. */
async function flowByAgency(
  table: FlowTable,
  cur: string,
  prev: string,
): Promise<FlowAggRow[]> {
  assertFlowTable(table);
  return q<FlowAggRow>(
    `SELECT agency,
            agency_code,
            SUM(CASE WHEN personnel_action_effective_date_yyyymm = $1
                     THEN employee_count ELSE 0 END)::bigint AS cur,
            SUM(CASE WHEN personnel_action_effective_date_yyyymm = $2
                     THEN employee_count ELSE 0 END)::bigint AS prev
       FROM ${table}
      WHERE personnel_action_effective_date_yyyymm IN ($1, $2)
        AND agency_code IS NOT NULL
      GROUP BY agency, agency_code`,
    [cur, prev],
  );
}

/** Top-N occupations by hire headcount per agency for the current accession month. */
async function topHireOccupationsByAgency(cur: string): Promise<Map<string, string[]>> {
  const rows = await q<OccRow>(
    `SELECT agency_code, occupational_series,
            SUM(employee_count)::bigint AS cnt
       FROM accessions
      WHERE personnel_action_effective_date_yyyymm = $1
        AND occupational_series IS NOT NULL
      GROUP BY agency_code, occupational_series
      ORDER BY cnt DESC`,
    [cur],
  );
  const byAgency = new Map<string, string[]>();
  for (const r of rows) {
    const code = r.agency_code ?? "";
    const list = byAgency.get(code) ?? [];
    if (list.length < 3 && r.occupational_series) list.push(r.occupational_series);
    byAgency.set(code, list);
  }
  return byAgency;
}

/** Top-N separation categories per agency for the current separation month. */
async function topSepCategoriesByAgency(cur: string): Promise<Map<string, string[]>> {
  const rows = await q<CatRow>(
    `SELECT agency_code, separation_category,
            SUM(employee_count)::bigint AS cnt
       FROM separations
      WHERE personnel_action_effective_date_yyyymm = $1
        AND separation_category IS NOT NULL
      GROUP BY agency_code, separation_category
      ORDER BY cnt DESC`,
    [cur],
  );
  const byAgency = new Map<string, string[]>();
  for (const r of rows) {
    const code = r.agency_code ?? "";
    const list = byAgency.get(code) ?? [];
    if (list.length < 3 && r.separation_category) list.push(r.separation_category);
    byAgency.set(code, list);
  }
  return byAgency;
}

/**
 * The SIGNAL query. For the latest flow month vs the prior month, per agency:
 * hires (SUM accessions.employee_count), hires_prev, seps, seps_prev, plus the
 * top-3 hire occupations and the dominant separation categories. Returns the 12
 * largest absolute MoM deltas (across hires OR separations).
 *
 * Uses the latest ACCESSION month as the reference `cur`; separations are read
 * for the same month so the two sides line up. One aggregate query per table +
 * a JS merge (the wire contract can't express these aggregations).
 */
export async function agencySpikes(): Promise<SpikeRow[]> {
  const cur = await latestFlowMonth("accessions");
  const prev = priorMonth(cur);

  const [accAgg, sepAgg, hireOccs, sepCats] = await Promise.all([
    flowByAgency("accessions", cur, prev),
    flowByAgency("separations", cur, prev),
    topHireOccupationsByAgency(cur),
    topSepCategoriesByAgency(cur),
  ]);

  const merged = new Map<
    string,
    { agency: string; hires: number; hiresPrev: number; seps: number; sepsPrev: number }
  >();
  const ensure = (code: string, agency: string) => {
    const existing = merged.get(code);
    if (existing) {
      if (existing.agency === "" && agency) existing.agency = agency;
      return existing;
    }
    const fresh = { agency, hires: 0, hiresPrev: 0, seps: 0, sepsPrev: 0 };
    merged.set(code, fresh);
    return fresh;
  };
  for (const r of accAgg) {
    const rec = ensure(r.agency_code ?? "", r.agency ?? "");
    rec.hires = Number(r.cur);
    rec.hiresPrev = Number(r.prev);
  }
  for (const r of sepAgg) {
    const rec = ensure(r.agency_code ?? "", r.agency ?? "");
    rec.seps = Number(r.cur);
    rec.sepsPrev = Number(r.prev);
  }

  const spikes: SpikeRow[] = [];
  for (const [code, rec] of merged) {
    if (!code) continue;
    const hireDelta = Math.abs(rec.hires - rec.hiresPrev);
    const sepDelta = Math.abs(rec.seps - rec.sepsPrev);
    spikes.push({
      agency: rec.agency || code,
      agencyCode: code,
      hires: rec.hires,
      hiresPrev: rec.hiresPrev,
      seps: rec.seps,
      sepsPrev: rec.sepsPrev,
      topHireOccupations: hireOccs.get(code) ?? [],
      topSepCategories: sepCats.get(code) ?? [],
      absDelta: Math.max(hireDelta, sepDelta),
    });
  }
  spikes.sort((a, b) => b.absDelta - a.absDelta);
  return spikes.slice(0, 12);
}

/** Per-agency month hires total + top-5 occupations (count + median pay). */
export interface AgencyBoardRow {
  agency: string;
  agencyCode: string;
  monthHires: number;
  occupations: { occupation: string; count: number; medianPay: number }[];
}

interface BoardOccRow {
  occupational_series: string | null;
  cnt: string;
  median_pay: string | null;
}

/**
 * Board facts for the named agencies: this month's total hires plus the top-5
 * occupations with a COUNT and the MEDIAN annualized pay (from the latest
 * employment snapshot). Feeds the board-facts enrichment slot.
 */
export async function agencyBoard(agencies: string[]): Promise<AgencyBoardRow[]> {
  if (agencies.length === 0) return [];
  const cur = await latestFlowMonth("accessions");
  const snapshot = await latestSnapshot();

  const out: AgencyBoardRow[] = [];
  for (const code of agencies) {
    const hiresRows = await q<{ agency: string | null; total: string }>(
      `SELECT MAX(agency) AS agency, SUM(employee_count)::bigint AS total
         FROM accessions
        WHERE personnel_action_effective_date_yyyymm = $1 AND agency_code = $2`,
      [cur, code],
    );
    const monthHires = Number(hiresRows[0]?.total ?? 0);
    const agencyName = hiresRows[0]?.agency ?? code;

    // Top-5 occupations for this agency: hire count from the flow month, median
    // pay from the snapshot (a percentile_cont over the snapshot rows).
    const occRows = await q<BoardOccRow>(
      `SELECT a.occupational_series,
              SUM(a.employee_count)::bigint AS cnt,
              (SELECT percentile_cont(0.5) WITHIN GROUP (
                        ORDER BY e.annualized_adjusted_basic_pay)
                 FROM employment e
                WHERE e.snapshot_yyyymm = $3
                  AND e.agency_code = $2
                  AND e.occupational_series = a.occupational_series
                  AND e.annualized_adjusted_basic_pay IS NOT NULL
              ) AS median_pay
         FROM accessions a
        WHERE a.personnel_action_effective_date_yyyymm = $1
          AND a.agency_code = $2
          AND a.occupational_series IS NOT NULL
        GROUP BY a.occupational_series
        ORDER BY cnt DESC
        LIMIT 5`,
      [cur, code, snapshot],
    );

    out.push({
      agency: agencyName,
      agencyCode: code,
      monthHires,
      occupations: occRows.map((r) => ({
        occupation: r.occupational_series ?? "",
        count: Number(r.cnt),
        medianPay: Math.round(Number(r.median_pay ?? 0)),
      })),
    });
  }
  return out;
}

/** An agency ranked by this month's hiring volume. */
export interface TopHiringAgency {
  agency: string;
  agencyCode: string;
  hires: number;
}

/** Top-N agencies by hire headcount for the latest accession flow month. */
export async function topAgenciesByHires(
  limit: number,
): Promise<TopHiringAgency[]> {
  const cur = await latestFlowMonth("accessions");
  const rows = await q<{ agency: string | null; agency_code: string | null; hires: string }>(
    `SELECT MAX(agency) AS agency, agency_code, SUM(employee_count)::bigint AS hires
       FROM accessions
      WHERE personnel_action_effective_date_yyyymm = $1
        AND agency_code IS NOT NULL
      GROUP BY agency_code
      ORDER BY hires DESC
      LIMIT $2`,
    [cur, limit],
  );
  return rows.map((r) => ({
    agency: r.agency ?? r.agency_code ?? "",
    agencyCode: r.agency_code ?? "",
    hires: Number(r.hires),
  }));
}

/** Site-wide totals from the latest employment snapshot. */
export interface SiteTotals {
  employees: number;
  agencies: number;
  occupations: number;
  snapshot: string;
}

export async function siteTotals(): Promise<SiteTotals> {
  const snapshot = await latestSnapshot();
  const rows = await q<{
    employees: string;
    agencies: string;
    occupations: string;
  }>(
    `SELECT SUM(employee_count)::bigint AS employees,
            COUNT(DISTINCT agency_code) AS agencies,
            COUNT(DISTINCT occupational_series_code) AS occupations
       FROM employment
      WHERE snapshot_yyyymm = $1`,
    [snapshot],
  );
  return {
    employees: Number(rows[0]?.employees ?? 0),
    agencies: Number(rows[0]?.agencies ?? 0),
    occupations: Number(rows[0]?.occupations ?? 0),
    snapshot,
  };
}

/** A previously-published post, for the engine's anti-repetition. */
export interface CoveredPostRow {
  title: string;
  slug: string;
  entities: string[];
  date: string;
}

/** The last 200 posts, any status — feeds coveredTopics(). */
export async function coveredPosts(): Promise<CoveredPostRow[]> {
  const rows = await q<{
    title: string;
    slug: string;
    entities: string[] | null;
    created_at: Date;
  }>(
    `SELECT title, slug, entities, created_at
       FROM posts
      ORDER BY created_at DESC
      LIMIT 200`,
    [],
  );
  return rows.map((r) => ({
    title: r.title,
    slug: r.slug,
    entities: r.entities ?? [],
    date:
      r.created_at instanceof Date
        ? r.created_at.toISOString().slice(0, 10)
        : String(r.created_at).slice(0, 10),
  }));
}

/** The finished post to persist. */
export interface InsertPostInput {
  slug: string;
  title: string;
  description: string | null;
  markdown: string;
  byline: string | null;
  targetKeyword: string | null;
  entities: string[];
  telemetry: Record<string, unknown> | null;
  status: "draft" | "published";
  publishedAt: string | null;
}

/**
 * Insert a finished post. `ON CONFLICT (slug) DO NOTHING` → a conflict returns
 * no row, which we surface as `SlugCollisionError` (a real signal, not a
 * silent no-op).
 */
export async function insertPost(post: InsertPostInput): Promise<{ id: number }> {
  const rows = await q<{ id: string }>(
    `INSERT INTO posts
       (slug, title, description, markdown, byline, target_keyword,
        entities, telemetry, status, published_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, $10)
     ON CONFLICT (slug) DO NOTHING
     RETURNING id`,
    [
      post.slug,
      post.title,
      post.description,
      post.markdown,
      post.byline,
      post.targetKeyword,
      post.entities,
      post.telemetry === null ? null : JSON.stringify(post.telemetry),
      post.status,
      post.publishedAt,
    ],
  );
  const id = rows[0]?.id;
  if (id === undefined) throw new SlugCollisionError(post.slug);
  return { id: Number(id) };
}

/** Close the pool (graceful shutdown). */
export async function closeDb(): Promise<void> {
  await pool.end();
}
