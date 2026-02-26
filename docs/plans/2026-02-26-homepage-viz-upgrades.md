# Homepage Visualization Upgrades Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add 6 visual upgrades to the LevelsGov homepage: animated stat counters, radar chart (pay by age), GS grade bar chart, scatter plot (STEM vs non-STEM), work schedule donut, and bento grid layout.

**Architecture:** Build bottom-up — SQL queries first, then chart components, then wire into page. Each new chart is an independent export in `home-charts.tsx`. The animated counter is a standalone client component. Layout rearrangement happens last since it touches everything.

**Tech Stack:** Next.js 16 (server components), recharts 2.15, motion 12, shadcn/ui chart primitives, Tailwind CSS 4, PostgreSQL.

---

### Task 1: Add 4 new SQL queries to filters.ts

**Files:**
- Modify: `src/lib/filters.ts:115-170`

**Step 1: Add queries to the Promise.all array**

Inside `getHomepageInsights`, add these 4 queries to the existing Promise.all (after `stemAgencyLosses` on line 155):

```typescript
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
```

**Step 2: Update destructuring and return object**

Update the destructuring on line 115 to add the 4 new variables:
`..., stemAgencyLosses, payByAge, gradeDistribution, workSchedule, tenureBySTEM] =`

Add to the return object (after `stemAgencyLosses` mapping on line 170):

```typescript
payByAge: payByAge.map((r) => ({ ageBracket: r.age_bracket, count: Number(r.count), avgPay: Number(r.avg_pay) })),
gradeDistribution: gradeDistribution.map((r) => ({ grade: r.grade, count: Number(r.count), avgPay: Number(r.avg_pay) })),
workSchedule: workSchedule.map((r) => ({ schedule: r.work_schedule, count: Number(r.count) })),
tenureBySTEM: tenureBySTEM.map((r) => ({ tenure: r.tenure, category: r.category, count: Number(r.count), avgPay: Number(r.avg_pay) })),
```

**Step 3: Build to verify queries compile**

Run: `npm run build`
Expected: Build passes (queries only execute at runtime, but TypeScript types must be correct)

**Step 4: Commit**

```bash
git add src/lib/filters.ts
git commit -m "feat: add SQL queries for age, grade, work schedule, tenure×STEM"
```

---

### Task 2: Add AnimatedNumber component

**Files:**
- Create: `src/components/animated-number.tsx`

**Step 1: Create the component**

```tsx
"use client";

import { useEffect, useRef } from "react";
import { useInView, useMotionValue, useSpring, MotionValue } from "motion/react";

function AnimatedNumber({
  value,
  prefix = "",
  suffix = "",
  className,
}: {
  value: number;
  prefix?: string;
  suffix?: string;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const motionValue = useMotionValue(0);
  const spring = useSpring(motionValue, { duration: 1500 }) as MotionValue<number>;
  const isInView = useInView(ref, { once: true });

  useEffect(() => {
    if (isInView) motionValue.set(value);
  }, [isInView, value, motionValue]);

  useEffect(() => {
    const unsubscribe = spring.on("change", (latest: number) => {
      if (!ref.current) return;
      const rounded = Math.round(latest);
      const formatted = new Intl.NumberFormat("en-US").format(Math.abs(rounded));
      const sign = value < 0 && rounded !== 0 ? "-" : value < 0 ? "" : "";
      ref.current.textContent = `${prefix}${sign}${formatted}${suffix}`;
    });
    return unsubscribe;
  }, [spring, prefix, suffix, value]);

  // SSR fallback: render final value
  const formatted = new Intl.NumberFormat("en-US").format(Math.abs(value));
  const sign = value < 0 ? "-" : "";

  return (
    <span ref={ref} className={className}>
      {prefix}{sign}{formatted}{suffix}
    </span>
  );
}

export { AnimatedNumber };
```

**Step 2: Build to verify**

Run: `npm run build`
Expected: PASS (component not yet used, but must compile)

