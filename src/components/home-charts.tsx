"use client";

import { useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  XAxis,
  YAxis,
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
}: {
  data: Record<string, unknown>[];
  dataKey?: string;
  labelKey?: string;
  config: ChartConfig;
  className?: string;
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
          tickFormatter={(v: number) => `$${compactFormatter(v)}`}
          tick={{ fontSize: isMobile ? 10 : 12 }}
        />
        <ChartTooltip
          content={
            <ChartTooltipContent
              formatter={(value) => payFormatter(value as number)}
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
