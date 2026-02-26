# Homepage Visualization Upgrades Design

## Overview
6 upgrades to the LevelsGov homepage: animated stat counters, 3 new chart types (radar, scatter, donut), GS grade distribution bar chart, and bento grid layout.

## 1. Animated Number Counters

**What**: Hero stat cards animate from 0 to final value on scroll-into-view.

- Add `framer-motion` dependency
- Create `AnimatedNumber` client component using `useSpring` + `useInView`
- Duration: ~1.5s, easeOut
- Handles currency (`$XX,XXX`), plain numbers (`XX,XXX`), and signed numbers (`-XX,XXX`)
- Server component renders static values; client component hydrates with animation
- File: new `src/components/animated-number.tsx`

## 2. Pay by Age — Radar Chart

**What**: Radar/spider chart showing avg pay across 11 age brackets.

- New SQL: `SELECT age_bracket, COUNT(*) as count, ROUND(AVG(annualized_adjusted_basic_pay)) as avg_pay FROM employment WHERE age_bracket IS NOT NULL AND age_bracket NOT IN ('INVALID','NO DATA REPORTED') AND annualized_adjusted_basic_pay IS NOT NULL GROUP BY age_bracket ORDER BY age_bracket`
- Recharts: `RadarChart` + `Radar` + `PolarGrid` + `PolarAngleAxis` + `PolarRadiusAxis`
- New export in `home-charts.tsx`: `RadarPayChart({ data, config, className })`
- Tooltip: age bracket, avg pay, headcount
- Filled polygon with opacity, stroke on edges
- Placement: new card in the Tenure + Education row (make it 3-col on lg)

## 3. GS Grade Distribution — Vertical Bar

**What**: Bar chart showing headcount per GS grade (01-15), bars colored by avg pay.

- New SQL: `SELECT grade, COUNT(*) as count, ROUND(AVG(annualized_adjusted_basic_pay)) as avg_pay FROM employment WHERE grade ~ '^[0-9]{2}$' AND grade::int BETWEEN 1 AND 15 AND annualized_adjusted_basic_pay IS NOT NULL GROUP BY grade ORDER BY grade::int`
- Reuse existing `VerticalBarChart` with per-bar coloring via `colors` prop
- Color gradient: lighter hue for low grades → deeper for high grades
- X-axis labels: "GS-1" through "GS-15"
- Tooltip: grade, headcount, avg pay
- Placement: pair with Work Schedule donut

## 4. Pay vs Tenure Scatter — STEM vs Non-STEM

**What**: Scatter plot showing avg pay by tenure, split by STEM classification.

- New SQL: `SELECT CASE WHEN length_of_service_years < 5 THEN '0-4' ... END as tenure, CASE WHEN stem_occupation_type IN (...) THEN 'STEM' ELSE 'Non-STEM' END as category, COUNT(*) as count, ROUND(AVG(annualized_adjusted_basic_pay)) as avg_pay FROM employment WHERE ... GROUP BY 1, 2 ORDER BY 1, 2`
- Recharts: `ScatterChart` + `Scatter` + `XAxis` + `YAxis` + `ZAxis`
- Two `<Scatter>` series: STEM (blue) and Non-STEM (gray)
- Dot size proportional to headcount (ZAxis)
- New export: `ScatterPayChart` in `home-charts.tsx`
- Placement: new section after Tenure + Education

## 5. Work Schedule Donut

**What**: Donut/pie chart showing Full-Time / Part-Time / Intermittent / Other.

- New SQL: consolidate 12 work_schedule values into 4 groups via CASE WHEN
- Recharts: `PieChart` + `Pie` + `Cell` + `Label` (center total)
- New export: `DonutChart({ data, config, className })` in `home-charts.tsx`
- Legend below with labels + counts
- Placement: small card in bento layout

## 6. Bento Grid Layout

**What**: Mixed-size card grid replacing uniform 2-column rows.

Layout (top to bottom):
- **Row 1**: Hero stats (5-col, unchanged)
- **Row 2**: Pay by State map (full-width, unchanged)
- **Row 3**: 2-col — Top Agencies | Top Occupations
- **Row 4**: 3-col — Pay by Tenure | Pay by Education | Pay by Age (radar)
- **Row 5**: 3-col — Pay by Field (small) | Supervisory Gap (small) | Work Schedule donut (small)
- **Row 6**: 2-col — GS Grade Distribution | Pay vs Tenure Scatter
- **Row 7**: 2-col — Why People Leave (treemap) | Biggest Agency Changes
- **Row 8**: State Impact map (full-width)
- **Row 9**: 2-col — STEM Brain Drain | STEM Positions Lost
- **Row 10**: STEM Defense vs Civilian (half-width, standalone)
- **Row 11**: Net Change callout (full-width, unchanged)
- **Row 12**: CTA buttons (unchanged)

Grid uses `lg:grid-cols-3` for 3-col rows, `lg:grid-cols-2` for 2-col rows. Small cards use fixed shorter heights.

## New Dependencies
- `framer-motion` (for animated counters)

## Files to Modify
| File | Change |
|------|--------|
| `src/components/animated-number.tsx` | New — animated counter component |
| `src/components/home-charts.tsx` | Add RadarPayChart, ScatterPayChart, DonutChart |
| `src/lib/filters.ts` | Add 4 new SQL queries (age, grade, work schedule, tenure×STEM) |
| `src/app/page.tsx` | Import new components, add data prep, rearrange layout to bento grid |
| `package.json` | Add framer-motion |
