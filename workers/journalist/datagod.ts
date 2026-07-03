/**
 * DataGod client — US GOVERNMENT PRIMARY data for the federal-workforce beat.
 *
 * DataGod (https://datagod.myclaudeapp.com) is a keyed gateway over US
 * government/financial sources. For a federal-workforce publication three
 * sources earn a slot, each live-probed against the deployed instance
 * (2026-07-02):
 *
 *  - Federal Register — the authoritative record of rules/notices affecting the
 *    workforce (RIFs, hiring freezes, pay tables). `data` is a plain array of
 *    {title,type,publication_date}. Probe: `term=federal workforce&limit=3`
 *    returned "Promoting Employee Accountability" (Proposed Rule, 2026-07-02).
 *  - USAspending by-agency — agency-level obligated totals per fiscal quarter.
 *    `?fy&quarter` → {total,end_date,results:[{name,amount,code,…}]}. The latest
 *    CLOSED quarter is used (newest-first walk; an unclosed quarter upstream-400s
 *    — FY2026 Q3 did on probe). Results are matched to the topic's agencies by
 *    `name`. `/usaspending/search` (recipient-keyed) is the secondary path.
 *  - BLS — labor series. REQUIRES both `start_year` AND `end_year` (a missing
 *    end_year returns HTTP 200 with a FastAPI validation error hidden in
 *    `data.detail`, NOT a series — the ZeroG client's single-year call would
 *    silently get nothing). Verified series: `unemployment` (LNS14000000, 4.2%),
 *    `hourly_earnings` (CEU0500000003, $37.34/hr), and CES9091000001 = federal
 *    government all-employees (2,686 thousand, June 2026) — the on-beat headline.
 *
 * Envelope: {meta,data,error}; success = 200 + meta.status==="success" AND no
 * `data.detail` validation payload. Auth via X-API-Key. Client timeout 35s
 * (runbook-mandated: datagod's upstream client uses 30s — do NOT copy ZeroG's
 * 15s). Best-effort by construction: no DATAGOD_API_KEY or any failure → "" and
 * one log line; the piece proceeds on web sources alone, never throws.
 */

const DATAGOD_URL = process.env.DATAGOD_URL ?? "https://datagod.myclaudeapp.com";
const FED_REGISTER_LIMIT = Number(process.env.JOURNALIST_DG_FR_LIMIT ?? "5");
const BLS_OBSERVATIONS = Number(process.env.JOURNALIST_DG_BLS_POINTS ?? "3");

interface DatagodEnvelope<T> {
  meta: { status: string };
  data: T;
  error: string | null;
}

/** FastAPI 422-style validation payload some endpoints return under a 200. */
interface ValidationDetail {
  detail: { type: string; loc: string[]; msg: string }[];
}

function isValidationError(data: unknown): data is ValidationDetail {
  return (
    typeof data === "object" &&
    data !== null &&
    "detail" in data &&
    Array.isArray((data as { detail: unknown }).detail)
  );
}

/**
 * One authenticated GET against the DataGod gateway → the envelope's `data`.
 * Throws on transport failure, a non-"success" status, an `error`, or a hidden
 * validation payload — callers wrap in a best-effort try/catch (never fatal).
 */
async function datagodGet<T>(
  path: string,
  params: Record<string, string>,
): Promise<T> {
  const key = process.env.DATAGOD_API_KEY;
  if (!key) throw new Error("DATAGOD_API_KEY unset");
  const url = new URL(path, DATAGOD_URL);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url, {
    headers: { "X-API-Key": key },
    signal: AbortSignal.timeout(35_000),
  });
  if (!res.ok) {
    throw new Error(`DataGod ${path} HTTP ${res.status}`);
  }
  const body = (await res.json()) as DatagodEnvelope<T>;
  if (body.meta.status !== "success" || body.error) {
    throw new Error(`DataGod ${path}: ${body.error ?? body.meta.status}`);
  }
  if (isValidationError(body.data)) {
    const fields = body.data.detail.map((d) => d.loc.join(".")).join(", ");
    throw new Error(`DataGod ${path}: missing/invalid params (${fields})`);
  }
  return body.data;
}

// ── Federal Register ────────────────────────────────────────────────────────

interface FedRegisterDoc {
  title?: string;
  type?: string;
  publication_date?: string;
}

interface FedRegisterData {
  results?: FedRegisterDoc[];
}

