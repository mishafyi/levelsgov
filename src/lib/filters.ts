import { unstable_cache } from "next/cache";
import { query } from "@/lib/db";

type Dataset = "employment" | "accessions" | "separations";

export const getFilterOptions = unstable_cache(
  async (dataset: Dataset) => {
    const table = dataset;
    const baseQueries = [
      query(
        `SELECT DISTINCT agency_code as code, agency as name FROM ${table} WHERE agency_code IS NOT NULL AND agency IS NOT NULL ORDER BY agency`
      ),
      query(
        `SELECT DISTINCT duty_station_state_abbreviation as abbreviation, duty_station_state as name FROM ${table} WHERE duty_station_state_abbreviation IS NOT NULL AND duty_station_state IS NOT NULL ORDER BY duty_station_state`
      ),
      query(
        `SELECT DISTINCT grade FROM ${table} WHERE grade IS NOT NULL ORDER BY grade`
      ),
      query(
        `SELECT DISTINCT occupational_group_code as code, occupational_group as name FROM ${table} WHERE occupational_group_code IS NOT NULL AND occupational_group IS NOT NULL ORDER BY occupational_group`
      ),
      query(
        `SELECT DISTINCT occupational_series_code as code, occupational_series as name FROM ${table} WHERE occupational_series_code IS NOT NULL AND occupational_series IS NOT NULL ORDER BY occupational_series`
      ),
      query(
        `SELECT DISTINCT education_level_code as code, education_level as name FROM ${table} WHERE education_level_code IS NOT NULL AND education_level IS NOT NULL ORDER BY education_level`
      ),
      query(
        `SELECT DISTINCT age_bracket FROM ${table} WHERE age_bracket IS NOT NULL ORDER BY age_bracket`
      ),
      query(
        `SELECT DISTINCT pay_plan_code as code, pay_plan as name FROM ${table} WHERE pay_plan_code IS NOT NULL AND pay_plan IS NOT NULL ORDER BY pay_plan`
      ),
      query(
        `SELECT DISTINCT work_schedule_code as code, work_schedule as name FROM ${table} WHERE work_schedule_code IS NOT NULL AND work_schedule IS NOT NULL ORDER BY work_schedule`
      ),
    ];

    // Add dataset-specific category queries
    if (dataset === "accessions") {
      baseQueries.push(
        query(
          `SELECT DISTINCT accession_category_code as code, accession_category as name FROM accessions WHERE accession_category_code IS NOT NULL AND accession_category IS NOT NULL ORDER BY accession_category`
        )
      );
    } else if (dataset === "separations") {
      baseQueries.push(
        query(
          `SELECT DISTINCT separation_category_code as code, separation_category as name FROM separations WHERE separation_category_code IS NOT NULL AND separation_category IS NOT NULL ORDER BY separation_category`
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
    const [emp, acc, sep, agencies, states, snapshot] = await Promise.all([
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
    ]);
    return {
      total_employment: Number(emp[0].count),
      total_accessions: Number(acc[0].count),
      total_separations: Number(sep[0].count),
      agencies_count: Number(agencies[0].count),
      states_count: Number(states[0].count),
      latest_snapshot: String(snapshot[0].latest),
    };
  },
  ["stats"],
  { revalidate: 86400, tags: ["stats"] }
);
