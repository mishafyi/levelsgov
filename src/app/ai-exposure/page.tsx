export const revalidate = 86400; // revalidate once per day

import type { Metadata } from "next";
import { query } from "@/lib/db";
import {
  OccupationTreemap,
  type OccupationData,
  type AgeExposure,
} from "@/components/ai-exposure-treemap";
import aiScores from "../../data/ai-exposure-scores.json";

export const metadata: Metadata = {
  title: "AI Exposure — Federal Workforce | LevelsGov",
  description:
    "How susceptible is each federal occupation to AI? Interactive treemap of 500+ occupation series, sized by headcount and colored by AI exposure score.",
};

interface OccRow extends Record<string, unknown> {
  occupational_series: string;
  occupational_series_code: string;
  occupational_group: string;
  occupational_group_code: string;
  total_employees: string;
  avg_pay: string | null;
  median_pay: string | null;
  top_education: string | null;
  is_stem: boolean;
}

interface DimRow extends Record<string, unknown> {
  dim: string;
  bucket: string;
  employees: string;
  weighted_exposure: string;
  sort_order: string;
}

const scores = aiScores as Record<
  string,
  { score: number; rationale: string }
>;

const scoreValues = Object.entries(scores)
  .map(([code, s]) => `('${code}',${s.score})`)
  .join(",");

