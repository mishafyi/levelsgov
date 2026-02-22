import { unstable_cache } from "next/cache";
import { query } from "@/lib/db";

type Dataset = "employment" | "accessions" | "separations";

export const getFilterOptions = unstable_cache(
  async (dataset: Dataset) => {
    const table = dataset;
    const baseQueries = [
      query(
        `SELECT DISTINCT agency_code as code, agency as name FROM ${table} WHERE agency_code IS NOT NULL AND agency_code <> '' AND agency IS NOT NULL AND agency <> '' ORDER BY agency`
      ),
      query(
        `SELECT DISTINCT duty_station_state_abbreviation as abbreviation, duty_station_state as name FROM ${table} WHERE duty_station_state_abbreviation IS NOT NULL AND duty_station_state_abbreviation <> '' AND duty_station_state IS NOT NULL AND duty_station_state <> '' ORDER BY duty_station_state`
      ),
      query(
        `SELECT DISTINCT grade FROM ${table} WHERE grade IS NOT NULL AND grade <> '' ORDER BY grade`
      ),
      query(
        `SELECT DISTINCT occupational_group_code as code, occupational_group as name FROM ${table} WHERE occupational_group_code IS NOT NULL AND occupational_group_code <> '' AND occupational_group IS NOT NULL AND occupational_group <> '' ORDER BY occupational_group`
      ),
      query(
        `SELECT DISTINCT occupational_series_code as code, occupational_series as name FROM ${table} WHERE occupational_series_code IS NOT NULL AND occupational_series_code <> '' AND occupational_series IS NOT NULL AND occupational_series <> '' ORDER BY occupational_series`
      ),
      query(
        `SELECT DISTINCT education_level_code as code, education_level as name FROM ${table} WHERE education_level_code IS NOT NULL AND education_level_code <> '' AND education_level IS NOT NULL AND education_level <> '' ORDER BY education_level`
      ),
      query(
        `SELECT DISTINCT age_bracket FROM ${table} WHERE age_bracket IS NOT NULL AND age_bracket <> '' ORDER BY age_bracket`
      ),
      query(
        `SELECT DISTINCT pay_plan_code as code, pay_plan as name FROM ${table} WHERE pay_plan_code IS NOT NULL AND pay_plan_code <> '' AND pay_plan IS NOT NULL AND pay_plan <> '' ORDER BY pay_plan`
      ),
      query(
        `SELECT DISTINCT work_schedule_code as code, work_schedule as name FROM ${table} WHERE work_schedule_code IS NOT NULL AND work_schedule_code <> '' AND work_schedule IS NOT NULL AND work_schedule <> '' ORDER BY work_schedule`
      ),
    ];

    // Add dataset-specific category queries
    if (dataset === "accessions") {
      baseQueries.push(
        query(
          `SELECT DISTINCT accession_category_code as code, accession_category as name FROM accessions WHERE accession_category_code IS NOT NULL AND accession_category_code <> '' AND accession_category IS NOT NULL AND accession_category <> '' ORDER BY accession_category`
        )
      );
    } else if (dataset === "separations") {
      baseQueries.push(
        query(
          `SELECT DISTINCT separation_category_code as code, separation_category as name FROM separations WHERE separation_category_code IS NOT NULL AND separation_category_code <> '' AND separation_category IS NOT NULL AND separation_category <> '' ORDER BY separation_category`
        )
      );
    }

    const results = await Promise.all(baseQueries);

    return {
      agencies: results[0],
      states: results[1],
      grades: results[2],
      occGroups: results[3],
      occupations: results[4],
      educations: results[5],
      ages: results[6],
      payPlans: results[7],
      workSchedules: results[8],
      ...(dataset === "accessions"
        ? { accessionCategories: results[9] }
        : {}),
      ...(dataset === "separations"
        ? { separationCategories: results[9] }
        : {}),
    };
  },
  ["filter-options"],
  { revalidate: 86400, tags: ["filter-options"] }
);

export const getStats = unstable_cache(
  async () => {
    const [emp, acc, sep, agencies, states, snapshot, payStats] =
      await Promise.all([
        query<{ count: string }>("SELECT COUNT(*) as count FROM employment"),
        query<{ count: string }>("SELECT COUNT(*) as count FROM accessions"),
        query<{ count: string }>("SELECT COUNT(*) as count FROM separations"),
        query<{ count: string }>(
          "SELECT COUNT(DISTINCT agency_code) as count FROM employment"
        ),
        query<{ count: string }>(
          "SELECT COUNT(DISTINCT duty_station_state_abbreviation) as count FROM employment WHERE duty_station_state_abbreviation IS NOT NULL"
        ),
        query<{ latest: string }>(
          "SELECT MAX(snapshot_yyyymm) as latest FROM employment"
        ),
        query<{ avg_pay: string; median_pay: string }>(
          "SELECT ROUND(AVG(annualized_adjusted_basic_pay)) as avg_pay, ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY annualized_adjusted_basic_pay)) as median_pay FROM employment WHERE annualized_adjusted_basic_pay IS NOT NULL"
        ),
      ]);
    return {
      total_employment: Number(emp[0].count),
      total_accessions: Number(acc[0].count),
      total_separations: Number(sep[0].count),
      agencies_count: Number(agencies[0].count),
      states_count: Number(states[0].count),
      latest_snapshot: String(snapshot[0].latest),
      avg_pay: Number(payStats[0].avg_pay),
      median_pay: Number(payStats[0].median_pay),
    };
  },
  ["stats"],
  { revalidate: 86400, tags: ["stats"] }
);

