"use client";

import { useEffect, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceLine,
  Treemap,
  XAxis,
  YAxis,
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Scatter,
  ScatterChart,
  ZAxis,
  Legend,
  PieChart,
  Pie,
  Label,
} from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";

const payFormatter = (v: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(v);

const compactFormatter = (v: number) =>
  v >= 1000 ? `${(v / 1000).toFixed(0)}K` : String(v);

function useIsMobile(breakpoint = 640) {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${breakpoint}px)`);
    setIsMobile(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [breakpoint]);
  return isMobile;
}

// Horizontal bar chart for ranked data (states, agencies, occupations, etc.)
export function HorizontalBarChart({
  data,
  dataKey = "value",
  labelKey = "label",
  config,
  className,
  valueFormat = "currency",
}: {
  data: Record<string, unknown>[];
  dataKey?: string;
  labelKey?: string;
  config: ChartConfig;
  className?: string;
  valueFormat?: "currency" | "number";
}) {
  const isMobile = useIsMobile();
  const labelWidth = isMobile ? 90 : 140;
  const maxLabelLen = isMobile ? 12 : 20;

  const tickFmt = valueFormat === "currency"
    ? (v: number) => `$${compactFormatter(v)}`
    : (v: number) => compactFormatter(v);
  const tooltipFmt = valueFormat === "currency"
    ? (value: number | string) => payFormatter(value as number)
    : (value: number | string) => new Intl.NumberFormat("en-US").format(value as number);

  return (
    <ChartContainer config={config} className={className ?? "h-[400px] w-full"}>
      <BarChart
        data={data}
        layout="vertical"
        margin={{ left: 0, right: isMobile ? 8 : 16, top: 0, bottom: 0 }}
      >
        <CartesianGrid horizontal={false} strokeDasharray="3 3" />
        <YAxis
          dataKey={labelKey}
          type="category"
          width={labelWidth}
          tickLine={false}
          axisLine={false}
          tick={{ fontSize: isMobile ? 10 : 12 }}
          tickFormatter={(v: string) =>
            v.length > maxLabelLen ? v.slice(0, maxLabelLen - 2) + ".." : v
          }
        />
        <XAxis
          type="number"
          tickLine={false}
          axisLine={false}
          tickFormatter={tickFmt}
          tick={{ fontSize: isMobile ? 10 : 12 }}
        />
        <ChartTooltip
          content={
            <ChartTooltipContent
              formatter={(value) => tooltipFmt(value as number)}
            />
          }
        />
        <Bar dataKey={dataKey} radius={[0, 4, 4, 0]} fill={`var(--color-${dataKey})`} />
      </BarChart>
    </ChartContainer>
  );
}

// Vertical bar chart for tenure/education progression
export function VerticalBarChart({
  data,
  dataKey = "value",
  labelKey = "label",
  config,
  className,
  colors,
}: {
  data: Record<string, unknown>[];
  dataKey?: string;
  labelKey?: string;
  config: ChartConfig;
  className?: string;
  colors?: string[];
}) {
  return (
    <ChartContainer config={config} className={className ?? "h-[300px] w-full"}>
      <BarChart
        data={data}
        margin={{ left: -10, right: 10, top: 10, bottom: 0 }}
      >
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis
          dataKey={labelKey}
          tickLine={false}
          axisLine={false}
          tick={{ fontSize: 11 }}
          tickFormatter={(v: string) =>
            v.length > 12 ? v.slice(0, 10) + ".." : v
          }
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          tickFormatter={(v: number) => `$${compactFormatter(v)}`}
        />
        <ChartTooltip
          content={
            <ChartTooltipContent
              formatter={(value) => payFormatter(value as number)}
            />
          }
        />
        <Bar dataKey={dataKey} radius={[4, 4, 0, 0]} fill={`var(--color-${dataKey})`}>
          {colors &&
            data.map((_, i) => (
              <Cell key={i} fill={colors[i % colors.length]} />
            ))}
        </Bar>
      </BarChart>
    </ChartContainer>
  );
}

// Horizontal bar chart for net change data (supports negative values with color coding)
export function NetChangeBarChart({
  data,
  dataKey = "value",
  labelKey = "label",
  config,
  className,
  positiveColor = "var(--chart-2)",
  negativeColor = "var(--chart-1)",
}: {
  data: Record<string, unknown>[];
  dataKey?: string;
  labelKey?: string;
  config: ChartConfig;
  className?: string;
  positiveColor?: string;
  negativeColor?: string;
}) {
  const isMobile = useIsMobile();
  const labelWidth = isMobile ? 90 : 140;
  const maxLabelLen = isMobile ? 12 : 20;

  return (
    <ChartContainer config={config} className={className ?? "h-[400px] w-full"}>
      <BarChart
        data={data}
        layout="vertical"
        margin={{ left: 0, right: isMobile ? 8 : 16, top: 0, bottom: 0 }}
      >
        <CartesianGrid horizontal={false} strokeDasharray="3 3" />
        <YAxis
          dataKey={labelKey}
          type="category"
          width={labelWidth}
          tickLine={false}
          axisLine={false}
          tick={{ fontSize: isMobile ? 10 : 12 }}
          tickFormatter={(v: string) =>
            v.length > maxLabelLen ? v.slice(0, maxLabelLen - 2) + ".." : v
          }
        />
        <XAxis
          type="number"
          tickLine={false}
          axisLine={false}
          tickFormatter={(v: number) =>
            v >= 0 ? `+${compactFormatter(v)}` : `-${compactFormatter(Math.abs(v))}`
          }
          tick={{ fontSize: isMobile ? 10 : 12 }}
        />
        <ReferenceLine x={0} stroke="hsl(var(--border))" />
        <ChartTooltip
          content={
            <ChartTooltipContent
              formatter={(value) => {
                const n = value as number;
                return `${n >= 0 ? "+" : ""}${new Intl.NumberFormat("en-US").format(n)}`;
              }}
            />
          }
        />
        <Bar dataKey={dataKey} radius={[0, 4, 4, 0]}>
          {data.map((d, i) => (
            <Cell
              key={i}
              fill={(d[dataKey] as number) >= 0 ? positiveColor : negativeColor}
            />
          ))}
        </Bar>
      </BarChart>
    </ChartContainer>
  );
}

const TREEMAP_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

interface TreemapNodeProps {
  x: number;
  y: number;
  width: number;
  height: number;
  index: number;
  name: string;
  value: number;
  total: number;
}

function TreemapNode({ x, y, width, height, index, name, value, total }: TreemapNodeProps) {
  const pct = ((value / total) * 100).toFixed(1);
  const showLabel = width > 40 && height > 28;
  const showPct = width > 50 && height > 42;

  return (
    <g>
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        rx={4}
        fill={TREEMAP_COLORS[index % TREEMAP_COLORS.length]}
        stroke="hsl(var(--background))"
        strokeWidth={2}
      />
      {showLabel && (
        <text
          x={x + width / 2}
          y={y + height / 2 + (showPct ? -6 : 0)}
          textAnchor="middle"
          dominantBaseline="central"
          className="fill-white text-[10px] font-medium sm:text-xs"
        >
          {width < 70 && name.length > 10 ? name.slice(0, 8) + ".." : name}
        </text>
      )}
      {showPct && (
        <text
          x={x + width / 2}
          y={y + height / 2 + 10}
          textAnchor="middle"
          dominantBaseline="central"
          className="fill-white/80 text-[9px] sm:text-[10px]"
        >
          {pct}%
        </text>
      )}
    </g>
  );
}

export function TreemapChart({
  data,
  className,
}: {
  data: { label: string; value: number }[];
  className?: string;
}) {
  const total = data.reduce((sum, d) => sum + d.value, 0);
  const treemapData = data.map((d) => ({ name: d.label, value: d.value }));
  const config: ChartConfig = { value: { label: "Count" } };

  return (
    <ChartContainer config={config} className={className ?? "h-[320px] w-full sm:h-[380px]"}>
      <Treemap
        data={treemapData}
        dataKey="value"
        aspectRatio={4 / 3}
        content={<TreemapNode total={total} x={0} y={0} width={0} height={0} index={0} name="" value={0} />}
      >
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
      </Treemap>
    </ChartContainer>
  );
}

export function AreaLineChart({
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
  // Compute a Y-axis min so the curve isn't flattened against $0
  const values = data.map((d) => d[dataKey] as number).filter(Boolean);
  const minVal = Math.min(...values);
  const yMin = Math.floor(minVal / 10000) * 10000; // round down to nearest $10K

  return (
    <ChartContainer config={config} className={className ?? "h-[300px] w-full"}>
      <AreaChart
        data={data}
        margin={{ left: -10, right: 10, top: 10, bottom: 0 }}
      >
        <defs>
          <linearGradient id={`fill-${dataKey}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={`var(--color-${dataKey})`} stopOpacity={0.35} />
            <stop offset="100%" stopColor={`var(--color-${dataKey})`} stopOpacity={0.05} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis
          dataKey={labelKey}
          tickLine={false}
          axisLine={false}
          tick={{ fontSize: 11 }}
          tickFormatter={(v: string) =>
            v.length > 12 ? v.slice(0, 10) + ".." : v
          }
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          domain={[yMin, "auto"]}
          tickFormatter={(v: number) => `$${compactFormatter(v)}`}
        />
        <ChartTooltip
          content={
            <ChartTooltipContent
              formatter={(value) => payFormatter(value as number)}
            />
          }
        />
        <Area
          type="monotone"
          dataKey={dataKey}
          stroke={`var(--color-${dataKey})`}
          strokeWidth={2.5}
          fill={`url(#fill-${dataKey})`}
          dot={{ r: 4, fill: `var(--color-${dataKey})`, strokeWidth: 0 }}
          activeDot={{ r: 6 }}
        />
      </AreaChart>
    </ChartContainer>
  );
}

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