**Step 3: Commit**

```bash
git add src/components/animated-number.tsx
git commit -m "feat: add AnimatedNumber client component with spring animation"
```

---

### Task 3: Add RadarPayChart component

**Files:**
- Modify: `src/components/home-charts.tsx`

**Step 1: Add radar imports**

Add to the recharts import block (lines 4-15):
`Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis`

**Step 2: Add RadarPayChart export**

Add after the `AreaLineChart` export (after line 406):

```tsx
export function RadarPayChart({
  data,
  dataKey = "value",
  labelKey = "label",
  config,
  className,
}: {
  data: Record<string, unknown>[];
  dataKey?: string;
  labelKey?: string;
  config: ChartConfig;
  className?: string;
}) {
  const isMobile = useIsMobile();

  return (
    <ChartContainer config={config} className={className ?? "h-[300px] w-full"}>
      <RadarChart data={data} cx="50%" cy="50%" outerRadius={isMobile ? "65%" : "75%"}>
        <PolarGrid stroke="hsl(var(--border))" />
        <PolarAngleAxis
          dataKey={labelKey}
          tick={{ fontSize: isMobile ? 9 : 11 }}
        />
        <PolarRadiusAxis
          angle={90}
          tick={false}
          axisLine={false}
        />
        <ChartTooltip
          content={
            <ChartTooltipContent
              formatter={(value) => payFormatter(value as number)}
            />
          }
        />
        <Radar
          dataKey={dataKey}
          stroke={`var(--color-${dataKey})`}
          fill={`var(--color-${dataKey})`}
          fillOpacity={0.3}
          strokeWidth={2}
          dot={{ r: 3, fill: `var(--color-${dataKey})` }}
        />
      </RadarChart>
    </ChartContainer>
  );
}
```

**Step 3: Build to verify**

Run: `npm run build`
Expected: PASS

**Step 4: Commit**

```bash
git add src/components/home-charts.tsx
git commit -m "feat: add RadarPayChart component for polar data"
```

---

### Task 4: Add ScatterPayChart component

**Files:**
- Modify: `src/components/home-charts.tsx`

**Step 1: Add scatter imports**

Add to recharts imports: `Scatter, ScatterChart, ZAxis, Legend`

**Step 2: Add ScatterPayChart export**

```tsx
export function ScatterPayChart({
  stemData,
  nonStemData,
  className,
}: {
  stemData: { x: number; y: number; z: number; label: string }[];
  nonStemData: { x: number; y: number; z: number; label: string }[];
  className?: string;
}) {
  const isMobile = useIsMobile();
  const config: ChartConfig = {
    stem: { label: "STEM", color: "var(--chart-1)" },
    nonStem: { label: "Non-STEM", color: "var(--chart-4)" },
  };

  return (
    <ChartContainer config={config} className={className ?? "h-[300px] w-full"}>
      <ScatterChart margin={{ left: -10, right: 10, top: 10, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis
          dataKey="x"
          type="number"
          name="Tenure"
          tickLine={false}
          axisLine={false}
          tick={{ fontSize: isMobile ? 10 : 12 }}
          tickFormatter={(v: number) => `${v}yr`}
        />
        <YAxis
          dataKey="y"
          type="number"
          name="Pay"
          tickLine={false}
          axisLine={false}
          tick={{ fontSize: isMobile ? 10 : 12 }}
          tickFormatter={(v: number) => `$${compactFormatter(v)}`}
        />
        <ZAxis dataKey="z" range={[40, 400]} name="Count" />
        <ChartTooltip
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null;
            const d = payload[0].payload as { x: number; y: number; z: number; label: string };
            return (
              <div className="rounded-lg border bg-background px-3 py-2 shadow-xl">
                <p className="text-sm font-medium">{d.label}</p>
                <p className="text-xs text-muted-foreground">
                  {payFormatter(d.y)} avg · {new Intl.NumberFormat("en-US").format(d.z)} employees
                </p>
              </div>
            );
          }}
        />
        <Legend />
        <Scatter name="STEM" data={stemData} fill="var(--color-stem)" />
        <Scatter name="Non-STEM" data={nonStemData} fill="var(--color-nonStem)" />
      </ScatterChart>
    </ChartContainer>
  );
}
```

