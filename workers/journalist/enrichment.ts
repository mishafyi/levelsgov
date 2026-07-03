/**
 * The `PipelineEnrichment` for the federal-workforce beat — the first-party
 * DATA gathers + the deterministic on-site linker, built by spreading
 * `neutralEnrichment()` and overriding only the OPM-backed slots. Everything the
 * engine reads (site inventory, linkable entities, fresh-hirer/board blocks, the
 * DataGod tier-1 block, agency links) is grounded in the fedwork DB + DataGod.
 *
 * The board-company type is the base `PipelineBoardCompany` (agency = company,
 * occupations = jobs). The three LLM-flavored link functions
 * (`resolveArticleEntities` / `withInternalLinks` / `enforceLinkIntegrity`) stay
 * neutral for v1 — the deterministic `linkEntities` covers agencies, and there
 * are no people/job pages to link.
 */
import {
  neutralEnrichment,
  type PipelineEnrichment,
  type PipelineBoardCompany,
  type PipelineLinkEntity,
  type PipelineSiteData,
  type PipelineLinkable,
} from "ai-journalist/pipeline";
import {
  agencyBoard,
  siteTotals,
  topAgenciesByHires,
} from "./db.ts";
import { gatherDatagodFacts } from "./datagod.ts";
import { titleCase, agencyFilterUrl } from "./util.ts";

/** Escape a string for safe use as a literal inside a RegExp. */
function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Deterministic first-mention linker: for each agency in `entities`, link its
 * FIRST plain-text occurrence to the agency's /employment URL. Conservative —
 * skips matches inside an existing markdown link or a heading line, matches on
 * word boundaries, links each agency at most once, and only the first agency
 * mention per name. Longer names first so "Department of the Navy" wins over a
 * bare "Navy" substring.
 */
function linkEntities(content: string, entities: PipelineLinkEntity[]): string {
  const lines = content.split("\n");
  const linked = new Set<string>();
  const targets = [...entities]
    .filter((e) => e.name.trim().length > 3 && e.url)
    .sort((a, b) => b.name.length - a.name.length);

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (line === undefined) continue;
    if (/^\s{0,3}#{1,6}\s/.test(line)) continue; // heading line
    let next = line;
    for (const ent of targets) {
      if (linked.has(ent.name)) continue;
      const re = new RegExp(`(?<![\\[\\w])(${escapeRegExp(ent.name)})(?![\\w\\]])`);
      const m = re.exec(next);
      const matched = m?.[1];
      if (!m || m.index === undefined || matched === undefined) continue;
      // Skip if the match sits inside an existing markdown link target/anchor.
      const before = next.slice(0, m.index);
      const openBrackets = (before.match(/\[/g) ?? []).length;
      const closeBrackets = (before.match(/\]/g) ?? []).length;
      if (openBrackets > closeBrackets) continue; // inside [...]
      next =
        next.slice(0, m.index) +
        `[${matched}](${ent.url})` +
        next.slice(m.index + matched.length);
      linked.add(ent.name);
    }
    lines[i] = next;
  }
  return lines.join("\n");
}

/** Map a board row from `agencyBoard` into the engine's `PipelineBoardCompany`. */
function toBoardCompany(row: {
  agency: string;
  agencyCode: string;
  monthHires: number;
  occupations: { occupation: string; count: number; medianPay: number }[];
}): PipelineBoardCompany {
  return {
    company: titleCase(row.agency),
    url: agencyFilterUrl(row.agencyCode),
    addedInWindow: row.monthHires,
    jobs: row.occupations.map((o) => ({
      title: titleCase(o.occupation),
      location: null,
      salary: o.medianPay > 0 ? `$${o.medianPay.toLocaleString("en-US")} median` : null,
    })),
  };
}

/**
 * Build the federal-workforce enrichment. `agencyCodeByName` lets the board/link
 * gathers translate the discovery-time agency NAMES (the summary strings) back
 * to codes for /employment URLs; it's refreshed from `topAgenciesByHires` on
 * each gather so it always covers the agencies in play.
 */
export function createEnrichment(): PipelineEnrichment<PipelineBoardCompany> {
  const base = neutralEnrichment<PipelineBoardCompany>();
  const codeByName = new Map<string, string>();
  const remember = (name: string, code: string): void => {
    codeByName.set(titleCase(name).toLowerCase(), code);
  };

  const resolveCode = (name: string): string | null =>
    codeByName.get(name.toLowerCase()) ?? null;

  return {
    ...base,

    // ── FIRST-PARTY SITE INVENTORY (the ground-truth line) ──
    gatherSiteData: async (
      _category: string,
      limit: number,
    ): Promise<PipelineSiteData> => {
      const [totals, top] = await Promise.all([
        siteTotals(),
        topAgenciesByHires(Math.max(limit, 1)),
      ]);
      for (const a of top) remember(a.agency, a.agencyCode);
      return {
        companies: top.map((a) => ({
          name: titleCase(a.agency),
          url: agencyFilterUrl(a.agencyCode),
        })),
        people: [],
        jobCount: totals.employees,
        companyCount: totals.agencies,
        domain: { label: "federal workforce" },
      };
    },

    // ── linkable entities (agencies → /employment URLs) ──
    gatherLinkableEntities: async (
      _category: string,
      companyLimit: number,
    ): Promise<PipelineLinkable> => {
      const top = await topAgenciesByHires(Math.max(companyLimit, 1));
      for (const a of top) remember(a.agency, a.agencyCode);
      return {
        companies: top.map((a) => ({
          name: titleCase(a.agency),
          url: agencyFilterUrl(a.agencyCode),
        })),
        people: [],
      };
    },

    // ── fresh hirers (top agencies by this month's hires) ──
    gatherIndustryFreshHirers: async (
      _category: string,
      limit: number,
    ): Promise<PipelineLinkEntity[]> => {
      const top = await topAgenciesByHires(Math.max(limit, 1));
      for (const a of top) remember(a.agency, a.agencyCode);
      return top.map((a) => ({
        name: titleCase(a.agency),
        url: agencyFilterUrl(a.agencyCode),
      }));
    },

    // ── board facts (per-agency month hires + top occupations w/ median pay) ──
    gatherCompanyFreshJobs: async (
      companies: PipelineLinkEntity[],
    ): Promise<PipelineBoardCompany[]> => {
      const codes = companies
        .map((c) => resolveCode(c.name))
        .filter((c): c is string => c !== null);
      if (codes.length === 0) return [];
      const rows = await agencyBoard(codes);
      return rows.map(toBoardCompany);
    },

    // ── US-government primary block (Federal Register + USAspending + BLS) ──
    gatherDatagodFacts: async (
      category: string,
      companies: string[],
    ): Promise<string> => gatherDatagodFacts(category, companies),

    // ── the deterministic first-mention agency linker ──
    linkEntities,

    boardJobsLine: (b: PipelineBoardCompany): string =>
      `${b.addedInWindow.toLocaleString("en-US")} hires last month; top roles: ${b.jobs
        .map((j) => `${j.title}${j.salary ? ` (${j.salary})` : ""}`)
        .join(", ")}`,

    usLeanLocations: (): boolean => true,

    // knobs (a month-long window — OPM's monthly cadence).
    enrichLimit: 6,
    linkCompanyLimit: 200,
    linkPeopleLimit: 0,
    topicCompanies: 3,
    topicCompanyJobs: 6,
    topicJobsWindowHours: 720,
  };
}