/**
 * Recent Federal Register documents matching a term. `data` is a paginated
 * object `{description,count,total_pages,next_page_url,results}` (probe-
 * confirmed) — the documents live under `results`. The upstream `agency` param
 * takes a Federal Register SLUG (not a display name; the full name upstream-
 * 400s), so this queries by term only and lets the broad workforce term surface
 * the on-beat rules — no fragile name→slug mapping.
 */
async function federalRegister(term: string): Promise<FedRegisterDoc[]> {
  const data = await datagodGet<FedRegisterData>("/federal-register", {
    term,
    limit: String(FED_REGISTER_LIMIT),
  });
  return (data.results ?? []).slice(0, FED_REGISTER_LIMIT);
}

// ── USAspending (by-agency, newest closed quarter) ──────────────────────────

interface AgencySpendRow {
  name?: string;
  amount?: number;
  code?: string;
}

interface ByAgencyData {
  total?: number;
  end_date?: string;
  results?: AgencySpendRow[];
}

/**
 * Fiscal (fy, quarter) pairs to try newest-first. The freshest CLOSED quarter
 * wins; an unclosed quarter upstream-400s and is skipped. Kept relative to the
 * current date so it stays fresh without a code change.
 */
function recentFiscalQuarters(): { fy: number; quarter: number }[] {
  const now = new Date();
  // US federal FY starts Oct 1: months Oct–Dec belong to the NEXT calendar FY.
  const month = now.getUTCMonth() + 1;
  const fy = month >= 10 ? now.getUTCFullYear() + 1 : now.getUTCFullYear();
  const pairs: { fy: number; quarter: number }[] = [];
  for (let q = 4; q >= 1; q -= 1) pairs.push({ fy, quarter: q });
  for (let q = 4; q >= 1; q -= 1) pairs.push({ fy: fy - 1, quarter: q });
  return pairs;
}

interface AgencySpend {
  agency: string;
  amount: number;
  fy: number;
  quarter: number;
  endDate: string;
}

/**
 * The obligated total for each named agency in the latest CLOSED fiscal quarter.
 * Walks quarters newest-first until one returns data, then matches `results` to
 * the requested agencies by case-insensitive name containment.
 */
async function agencySpending(agencies: string[]): Promise<AgencySpend[]> {
  if (agencies.length === 0) return [];
  for (const { fy, quarter } of recentFiscalQuarters()) {
    let data: ByAgencyData;
    try {
      data = await datagodGet<ByAgencyData>("/usaspending/by-agency", {
        fy: String(fy),
        quarter: String(quarter),
      });
    } catch {
      continue; // unclosed / upstream error → try the prior quarter
    }
    const rows = data.results ?? [];
    if (rows.length === 0) continue;
    const endDate = (data.end_date ?? "").slice(0, 10);
    const out: AgencySpend[] = [];
    for (const target of agencies) {
      const needle = target.toLowerCase();
      const hit = rows.find(
        (r) =>
          typeof r.name === "string" &&
          typeof r.amount === "number" &&
          (r.name.toLowerCase().includes(needle) ||
            needle.includes(r.name.toLowerCase())),
      );
      if (hit && typeof hit.amount === "number") {
        out.push({
          agency: hit.name ?? target,
          amount: hit.amount,
          fy,
          quarter,
          endDate,
        });
      }
    }
    return out;
  }
  return [];
}

// ── BLS labor series (both years required) ──────────────────────────────────

/**
 * Only series whose meaning is VERIFIED (live-tested at plausible scale). Units
 * ride each label so the unit-aware figure gate can match article forms.
 */
const BLS_SERIES: {
  id: string;
  label: string;
  unit: "%" | "$" | "k";
}[] = [
  {
    id: "CES9091000001",
    label: "Federal government employment, all employees (thousands, BLS CES)",
    unit: "k",
  },
  {
    id: "unemployment",
    label: "US unemployment rate (%, BLS LNS14000000)",
    unit: "%",
  },
  {
    id: "hourly_earnings",
    label:
      "US average hourly earnings, total private ($/hour, BLS CES CEU0500000003)",
    unit: "$",
  },
];

interface BlsPoint {
  year: string;
  periodName: string;
  value: string;
  footnotes?: { text?: string }[];
}

interface BlsData {
  Results?: { series?: { data?: BlsPoint[] }[] };
}