**Step 3: Build to verify**

Run: `npm run build`
Expected: PASS

**Step 4: Commit**

```bash
git add src/components/home-charts.tsx
git commit -m "feat: add ScatterPayChart component for STEM vs non-STEM"
```

---

### Task 5: Add DonutChart component

**Files:**
- Modify: `src/components/home-charts.tsx`

**Step 1: Add pie imports**

Add to recharts imports: `PieChart, Pie, Label`

**Step 2: Add DonutChart export**

```tsx
export function DonutChart({
  data,
  className,
}: {
  data: { label: string; value: number }[];
  className?: string;
}) {
  const total = data.reduce((sum, d) => sum + d.value, 0);
  const pieData = data.map((d) => ({ name: d.label, value: d.value }));
  const config: ChartConfig = { value: { label: "Count" } };

  return (
    <ChartContainer config={config} className={className ?? "h-[250px] w-full"}>
      <PieChart>
        <Pie
          data={pieData}
          dataKey="value"
          nameKey="name"
          cx="50%"
          cy="50%"
          innerRadius="55%"
          outerRadius="80%"
          strokeWidth={2}
          stroke="hsl(var(--background))"
        >
          {pieData.map((_, i) => (
            <Cell key={i} fill={TREEMAP_COLORS[i % TREEMAP_COLORS.length]} />
          ))}
          <Label
            content={({ viewBox }) => {
              if (viewBox && "cx" in viewBox && "cy" in viewBox) {
                return (
                  <text x={viewBox.cx} y={viewBox.cy} textAnchor="middle" dominantBaseline="middle">
                    <tspan x={viewBox.cx} y={viewBox.cy} className="fill-foreground text-2xl font-bold">
                      {compactFormatter(total)}
                    </tspan>
                    <tspan x={viewBox.cx} y={(viewBox.cy ?? 0) + 20} className="fill-muted-foreground text-xs">
                      employees
                    </tspan>
                  </text>
                );
              }
            }}
          />
        </Pie>
        <ChartTooltip
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null;
            const item = payload[0].payload as { name: string; value: number };
            const pct = ((item.value / total) * 100).toFixed(1);
            return (
              <div className="rounded-lg border bg-background px-3 py-2 shadow-xl">
                <p className="text-sm font-medium">{item.name}</p>
                <p className="text-xs text-muted-foreground">
                  {new Intl.NumberFormat("en-US").format(item.value)} ({pct}%)
                </p>
              </div>
            );
          }}
        />
      </PieChart>
    </ChartContainer>
  );
}
```

**Step 3: Build to verify**

Run: `npm run build`
Expected: PASS

**Step 4: Commit**

```bash
git add src/components/home-charts.tsx
git commit -m "feat: add DonutChart component for proportional data"
```

---

### Task 6: Wire AnimatedNumber into hero stat cards in page.tsx

**Files:**
- Modify: `src/app/page.tsx:1-25,270-290`

**Step 1: Import AnimatedNumber**

Add to imports: `import { AnimatedNumber } from "@/components/animated-number";`

**Step 2: Replace static stat values with AnimatedNumber**

Replace the hero stats array (lines ~270-290). For each stat, change the `value` field from a string to a JSX element using AnimatedNumber:

- Total Employees: `<AnimatedNumber value={stats.total_employment} />`
- Median Pay: `<AnimatedNumber value={stats.median_pay} prefix="$" />`
- Agencies: `<AnimatedNumber value={stats.agencies_count} />`
- New Hires: `<AnimatedNumber value={stats.total_accessions} />`
- Net Change: `<AnimatedNumber value={netChange} prefix={netChange >= 0 ? "+" : ""} />`

