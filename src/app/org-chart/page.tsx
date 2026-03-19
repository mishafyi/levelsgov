import { query } from "@/lib/db";
import {
  OrgChart,
  type AgencyData,
  type OrgChartData,
} from "@/components/org-chart";

export const dynamic = "force-dynamic";

/* ── Agency classification ── */

const EXECUTIVE_CODES = new Set([
  "ST", "TR", "DD", "DJ", "IN", "AG", "CM", "DL",
  "HE", "HU", "TD", "DN", "ED", "VA", "HS",
]);

const MILITARY_CODES = new Set(["AR", "NV", "AF"]);

const EOP_CODES = new Set([
  "CE", "NS", "BO", "QQ", "TS", "TN", "EC", "EQ", "DO",
]);

const LEGISLATIVE_CODES = new Set(["LP"]);

const JUDICIAL_CODES = new Set(["JL", "FQ"]);

/* ── DB types ── */

type AgencyRow = Record<string, unknown> & {
  agency: string;
  agency_code: string;
  total: string;
};

type SubelementRow = Record<string, unknown> & {
  agency_code: string;
  agency_subelement: string;
  agency_subelement_code: string;
  total: string;
};

/* ── Data fetching ── */

async function getData(): Promise<OrgChartData> {
  const [agencies, subelements] = await Promise.all([
    query<AgencyRow>(
      `SELECT agency, agency_code, COUNT(*) as total
       FROM employment
       GROUP BY agency, agency_code
       ORDER BY COUNT(*) DESC`
    ),
    query<SubelementRow>(
      `SELECT agency_code, agency_subelement, agency_subelement_code, COUNT(*) as total
       FROM employment
       GROUP BY agency_code, agency_subelement, agency_subelement_code
       ORDER BY agency_code, COUNT(*) DESC`
    ),
  ]);

  /* Group subelements by agency code */
  const subMap = new Map<string, { name: string; code: string; total: number }[]>();
  for (const row of subelements) {
    const list = subMap.get(row.agency_code) ?? [];
    list.push({
      name: row.agency_subelement,
      code: row.agency_subelement_code,
      total: Number(row.total),
    });
    subMap.set(row.agency_code, list);
  }

  /* Bucket agencies by type */
  const buckets: Record<string, AgencyData[]> = {
    cabinet: [], military: [], eop: [], independent: [],
    legislative: [], judicial: [],
  };

  for (const row of agencies) {
    const agency: AgencyData = {
      name: row.agency,
      code: row.agency_code,
      total: Number(row.total),
      subelements: subMap.get(row.agency_code) ?? [],
    };

    if (EXECUTIVE_CODES.has(row.agency_code)) buckets.cabinet.push(agency);
    else if (MILITARY_CODES.has(row.agency_code)) buckets.military.push(agency);
    else if (EOP_CODES.has(row.agency_code)) buckets.eop.push(agency);
    else if (LEGISLATIVE_CODES.has(row.agency_code)) buckets.legislative.push(agency);
    else if (JUDICIAL_CODES.has(row.agency_code)) buckets.judicial.push(agency);
    else buckets.independent.push(agency);
  }

  const sum = (arr: AgencyData[]) => arr.reduce((s, a) => s + a.total, 0);
  const grandTotal = agencies.reduce((s, a) => s + Number(a.total), 0);

  const execTotal = sum(buckets.cabinet) + sum(buckets.military) + sum(buckets.eop) + sum(buckets.independent);

  return {
    grandTotal,
    branches: [
      {
        key: "executive",
        label: "Executive Branch",
        total: execTotal,
        subcategories: [
          { key: "cabinet", label: "Cabinet Departments", total: sum(buckets.cabinet), agencies: buckets.cabinet },
          { key: "military", label: "Military Departments", total: sum(buckets.military), agencies: buckets.military },
          { key: "eop", label: "Executive Office of the President", total: sum(buckets.eop), agencies: buckets.eop },
          { key: "independent", label: "Independent Agencies", total: sum(buckets.independent), agencies: buckets.independent },
        ],
      },
      {
        key: "legislative",
        label: "Legislative Branch",
        total: sum(buckets.legislative),
        subcategories: [
          { key: "legislative", label: "Legislative Branch", total: sum(buckets.legislative), agencies: buckets.legislative },
        ],
      },
      {
        key: "judicial",
        label: "Judicial Branch",
        total: sum(buckets.judicial),
        subcategories: [
          { key: "judicial", label: "Judicial Branch", total: sum(buckets.judicial), agencies: buckets.judicial },
        ],
      },
    ],
  };
}

export default async function OrgChartPage() {
  try {
    const data = await getData();
    return <OrgChart data={data} />;
  } catch {
    return (
      <div className="flex flex-col items-center justify-center py-24 px-4 text-center">
        <h1 className="text-2xl font-bold tracking-tight mb-2">Org Chart</h1>
        <p className="text-muted-foreground">
          Unable to load data. Check the database connection.
        </p>
      </div>
    );
  }
}