/** Latest observations for a BLS series id — REQUIRES start_year + end_year. */
async function blsSeries(id: string): Promise<BlsPoint[]> {
  const now = new Date().getUTCFullYear();
  const data = await datagodGet<BlsData>(`/bls/${id}`, {
    start_year: String(now - 1),
    end_year: String(now),
  });
  return (data.Results?.series?.[0]?.data ?? [])
    .filter((p): p is BlsPoint => p !== null && typeof p === "object")
    .slice(0, BLS_OBSERVATIONS);
}

function formatBlsValue(
  point: BlsPoint,
  unit: "%" | "$" | "k",
): string {
  const preliminary = point.footnotes?.some((f) =>
    f.text?.toLowerCase().includes("preliminary"),
  )
    ? " (preliminary)"
    : "";
  const value =
    unit === "$"
      ? `$${point.value}`
      : unit === "%"
        ? `${point.value}%`
        : `${point.value} thousand`;
  return `${point.periodName} ${point.year}: ${value}${preliminary}`;
}

const usd = (n: number): string => `$${Math.round(n).toLocaleString("en-US")}`;

/**
 * One research-corpus block of US-government primary facts for this article:
 * Federal Register documents (workforce term + per-agency), USAspending agency
 * obligated totals, and BLS labor series. Returns "" when the key is missing or
 * everything fails — callers append it to the research corpus where the tier-1
 * label steers both the draft's source preference and the fact-guard's
 * primary-source rule.
 *
 * @param category the chosen topic's taxonomy key (unused for source selection
 *   here — the beat is fixed — kept for the PipelineEnrichment signature).
 * @param agencies the topic's agencies (first ~3 drive the per-agency lookups).
 */
export async function gatherDatagodFacts(
  category: string,
  agencies: string[],
): Promise<string> {
  void category;
  if (!process.env.DATAGOD_API_KEY) return "";
  const sections: string[] = [];
  const topAgencies = agencies.slice(0, 3);

  // ── Federal Register: the broad workforce query (agency param needs a FR
  //    slug we don't carry, so a term query surfaces the on-beat rules) ──
  try {
    const docs = await federalRegister("federal workforce");
    const lines = docs
      .filter((d) => d.title)
      .map(
        (d) =>
          `- ${d.title} (${d.type ?? "document"}, ${d.publication_date ?? "n.d."})`,
      );
    if (lines.length > 0) {
      sections.push(
        `FEDERAL REGISTER (federalregister.gov — official rules/notices affecting the federal workforce):\n\n${lines.join("\n")}`,
      );
    }
  } catch (err) {
    process.stdout.write(
      `        datagod federal-register skipped: ${
        err instanceof Error ? err.message : String(err)
      }\n`,
    );
  }

  // ── USAspending: agency-level obligated totals, latest closed quarter ──
  try {
    const spend = await agencySpending(topAgencies);
    if (spend.length > 0) {
      sections.push(
        `FEDERAL SPENDING (USAspending.gov — obligated dollars by agency, latest closed fiscal quarter):\n\n${spend
          .map(
            (s) =>
              `- ${s.agency}: ${usd(s.amount)} obligated FY${s.fy} Q${s.quarter} (through ${s.endDate})`,
          )
          .join("\n")}`,
      );
    }
  } catch (err) {
    process.stdout.write(
      `        datagod usaspending skipped: ${
        err instanceof Error ? err.message : String(err)
      }\n`,
    );
  }

  // ── BLS: verified labor series ──
  const seriesLines: string[] = [];
  for (const s of BLS_SERIES) {
    try {
      const points = await blsSeries(s.id);
      if (points.length === 0) continue;
      seriesLines.push(
        `- ${s.label}: ${points.map((p) => formatBlsValue(p, s.unit)).join("; ")}`,
      );
    } catch (err) {
      process.stdout.write(
        `        datagod BLS skipped (${s.id}): ${
          err instanceof Error ? err.message : String(err)
        }\n`,
      );
    }
  }
  if (seriesLines.length > 0) {
    sections.push(
      `BLS LABOR STATISTICS (latest monthly observations):\n\n${seriesLines.join("\n")}`,
    );
  }

  if (sections.length === 0) return "";
  return `### Source DG (tier 1 — US GOVERNMENT PRIMARY DATA, fetched live via the DataGod gateway): Federal Register + USAspending agency spending + BLS labor statistics\nURL: ${DATAGOD_URL}\n\n${sections.join("\n\n")}`;
}