The stat card rendering needs to change from `{stat.value}` (string) to support both string and ReactNode. Update the stat type to use `value: React.ReactNode` and render directly.

**Step 3: Build to verify**

Run: `npm run build`
Expected: PASS

**Step 4: Commit**

```bash
git add src/app/page.tsx src/components/animated-number.tsx
git commit -m "feat: add animated number counters to hero stat cards"
```

---

### Task 7: Wire new charts + data prep + bento layout in page.tsx

**Files:**
- Modify: `src/app/page.tsx`

**Step 1: Update imports**

Add to chart imports:
```tsx
import { HorizontalBarChart, VerticalBarChart, NetChangeBarChart, TreemapChart, AreaLineChart, RadarPayChart, ScatterPayChart, DonutChart } from "@/components/home-charts";
```

**Step 2: Add data prep for 4 new datasets**

After existing data prep (after `stemSectorData`), add:

```tsx
// Pay by Age — radar
const ageData = insights.payByAge.map((a) => ({
  label: a.ageBracket.replace("LESS THAN 20", "<20").replace("65 OR MORE", "65+"),
  value: a.avgPay,
  count: a.count,
}));
const ageConfig = { value: { label: "Avg Pay", color: "var(--chart-1)" } };

// GS Grade Distribution
const gradeData = insights.gradeDistribution.map((g) => ({
  label: g.grade,
  value: g.count,
  avgPay: g.avgPay,
}));
const gradeConfig = { value: { label: "Employees", color: "var(--chart-2)" } };
const gradeColors = insights.gradeDistribution.map((_, i, arr) => {
  const t = i / (arr.length - 1);
  return `hsl(${210 + t * 0}, ${50 + t * 30}%, ${65 - t * 25}%)`;
});

// Work Schedule donut
const scheduleData = insights.workSchedule.map((w) => ({
  label: w.schedule,
  value: w.count,
}));

// Tenure × STEM scatter
const stemScatter = insights.tenureBySTEM
  .filter((t) => t.category === "STEM")
  .map((t) => ({
    x: parseInt(t.tenure),
    y: t.avgPay,
    z: t.count,
    label: `STEM · ${t.tenure}`,
  }));
const nonStemScatter = insights.tenureBySTEM
  .filter((t) => t.category === "Non-STEM")
  .map((t) => ({
    x: parseInt(t.tenure),
    y: t.avgPay,
    z: t.count,
    label: `Non-STEM · ${t.tenure}`,
  }));
```

**Step 3: Rearrange JSX into bento grid layout**

Replace the existing grid sections with the new layout per the design doc:

- **Row 4** (Tenure + Education + Age): change `lg:grid-cols-2` to `lg:grid-cols-3`, add Pay by Age radar card
- **Row 5** (Pay by Field + Supervisory + Work Schedule): new `lg:grid-cols-3` row, add DonutChart card
- **Row 6** (GS Grade + Scatter): new `lg:grid-cols-2` row with VerticalBarChart for grades and ScatterPayChart
- **Row 8**: Move State Impact map to full-width standalone card

**Step 4: Build to verify**

Run: `npm run build`
Expected: PASS

**Step 5: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat: wire new charts and bento grid layout on homepage"
```

---

### Task 8: Final verification and polish

**Step 1: Full build**

Run: `npm run build`
Expected: PASS with no warnings

**Step 2: Visual check**

Run: `npm run dev` and check localhost:3000
Verify:
- Animated counters count up on load
- Radar chart shows age brackets with pay
- GS grade bars render with color gradient
- Scatter plot shows STEM vs non-STEM dots
- Donut shows work schedule breakdown
- Bento grid layout has mixed column counts
- All tooltips work
- Mobile responsive (check at 375px width)

**Step 3: Commit and push**

```bash
git add -A
git commit -m "polish: final adjustments to homepage viz upgrades"
git push
```