export default async function AIExposurePage() {
  const [rows, dimRows] = await Promise.all([
    // Query 1: occupation series aggregates
    query<OccRow>(`
      WITH occ AS (
        SELECT
          occupational_series,
          occupational_series_code,
          occupational_group,
          occupational_group_code,
          SUM(employee_count) AS total_employees,
          ROUND(AVG(annualized_adjusted_basic_pay)) AS avg_pay,
          BOOL_OR(stem_occupation IS NOT NULL AND stem_occupation != '' AND stem_occupation != 'UNSPECIFIED') AS is_stem
        FROM employment
        WHERE occupational_series IS NOT NULL
          AND occupational_series != ''
          AND occupational_series != 'INVALID'
        GROUP BY occupational_series, occupational_series_code,
                 occupational_group, occupational_group_code
        HAVING SUM(employee_count) >= 50
      ),
      edu AS (
        SELECT DISTINCT ON (occupational_series_code)
          occupational_series_code,
          education_level
        FROM (
          SELECT occupational_series_code, education_level,
                 SUM(employee_count) AS cnt
          FROM employment
          WHERE education_level IS NOT NULL
          GROUP BY occupational_series_code, education_level
        ) sub
        ORDER BY occupational_series_code, cnt DESC
      )
      SELECT
        occ.*,
        edu.education_level AS top_education,
        occ.avg_pay AS median_pay
      FROM occ
      LEFT JOIN edu ON edu.occupational_series_code = occ.occupational_series_code
      ORDER BY occ.total_employees DESC
    `),
    // Query 2: age + education exposure breakdowns (single scan)
    query<DimRow>(`
      WITH scored AS (
        SELECT e.age_bracket, e.education_level, e.employee_count, s.score
        FROM employment e
        INNER JOIN (VALUES ${scoreValues}) AS s(code,score)
          ON e.occupational_series_code = s.code
      )
      SELECT 'age' AS dim, bucket, SUM(emp) AS employees, SUM(wt) AS weighted_exposure, MIN(sort_order) AS sort_order
      FROM (
        SELECT
          CASE
            WHEN age_bracket IN ('LESS THAN 20','20-24','25-29') THEN 'Under 30'
            WHEN age_bracket IN ('30-34','35-39','40-44') THEN '30-44'
            WHEN age_bracket IN ('45-49','50-54') THEN '45-54'
            WHEN age_bracket IN ('55-59','60-64','65 OR MORE') THEN '55+'
          END AS bucket,
          employee_count AS emp,
          employee_count * score AS wt,
          CASE
            WHEN age_bracket IN ('LESS THAN 20','20-24','25-29') THEN 1
            WHEN age_bracket IN ('30-34','35-39','40-44') THEN 2
            WHEN age_bracket IN ('45-49','50-54') THEN 3
            WHEN age_bracket IN ('55-59','60-64','65 OR MORE') THEN 4
          END AS sort_order
        FROM scored
        WHERE age_bracket IS NOT NULL AND age_bracket != ''
      ) a
      WHERE bucket IS NOT NULL
      GROUP BY bucket
      UNION ALL
      SELECT 'edu' AS dim, bucket, SUM(emp), SUM(wt), MIN(sort_order)
      FROM (
        SELECT
          CASE
            WHEN education_level IN ('HIGH SCHOOL GRADUATE OR CERTIFICATE OF EQUIVALENCY','SOME HIGH SCHOOL - DID NOT COMPLETE','ELEMENTARY SCHOOL COMPLETED - NO HIGH SCHOOL','NO FORMAL EDUCATION OR SOME ELEMENTARY SCHOOL - DID NOT COMPLETE') THEN 'HS or less'
            WHEN education_level IN ('SOME COLLEGE - LESS THAN ONE YEAR','ONE YEAR COLLEGE','TWO YEARS COLLEGE','THREE YEARS COLLEGE','ASSOCIATE DEGREE','TERMINAL OCCUPATIONAL PROGRAM - CERTIFICATE OF COMPLETION, DIPLOMA OR EQUIVALENT','TERMINAL OCCUPATIONAL PROGRAM - DID NOT COMPLETE') THEN 'Some college'
            WHEN education_level IN ('BACHELOR''S DEGREE','FOUR YEARS COLLEGE','POST-BACHELOR''S','MASTER''S DEGREE','POST-MASTER''S') THEN 'BS / MS'
            WHEN education_level IN ('SIXTH-YEAR DEGREE','POST-SIXTH YEAR','DOCTORATE DEGREE','POST-DOCTORATE','FIRST PROFESSIONAL','POST-FIRST PROFESSIONAL') THEN 'Doctorate+'
          END AS bucket,
          employee_count AS emp,
          employee_count * score AS wt,
          CASE
            WHEN education_level IN ('HIGH SCHOOL GRADUATE OR CERTIFICATE OF EQUIVALENCY','SOME HIGH SCHOOL - DID NOT COMPLETE','ELEMENTARY SCHOOL COMPLETED - NO HIGH SCHOOL','NO FORMAL EDUCATION OR SOME ELEMENTARY SCHOOL - DID NOT COMPLETE') THEN 1
            WHEN education_level IN ('SOME COLLEGE - LESS THAN ONE YEAR','ONE YEAR COLLEGE','TWO YEARS COLLEGE','THREE YEARS COLLEGE','ASSOCIATE DEGREE','TERMINAL OCCUPATIONAL PROGRAM - CERTIFICATE OF COMPLETION, DIPLOMA OR EQUIVALENT','TERMINAL OCCUPATIONAL PROGRAM - DID NOT COMPLETE') THEN 2
            WHEN education_level IN ('BACHELOR''S DEGREE','FOUR YEARS COLLEGE','POST-BACHELOR''S','MASTER''S DEGREE','POST-MASTER''S') THEN 3
            WHEN education_level IN ('SIXTH-YEAR DEGREE','POST-SIXTH YEAR','DOCTORATE DEGREE','POST-DOCTORATE','FIRST PROFESSIONAL','POST-FIRST PROFESSIONAL') THEN 4
          END AS sort_order
        FROM scored
        WHERE education_level IS NOT NULL AND education_level NOT IN ('NO DATA REPORTED','INVALID','')
      ) e
      WHERE bucket IS NOT NULL
      GROUP BY bucket
      ORDER BY dim, sort_order
    `),
  ]);

  const data: OccupationData[] = rows.map((r) => {
    const scoreData = scores[r.occupational_series_code];
    return {
      title: r.occupational_series,
      series_code: r.occupational_series_code,
      category: r.occupational_group,
      category_code: r.occupational_group_code,
      employees: Number(r.total_employees),
      avg_pay: r.avg_pay ? Number(r.avg_pay) : null,
      median_pay: r.median_pay ? Number(r.median_pay) : null,
      top_education: r.top_education,
      stem: r.is_stem,
      exposure: scoreData?.score ?? null,
      exposure_rationale: scoreData?.rationale ?? null,
    };
  });

  const ageExposure: AgeExposure[] = dimRows
    .filter((r) => r.dim === "age")
    .map((r) => ({
      bracket: r.bucket,
      employees: Number(r.employees),
      avg: Number(r.employees) > 0 ? Number(r.weighted_exposure) / Number(r.employees) : 0,
    }));

  const eduExposure = dimRows
    .filter((r) => r.dim === "edu")
    .map((r) => ({
      group: r.bucket,
      employees: Number(r.employees),
      avg: Number(r.employees) > 0 ? Number(r.weighted_exposure) / Number(r.employees) : 0,
    }));

  return <OccupationTreemap data={data} ageExposure={ageExposure} eduExposure={eduExposure} />;
}