export const getHomepageInsights = unstable_cache(
  async () => {
    const [payByState, topAgencies, topOccupations, payByEducation, stemPay, supervisorPay, payByTenure] =
      await Promise.all([
        query<{ state: string; abbreviation: string; headcount: string; avg_pay: string }>(
          "SELECT duty_station_state as state, duty_station_state_abbreviation as abbreviation, COUNT(*) as headcount, ROUND(AVG(annualized_adjusted_basic_pay)) as avg_pay FROM employment WHERE duty_station_state IS NOT NULL AND duty_station_state <> '' AND duty_station_state NOT IN ('INVALID', 'NO DATA REPORTED') AND annualized_adjusted_basic_pay IS NOT NULL GROUP BY duty_station_state, duty_station_state_abbreviation HAVING COUNT(*) > 500 ORDER BY avg_pay DESC LIMIT 15"
        ),
        query<{ agency: string; headcount: string; avg_pay: string }>(
          "SELECT agency, COUNT(*) as headcount, ROUND(AVG(annualized_adjusted_basic_pay)) as avg_pay FROM employment WHERE annualized_adjusted_basic_pay IS NOT NULL GROUP BY agency HAVING COUNT(*) > 1000 ORDER BY avg_pay DESC LIMIT 10"
        ),
        query<{ occupational_series: string; count: string; avg_pay: string }>(
          "SELECT occupational_series, COUNT(*) as count, ROUND(AVG(annualized_adjusted_basic_pay)) as avg_pay FROM employment WHERE annualized_adjusted_basic_pay IS NOT NULL AND occupational_series IS NOT NULL GROUP BY occupational_series HAVING COUNT(*) > 500 ORDER BY avg_pay DESC LIMIT 10"
        ),
        query<{ education_level: string; count: string; avg_pay: string }>(
          "SELECT education_level, COUNT(*) as count, ROUND(AVG(annualized_adjusted_basic_pay)) as avg_pay FROM employment WHERE education_level IS NOT NULL AND education_level <> '' AND annualized_adjusted_basic_pay IS NOT NULL GROUP BY education_level ORDER BY avg_pay DESC LIMIT 8"
        ),
        query<{ stem_occupation: string; count: string; avg_pay: string }>(
          "SELECT stem_occupation, COUNT(*) as count, ROUND(AVG(annualized_adjusted_basic_pay)) as avg_pay FROM employment WHERE stem_occupation IS NOT NULL AND annualized_adjusted_basic_pay IS NOT NULL AND stem_occupation <> 'UNSPECIFIED' GROUP BY stem_occupation ORDER BY avg_pay DESC"
        ),
        query<{ supervisory_status: string; count: string; avg_pay: string }>(
          "SELECT CASE WHEN supervisory_status IN ('SUPERVISOR OR MANAGER', 'MANAGEMENT OFFICIAL (CSRA)') THEN 'Supervisors & Managers' ELSE 'Non-Supervisory' END as supervisory_status, SUM(1) as count, ROUND(AVG(annualized_adjusted_basic_pay)) as avg_pay FROM employment WHERE supervisory_status IS NOT NULL AND supervisory_status <> '' AND supervisory_status <> 'INVALID' AND annualized_adjusted_basic_pay IS NOT NULL GROUP BY CASE WHEN supervisory_status IN ('SUPERVISOR OR MANAGER', 'MANAGEMENT OFFICIAL (CSRA)') THEN 'Supervisors & Managers' ELSE 'Non-Supervisory' END ORDER BY avg_pay DESC"
        ),
        query<{ tenure: string; count: string; avg_pay: string }>(
          "SELECT CASE WHEN length_of_service_years < 5 THEN '0-4 years' WHEN length_of_service_years < 10 THEN '5-9 years' WHEN length_of_service_years < 15 THEN '10-14 years' WHEN length_of_service_years < 20 THEN '15-19 years' WHEN length_of_service_years < 25 THEN '20-24 years' WHEN length_of_service_years < 30 THEN '25-29 years' ELSE '30+ years' END as tenure, COUNT(*) as count, ROUND(AVG(annualized_adjusted_basic_pay)) as avg_pay FROM employment WHERE length_of_service_years IS NOT NULL AND annualized_adjusted_basic_pay IS NOT NULL GROUP BY tenure ORDER BY MIN(length_of_service_years)"
        ),
      ]);
    return {
      payByState: payByState.map((r) => ({ state: r.state, abbreviation: r.abbreviation, headcount: Number(r.headcount), avgPay: Number(r.avg_pay) })),
      topAgencies: topAgencies.map((r) => ({ agency: r.agency, headcount: Number(r.headcount), avgPay: Number(r.avg_pay) })),
      topOccupations: topOccupations.map((r) => ({ occupation: r.occupational_series, count: Number(r.count), avgPay: Number(r.avg_pay) })),
      payByEducation: payByEducation.map((r) => ({ education: r.education_level, count: Number(r.count), avgPay: Number(r.avg_pay) })),
      stemPay: stemPay.map((r) => ({ category: r.stem_occupation, count: Number(r.count), avgPay: Number(r.avg_pay) })),
      supervisorPay: supervisorPay.map((r) => ({ category: r.supervisory_status, count: Number(r.count), avgPay: Number(r.avg_pay) })),
      payByTenure: payByTenure.map((r) => ({ tenure: r.tenure, count: Number(r.count), avgPay: Number(r.avg_pay) })),
    };
  },
  ["homepage-insights"],
  { revalidate: 86400, tags: ["stats"] }
);
