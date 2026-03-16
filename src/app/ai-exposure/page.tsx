export const dynamic = "force-dynamic";

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

const scores = aiScores as Record<
  string,
  { score: number; rationale: string }
>;

export default async function AIExposurePage() {
  const rows = await query<OccRow>(`
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
  `);

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

  // Compute exposure by age bracket server-side
  interface AgeRow extends Record<string, unknown> {
    age_bracket: string;
    employees: string;
    weighted_exposure: string;
  }
  const ageRows = await query<AgeRow>(`
    SELECT
      CASE
        WHEN e.age_bracket IN ('LESS THAN 20','20-24','25-29') THEN 'Under 30'
        WHEN e.age_bracket IN ('30-34','35-39','40-44') THEN '30-44'
        WHEN e.age_bracket IN ('45-49','50-54') THEN '45-54'
        WHEN e.age_bracket IN ('55-59','60-64','65 OR MORE') THEN '55+'
      END AS age_bracket,
      SUM(e.employee_count) AS employees,
      SUM(e.employee_count * s.score) AS weighted_exposure
    FROM employment e
    INNER JOIN (VALUES
      ${Object.entries(scores)
        .map(([code, s]) => `('${code}', ${s.score})`)
        .join(",\n      ")}
    ) AS s(code, score) ON e.occupational_series_code = s.code
    WHERE e.age_bracket IS NOT NULL
      AND e.age_bracket != ''
    GROUP BY 1
    ORDER BY MIN(CASE
        WHEN e.age_bracket = 'LESS THAN 20' THEN 1
        WHEN e.age_bracket = '20-24' THEN 2
        WHEN e.age_bracket = '25-29' THEN 3
        WHEN e.age_bracket = '30-34' THEN 4
        WHEN e.age_bracket = '35-39' THEN 5
        WHEN e.age_bracket = '40-44' THEN 6
        WHEN e.age_bracket = '45-49' THEN 7
        WHEN e.age_bracket = '50-54' THEN 8
        WHEN e.age_bracket = '55-59' THEN 9
        WHEN e.age_bracket = '60-64' THEN 10
        WHEN e.age_bracket = '65 OR MORE' THEN 11
      END)
  `);

  const ageExposure: AgeExposure[] = ageRows.map((r) => ({
    bracket: r.age_bracket,
    employees: Number(r.employees),
    avg: Number(r.employees) > 0
      ? Number(r.weighted_exposure) / Number(r.employees)
      : 0,
  }));

  // Compute exposure by education server-side (accurate per-employee)
  interface EduRow extends Record<string, unknown> {
    edu_group: string;
    employees: string;
    weighted_exposure: string;
  }
  const eduRows = await query<EduRow>(`
    SELECT edu_group, SUM(employees) AS employees, SUM(weighted_exposure) AS weighted_exposure
    FROM (
      SELECT
        CASE
          WHEN e.education_level IN ('HIGH SCHOOL GRADUATE OR CERTIFICATE OF EQUIVALENCY','SOME HIGH SCHOOL - DID NOT COMPLETE','ELEMENTARY SCHOOL COMPLETED - NO HIGH SCHOOL','NO FORMAL EDUCATION OR SOME ELEMENTARY SCHOOL - DID NOT COMPLETE') THEN 'HS or less'
          WHEN e.education_level IN ('SOME COLLEGE - LESS THAN ONE YEAR','ONE YEAR COLLEGE','TWO YEARS COLLEGE','THREE YEARS COLLEGE','ASSOCIATE DEGREE','TERMINAL OCCUPATIONAL PROGRAM - CERTIFICATE OF COMPLETION, DIPLOMA OR EQUIVALENT','TERMINAL OCCUPATIONAL PROGRAM - DID NOT COMPLETE') THEN 'Some college'
          WHEN e.education_level IN ('BACHELOR''S DEGREE','FOUR YEARS COLLEGE','POST-BACHELOR''S','MASTER''S DEGREE','POST-MASTER''S') THEN 'BS / MS'
          WHEN e.education_level IN ('SIXTH-YEAR DEGREE','POST-SIXTH YEAR','DOCTORATE DEGREE','POST-DOCTORATE','FIRST PROFESSIONAL','POST-FIRST PROFESSIONAL') THEN 'Doctorate+'
        END AS edu_group,
        e.employee_count AS employees,
        e.employee_count * s.score AS weighted_exposure,
        CASE
          WHEN e.education_level IN ('HIGH SCHOOL GRADUATE OR CERTIFICATE OF EQUIVALENCY','SOME HIGH SCHOOL - DID NOT COMPLETE','ELEMENTARY SCHOOL COMPLETED - NO HIGH SCHOOL','NO FORMAL EDUCATION OR SOME ELEMENTARY SCHOOL - DID NOT COMPLETE') THEN 1
          WHEN e.education_level IN ('SOME COLLEGE - LESS THAN ONE YEAR','ONE YEAR COLLEGE','TWO YEARS COLLEGE','THREE YEARS COLLEGE','ASSOCIATE DEGREE','TERMINAL OCCUPATIONAL PROGRAM - CERTIFICATE OF COMPLETION, DIPLOMA OR EQUIVALENT','TERMINAL OCCUPATIONAL PROGRAM - DID NOT COMPLETE') THEN 2
          WHEN e.education_level IN ('BACHELOR''S DEGREE','FOUR YEARS COLLEGE','POST-BACHELOR''S','MASTER''S DEGREE','POST-MASTER''S') THEN 3
          WHEN e.education_level IN ('SIXTH-YEAR DEGREE','POST-SIXTH YEAR','DOCTORATE DEGREE','POST-DOCTORATE','FIRST PROFESSIONAL','POST-FIRST PROFESSIONAL') THEN 4
        END AS sort_order
      FROM employment e
      INNER JOIN (VALUES
        ${Object.entries(scores)
          .map(([code, s]) => `('${code}', ${s.score})`)
          .join(",\n        ")}
      ) AS s(code, score) ON e.occupational_series_code = s.code
      WHERE e.education_level IS NOT NULL
        AND e.education_level NOT IN ('NO DATA REPORTED', 'INVALID', '')
    ) sub
    WHERE edu_group IS NOT NULL
    GROUP BY edu_group
    ORDER BY MIN(sort_order)
  `);

  const eduExposure = eduRows.map((r) => ({
    group: r.edu_group,
    employees: Number(r.employees),
    avg: Number(r.employees) > 0
      ? Number(r.weighted_exposure) / Number(r.employees)
      : 0,
  }));

  return <OccupationTreemap data={data} ageExposure={ageExposure} eduExposure={eduExposure} />;
}
