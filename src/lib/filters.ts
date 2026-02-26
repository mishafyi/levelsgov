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
    const [payByState, topAgencies, topOccupations, payByEducation, stemPay, supervisorPay, payByTenure, separationReasons, agencyNetChanges, stemBrainDrain, stateReplacementRates, stemPositionLosses, stemAgencyLosses, payByAge, gradeDistribution, workSchedule, tenureBySTEM] =
      await Promise.all([
        query<{ state: string; abbreviation: string; headcount: string; avg_pay: string }>(
          "SELECT duty_station_state as state, duty_station_state_abbreviation as abbreviation, COUNT(*) as headcount, ROUND(AVG(annualized_adjusted_basic_pay)) as avg_pay FROM employment WHERE duty_station_state IS NOT NULL AND duty_station_state <> '' AND duty_station_state NOT IN ('INVALID', 'NO DATA REPORTED') AND annualized_adjusted_basic_pay IS NOT NULL GROUP BY duty_station_state, duty_station_state_abbreviation HAVING COUNT(*) > 100 ORDER BY avg_pay DESC"
        ),
        query<{ agency: string; headcount: string; avg_pay: string }>(
          "SELECT agency, COUNT(*) as headcount, ROUND(AVG(annualized_adjusted_basic_pay)) as avg_pay FROM employment WHERE annualized_adjusted_basic_pay IS NOT NULL GROUP BY agency ORDER BY avg_pay DESC LIMIT 10"
        ),
        query<{ occupational_series: string; count: string; avg_pay: string }>(
          "SELECT occupational_series, COUNT(*) as count, ROUND(AVG(annualized_adjusted_basic_pay)) as avg_pay FROM employment WHERE annualized_adjusted_basic_pay IS NOT NULL AND occupational_series IS NOT NULL GROUP BY occupational_series ORDER BY avg_pay DESC LIMIT 10"
        ),
        query<{ education_level: string; count: string; avg_pay: string }>(
          "SELECT CASE WHEN education_level IN ('NO FORMAL EDUCATION OR SOME ELEMENTARY SCHOOL - DID NOT COMPLETE','ELEMENTARY SCHOOL COMPLETED - NO HIGH SCHOOL','SOME HIGH SCHOOL - DID NOT COMPLETE') THEN 'Less than High School' WHEN education_level = 'HIGH SCHOOL GRADUATE OR CERTIFICATE OF EQUIVALENCY' THEN 'High School' WHEN education_level LIKE 'TERMINAL OCCUPATIONAL%' THEN 'Vocational' WHEN education_level IN ('SOME COLLEGE - LESS THAN ONE YEAR','ONE YEAR COLLEGE','TWO YEARS COLLEGE','THREE YEARS COLLEGE','FOUR YEARS COLLEGE') THEN 'Some College' WHEN education_level = 'ASSOCIATE DEGREE' THEN 'Associate''s' WHEN education_level = 'BACHELOR''S DEGREE' THEN 'Bachelor''s' WHEN education_level = 'POST-BACHELOR''S' THEN 'Post-Bachelor''s' WHEN education_level = 'MASTER''S DEGREE' THEN 'Master''s' WHEN education_level IN ('POST-MASTER''S','SIXTH-YEAR DEGREE','POST-SIXTH YEAR') THEN 'Post-Master''s' WHEN education_level IN ('FIRST PROFESSIONAL','POST-FIRST PROFESSIONAL') THEN 'Professional (JD/MD)' WHEN education_level = 'DOCTORATE DEGREE' THEN 'Doctorate' WHEN education_level = 'POST-DOCTORATE' THEN 'Post-Doctorate' ELSE education_level END as education_level, COUNT(*) as count, ROUND(AVG(annualized_adjusted_basic_pay)) as avg_pay FROM employment WHERE education_level IS NOT NULL AND education_level <> '' AND education_level NOT IN ('INVALID','NO DATA REPORTED') AND annualized_adjusted_basic_pay IS NOT NULL GROUP BY 1 ORDER BY avg_pay DESC"
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
        query<{ separation_category: string; count: string }>(
          "SELECT separation_category, COUNT(*) as count FROM separations WHERE separation_category IS NOT NULL AND separation_category <> '' GROUP BY separation_category ORDER BY count DESC"
        ),
        query<{ agency: string; hires: string; departures: string; net_change: string }>(
          "SELECT COALESCE(s.agency, a.agency) as agency, COALESCE(a.hires, 0) as hires, COALESCE(s.departures, 0) as departures, COALESCE(a.hires, 0) - COALESCE(s.departures, 0) as net_change FROM (SELECT agency, COUNT(*) as departures FROM separations GROUP BY agency) s FULL OUTER JOIN (SELECT agency, COUNT(*) as hires FROM accessions GROUP BY agency) a ON s.agency = a.agency ORDER BY net_change ASC LIMIT 10"
        ),
        query<{ category: string; departures: string; hires: string; net_loss: string; replacement_pct: string; avg_departing_pay: string }>(
          "SELECT stem_occupation_type as category, SUM(CASE WHEN src='s' THEN 1 ELSE 0 END) as departures, SUM(CASE WHEN src='a' THEN 1 ELSE 0 END) as hires, SUM(CASE WHEN src='s' THEN 1 ELSE 0 END) - SUM(CASE WHEN src='a' THEN 1 ELSE 0 END) as net_loss, ROUND(SUM(CASE WHEN src='a' THEN 1 ELSE 0 END)::numeric / NULLIF(SUM(CASE WHEN src='s' THEN 1 ELSE 0 END), 0) * 100, 1) as replacement_pct, ROUND(AVG(CASE WHEN src='s' THEN pay END)) as avg_departing_pay FROM (SELECT stem_occupation_type, 's' as src, annualized_adjusted_basic_pay as pay FROM separations WHERE personnel_action_effective_date_yyyymm >= '202501' AND stem_occupation_type IS NOT NULL AND stem_occupation_type <> '' AND stem_occupation_type <> 'UNSPECIFIED' UNION ALL SELECT stem_occupation_type, 'a' as src, annualized_adjusted_basic_pay as pay FROM accessions WHERE personnel_action_effective_date_yyyymm >= '202501' AND stem_occupation_type IS NOT NULL AND stem_occupation_type <> '' AND stem_occupation_type <> 'UNSPECIFIED') t GROUP BY 1 ORDER BY replacement_pct ASC"
        ),
        query<{ state: string; abbreviation: string; departures: string; hires: string; net_loss: string; replacement_pct: string }>(
          "SELECT duty_station_state as state, duty_station_state_abbreviation as abbreviation, SUM(CASE WHEN src='s' THEN 1 ELSE 0 END) as departures, SUM(CASE WHEN src='a' THEN 1 ELSE 0 END) as hires, SUM(CASE WHEN src='s' THEN 1 ELSE 0 END) - SUM(CASE WHEN src='a' THEN 1 ELSE 0 END) as net_loss, ROUND(SUM(CASE WHEN src='a' THEN 1 ELSE 0 END)::numeric / NULLIF(SUM(CASE WHEN src='s' THEN 1 ELSE 0 END), 0) * 100, 1) as replacement_pct FROM (SELECT duty_station_state, duty_station_state_abbreviation, 's' as src FROM separations WHERE personnel_action_effective_date_yyyymm >= '202501' AND duty_station_state IS NOT NULL AND duty_station_state <> '' AND duty_station_state NOT IN ('INVALID', 'NO DATA REPORTED') UNION ALL SELECT duty_station_state, duty_station_state_abbreviation, 'a' as src FROM accessions WHERE personnel_action_effective_date_yyyymm >= '202501' AND duty_station_state IS NOT NULL AND duty_station_state <> '' AND duty_station_state NOT IN ('INVALID', 'NO DATA REPORTED')) t GROUP BY 1, 2 HAVING SUM(CASE WHEN src='s' THEN 1 ELSE 0 END) > 50 ORDER BY replacement_pct ASC"
        ),
        query<{ position: string; stem_type: string; departures: string; hires: string; net_loss: string; replacement_pct: string; avg_pay: string }>(
          "SELECT s.occupational_series as position, s.stem_type, s.dep as departures, COALESCE(a.hir, 0) as hires, s.dep - COALESCE(a.hir, 0) as net_loss, ROUND(COALESCE(a.hir, 0)::numeric / NULLIF(s.dep, 0) * 100, 1) as replacement_pct, s.avg_pay FROM (SELECT occupational_series, stem_occupation_type as stem_type, COUNT(*) as dep, ROUND(AVG(annualized_adjusted_basic_pay)) as avg_pay FROM separations WHERE personnel_action_effective_date_yyyymm >= '202501' AND stem_occupation_type IN ('MATHEMATICS OCCUPATIONS','TECHNOLOGY OCCUPATIONS','ENGINEERING OCCUPATIONS','SCIENCE OCCUPATIONS') AND occupational_series IS NOT NULL AND occupational_series <> '' GROUP BY 1, 2) s LEFT JOIN (SELECT occupational_series, COUNT(*) as hir FROM accessions WHERE personnel_action_effective_date_yyyymm >= '202501' AND stem_occupation_type IN ('MATHEMATICS OCCUPATIONS','TECHNOLOGY OCCUPATIONS','ENGINEERING OCCUPATIONS','SCIENCE OCCUPATIONS') AND occupational_series IS NOT NULL AND occupational_series <> '' GROUP BY 1) a ON s.occupational_series = a.occupational_series ORDER BY net_loss DESC LIMIT 15"
        ),
        query<{ agency: string; sector: string; departures: string; hires: string; net_loss: string; replacement_pct: string }>(
          "SELECT s.agency, CASE WHEN s.agency IN ('DEPARTMENT OF THE NAVY','DEPARTMENT OF THE ARMY','DEPARTMENT OF THE AIR FORCE','DEPARTMENT OF DEFENSE','DEPARTMENT OF HOMELAND SECURITY','DEPARTMENT OF STATE','DEPARTMENT OF JUSTICE','NATIONAL SECURITY AGENCY/CENTRAL SECURITY SERVICE','CENTRAL INTELLIGENCE AGENCY','DEFENSE INTELLIGENCE AGENCY','NATIONAL GEOSPATIAL-INTELLIGENCE AGENCY','NATIONAL RECONNAISSANCE OFFICE','DEPARTMENT OF VETERANS AFFAIRS') THEN 'defense' ELSE 'civilian' END as sector, s.dep as departures, COALESCE(a.hir, 0) as hires, s.dep - COALESCE(a.hir, 0) as net_loss, ROUND(COALESCE(a.hir, 0)::numeric / NULLIF(s.dep, 0) * 100, 1) as replacement_pct FROM (SELECT agency, COUNT(*) as dep FROM separations WHERE personnel_action_effective_date_yyyymm >= '202501' AND stem_occupation_type IN ('MATHEMATICS OCCUPATIONS','TECHNOLOGY OCCUPATIONS','ENGINEERING OCCUPATIONS','SCIENCE OCCUPATIONS') GROUP BY 1) s LEFT JOIN (SELECT agency, COUNT(*) as hir FROM accessions WHERE personnel_action_effective_date_yyyymm >= '202501' AND stem_occupation_type IN ('MATHEMATICS OCCUPATIONS','TECHNOLOGY OCCUPATIONS','ENGINEERING OCCUPATIONS','SCIENCE OCCUPATIONS') GROUP BY 1) a ON s.agency = a.agency WHERE s.dep > 200 ORDER BY net_loss DESC"
        ),
        query<{ age_bracket: string; count: string; avg_pay: string }>(
          "SELECT age_bracket, COUNT(*) as count, ROUND(AVG(annualized_adjusted_basic_pay)) as avg_pay FROM employment WHERE age_bracket IS NOT NULL AND age_bracket NOT IN ('INVALID','NO DATA REPORTED') AND annualized_adjusted_basic_pay IS NOT NULL GROUP BY age_bracket ORDER BY MIN(CASE WHEN age_bracket = 'LESS THAN 20' THEN 1 WHEN age_bracket = '20-24' THEN 2 WHEN age_bracket = '25-29' THEN 3 WHEN age_bracket = '30-34' THEN 4 WHEN age_bracket = '35-39' THEN 5 WHEN age_bracket = '40-44' THEN 6 WHEN age_bracket = '45-49' THEN 7 WHEN age_bracket = '50-54' THEN 8 WHEN age_bracket = '55-59' THEN 9 WHEN age_bracket = '60-64' THEN 10 WHEN age_bracket = '65 OR MORE' THEN 11 END)"
        ),
        query<{ grade: string; count: string; avg_pay: string }>(
          "SELECT 'GS-' || grade::int as grade, COUNT(*) as count, ROUND(AVG(annualized_adjusted_basic_pay)) as avg_pay FROM employment WHERE grade ~ '^[0-9]{2}$' AND grade::int BETWEEN 1 AND 15 AND annualized_adjusted_basic_pay IS NOT NULL GROUP BY grade ORDER BY grade::int"
        ),
        query<{ work_schedule: string; count: string }>(
          "SELECT CASE WHEN work_schedule LIKE 'FULL-TIME%' THEN 'Full-Time' WHEN work_schedule LIKE 'PART-TIME%' THEN 'Part-Time' WHEN work_schedule LIKE 'INTERMITTENT%' THEN 'Intermittent' ELSE 'Other' END as work_schedule, COUNT(*) as count FROM employment WHERE work_schedule IS NOT NULL AND work_schedule NOT IN ('INVALID','NO DATA REPORTED') GROUP BY 1 ORDER BY count DESC"
        ),
        query<{ tenure: string; category: string; count: string; avg_pay: string }>(
          "SELECT CASE WHEN length_of_service_years < 5 THEN '0-4 yr' WHEN length_of_service_years < 10 THEN '5-9 yr' WHEN length_of_service_years < 15 THEN '10-14 yr' WHEN length_of_service_years < 20 THEN '15-19 yr' WHEN length_of_service_years < 25 THEN '20-24 yr' WHEN length_of_service_years < 30 THEN '25-29 yr' ELSE '30+ yr' END as tenure, CASE WHEN stem_occupation_type IS NOT NULL AND stem_occupation_type <> '' AND stem_occupation_type <> 'UNSPECIFIED' THEN 'STEM' ELSE 'Non-STEM' END as category, COUNT(*) as count, ROUND(AVG(annualized_adjusted_basic_pay)) as avg_pay FROM employment WHERE length_of_service_years IS NOT NULL AND annualized_adjusted_basic_pay IS NOT NULL GROUP BY 1, 2 ORDER BY MIN(length_of_service_years), category"
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
      separationReasons: separationReasons.map((r) => ({ category: r.separation_category, count: Number(r.count) })),
      agencyNetChanges: agencyNetChanges.map((r) => ({ agency: r.agency, hires: Number(r.hires), departures: Number(r.departures), netChange: Number(r.net_change) })),
      stemBrainDrain: stemBrainDrain.map((r) => ({ category: r.category, departures: Number(r.departures), hires: Number(r.hires), netLoss: Number(r.net_loss), replacementPct: Number(r.replacement_pct), avgDepartingPay: Number(r.avg_departing_pay) })),
      stateReplacementRates: stateReplacementRates.map((r) => ({ state: r.state, abbreviation: r.abbreviation, departures: Number(r.departures), hires: Number(r.hires), netLoss: Number(r.net_loss), replacementPct: Number(r.replacement_pct) })),
      stemPositionLosses: stemPositionLosses.map((r) => ({ position: r.position, stemType: r.stem_type, departures: Number(r.departures), hires: Number(r.hires), netLoss: Number(r.net_loss), replacementPct: Number(r.replacement_pct), avgPay: Number(r.avg_pay) })),
      stemAgencyLosses: stemAgencyLosses.map((r) => ({ agency: r.agency, sector: r.sector, departures: Number(r.departures), hires: Number(r.hires), netLoss: Number(r.net_loss), replacementPct: Number(r.replacement_pct) })),
      payByAge: payByAge.map((r) => ({ ageBracket: r.age_bracket, count: Number(r.count), avgPay: Number(r.avg_pay) })),
      gradeDistribution: gradeDistribution.map((r) => ({ grade: r.grade, count: Number(r.count), avgPay: Number(r.avg_pay) })),
      workSchedule: workSchedule.map((r) => ({ schedule: r.work_schedule, count: Number(r.count) })),
      tenureBySTEM: tenureBySTEM.map((r) => ({ tenure: r.tenure, category: r.category, count: Number(r.count), avgPay: Number(r.avg_pay) })),
    };
  },
  ["homepage-insights"],
  { revalidate: 86400, tags: ["stats"] }
);
