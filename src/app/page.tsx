export const dynamic = "force-dynamic";

import Link from "next/link";
import {
  ArrowRight,
  Briefcase,
  Building2,
  DollarSign,
  TrendingDown,
  UserMinus,
  UserPlus,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { getStats, getHomepageInsights } from "@/lib/filters";

function formatSnapshotDate(yyyymm: string): string {
  const year = yyyymm.slice(0, 4);
  const month = yyyymm.slice(4, 6);
  const date = new Date(Number(year), Number(month) - 1);
  return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

function formatNumber(n: number): string {
  return new Intl.NumberFormat("en-US").format(n);
}

function formatPay(n: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

function formatCompact(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n);
}

function BarChart({
  items,
  maxValue,
  labelKey,
  valueKey,
  formatValue = formatPay,
  subtitleKey,
  formatSubtitle,
}: {
  items: Record<string, unknown>[];
  maxValue: number;
  labelKey: string;
  valueKey: string;
  formatValue?: (n: number) => string;
  subtitleKey?: string;
  formatSubtitle?: (n: number) => string;
}) {
  return (
    <div className="flex flex-col gap-3">
      {items.map((item, i) => {
        const value = item[valueKey] as number;
        const pct = (value / maxValue) * 100;
        return (
          <div key={i}>
            <div className="mb-1 flex items-baseline justify-between gap-2">
              <span className="truncate text-sm font-medium">
                {item[labelKey] as string}
              </span>
              <div className="flex items-baseline gap-2 shrink-0">
                {subtitleKey && formatSubtitle && (
                  <span className="text-xs text-muted-foreground">
                    {formatSubtitle(item[subtitleKey] as number)}
                  </span>
                )}
                <span className="text-sm font-semibold tabular-nums">
                  {formatValue(value)}
                </span>
              </div>
            </div>
            <div className="h-2 w-full rounded-full bg-muted">
              <div
                className="h-2 rounded-full bg-primary transition-all"
                style={{ width: `${Math.max(pct, 2)}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default async function HomePage() {
  const [stats, insights] = await Promise.all([
    getStats(),
    getHomepageInsights(),
  ]);
  const snapshotLabel = formatSnapshotDate(stats.latest_snapshot);
  const netChange = stats.total_accessions - stats.total_separations;
  const stateMax = Math.max(...insights.payByState.map((s) => s.avgPay));
  const agencyMax = Math.max(...insights.topAgencies.map((a) => a.avgPay));
  const occMax = Math.max(...insights.topOccupations.map((o) => o.avgPay));
  const eduMax = Math.max(...insights.payByEducation.map((e) => e.avgPay));
  const tenureMax = Math.max(...insights.payByTenure.map((t) => t.avgPay));

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      {/* Hero */}
      <div className="mb-10 text-center">
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
          LevelsGov
        </h1>
        <p className="mx-auto mt-3 max-w-2xl text-lg text-muted-foreground">
          Federal workforce compensation data, transparent and searchable.
          Powered by OPM FedScope ({snapshotLabel}).
        </p>
      </div>

      {/* Key Stats */}
      <div className="mb-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <div className="rounded-lg border bg-card p-5">
          <div className="flex items-center gap-2.5">
            <div className="rounded-md bg-primary/10 p-1.5">
              <Users className="h-4 w-4 text-primary" />
            </div>
            <p className="text-xs text-muted-foreground">Total Employees</p>
          </div>
          <p className="mt-2 text-2xl font-bold">
            {formatNumber(stats.total_employment)}
          </p>
        </div>

        <div className="rounded-lg border bg-card p-5">
          <div className="flex items-center gap-2.5">
            <div className="rounded-md bg-emerald-500/10 p-1.5">
              <DollarSign className="h-4 w-4 text-emerald-600" />
            </div>
            <p className="text-xs text-muted-foreground">Median Pay</p>
          </div>
          <p className="mt-2 text-2xl font-bold">
            {formatPay(stats.median_pay)}
          </p>
        </div>

        <div className="rounded-lg border bg-card p-5">
          <div className="flex items-center gap-2.5">
            <div className="rounded-md bg-blue-500/10 p-1.5">
              <Building2 className="h-4 w-4 text-blue-600" />
            </div>
            <p className="text-xs text-muted-foreground">Agencies</p>
          </div>
          <p className="mt-2 text-2xl font-bold">
            {formatNumber(stats.agencies_count)}
          </p>
        </div>

        <div className="rounded-lg border bg-card p-5">
          <div className="flex items-center gap-2.5">
            <div className="rounded-md bg-green-500/10 p-1.5">
              <UserPlus className="h-4 w-4 text-green-600" />
            </div>
            <p className="text-xs text-muted-foreground">New Hires</p>
          </div>
          <p className="mt-2 text-2xl font-bold">
            {formatNumber(stats.total_accessions)}
          </p>
        </div>

        <div className="rounded-lg border bg-card p-5">
          <div className="flex items-center gap-2.5">
            <div className="rounded-md bg-red-500/10 p-1.5">
              <TrendingDown className="h-4 w-4 text-red-600" />
            </div>
            <p className="text-xs text-muted-foreground">Net Change</p>
          </div>
          <p className={`mt-2 text-2xl font-bold ${netChange >= 0 ? "text-green-600" : "text-red-600"}`}>
            {netChange >= 0 ? "+" : ""}
            {formatNumber(netChange)}
          </p>
        </div>
      </div>

      {/* Pay by State */}
      <div className="mb-10 rounded-lg border bg-card p-6">
        <h2 className="mb-1 text-lg font-semibold">Highest Paying States</h2>
        <p className="mb-5 text-sm text-muted-foreground">
          Average federal employee compensation by duty station state
        </p>
        <BarChart
          items={insights.payByState.map((s) => ({
            label: s.state.replace(/^DISTRICT OF COLUMBIA$/, "WASHINGTON D.C."),
            value: s.avgPay,
            headcount: s.headcount,
          }))}
          maxValue={stateMax}
          labelKey="label"
          valueKey="value"
          subtitleKey="headcount"
          formatSubtitle={(n) => `${formatCompact(n)} emp`}
        />
      </div>

      {/* Two-column: Top Agencies + Top Occupations */}
      <div className="mb-10 grid gap-6 lg:grid-cols-2">
        <div className="rounded-lg border bg-card p-6">
          <h2 className="mb-1 text-lg font-semibold">
            Highest Paying Agencies
          </h2>
          <p className="mb-5 text-sm text-muted-foreground">
            Average pay among agencies with 1,000+ employees
          </p>
          <BarChart
            items={insights.topAgencies.map((a) => ({
              label: a.agency
                .replace(/^DEPARTMENT OF /, "DEPT. ")
                .replace(/^NAT /, ""),
              value: a.avgPay,
              headcount: a.headcount,
            }))}
            maxValue={agencyMax}
            labelKey="label"
            valueKey="value"
            subtitleKey="headcount"
            formatSubtitle={(n) => `${formatCompact(n)} emp`}
          />
        </div>

        <div className="rounded-lg border bg-card p-6">
          <h2 className="mb-1 text-lg font-semibold">
            Highest Paying Occupations
          </h2>
          <p className="mb-5 text-sm text-muted-foreground">
            Average pay among occupations with 500+ employees
          </p>
          <BarChart
            items={insights.topOccupations.map((o) => ({
              label: o.occupation,
              value: o.avgPay,
              count: o.count,
            }))}
            maxValue={occMax}
            labelKey="label"
            valueKey="value"
            subtitleKey="count"
            formatSubtitle={(n) => `${formatCompact(n)} emp`}
          />
        </div>
      </div>

      {/* Two-column: Education + Tenure */}
      <div className="mb-10 grid gap-6 lg:grid-cols-2">
        <div className="rounded-lg border bg-card p-6">
          <h2 className="mb-1 text-lg font-semibold">Pay by Education</h2>
          <p className="mb-5 text-sm text-muted-foreground">
            Average compensation by highest education attained
          </p>
          <BarChart
            items={insights.payByEducation.map((e) => ({
              label: e.education
                .split(" - ")[0]
                .replace(
                  /TERMINAL OCCUPATIONAL PROGRAM/,
                  "VOCATIONAL PROGRAM"
                ),
              value: e.avgPay,
              count: e.count,
            }))}
            maxValue={eduMax}
            labelKey="label"
            valueKey="value"
            subtitleKey="count"
            formatSubtitle={(n) => `${formatCompact(n)} emp`}
          />
        </div>

        <div className="rounded-lg border bg-card p-6">
          <h2 className="mb-1 text-lg font-semibold">Pay by Tenure</h2>
          <p className="mb-5 text-sm text-muted-foreground">
            Average compensation by years of federal service
          </p>
          <BarChart
            items={insights.payByTenure.map((t) => ({
              label: t.tenure,
              value: t.avgPay,
              count: t.count,
            }))}
            maxValue={tenureMax}
            labelKey="label"
            valueKey="value"
            subtitleKey="count"
            formatSubtitle={(n) => `${formatCompact(n)} emp`}
          />
          {insights.payByTenure.length >= 2 && (() => {
            const newest = insights.payByTenure[0];
            const longest = insights.payByTenure[insights.payByTenure.length - 1];
            return (
              <div className="mt-4 rounded-md bg-muted/50 px-3 py-2 text-center text-sm">
                30+ year veterans earn{" "}
                <span className="font-semibold text-emerald-600">
                  {Math.round(((longest.avgPay - newest.avgPay) / newest.avgPay) * 100)}% more
                </span>{" "}
                than new hires
              </div>
            );
          })()}
        </div>
      </div>

      {/* Insight Cards: STEM + Supervisory */}
      <div className="mb-10 grid gap-6 sm:grid-cols-2">
        <div className="rounded-lg border bg-card p-6">
          <h2 className="mb-4 text-lg font-semibold">STEM Premium</h2>
          {insights.stemPay.map((s) => (
            <div key={s.category} className="mb-3 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium capitalize">
                  {s.category.toLowerCase()}
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatNumber(s.count)} employees
                </p>
              </div>
              <p className="text-lg font-bold tabular-nums">
                {formatPay(s.avgPay)}
              </p>
            </div>
          ))}
          {insights.stemPay.length >= 2 && (
            <div className="mt-3 rounded-md bg-muted/50 px-3 py-2 text-center text-sm">
              STEM employees earn{" "}
              <span className="font-semibold text-emerald-600">
                {Math.round(
                  ((insights.stemPay[0].avgPay - insights.stemPay[insights.stemPay.length - 1].avgPay) /
                    insights.stemPay[insights.stemPay.length - 1].avgPay) *
                    100
                )}
                % more
              </span>{" "}
              than non-STEM
            </div>
          )}
        </div>

        <div className="rounded-lg border bg-card p-6">
          <h2 className="mb-4 text-lg font-semibold">Supervisory Pay Gap</h2>
          {insights.supervisorPay.map((s) => (
            <div key={s.category} className="mb-3 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">{s.category}</p>
                <p className="text-xs text-muted-foreground">
                  {formatNumber(s.count)} employees
                </p>
              </div>
              <p className="text-lg font-bold tabular-nums">
                {formatPay(s.avgPay)}
              </p>
            </div>
          ))}
          {insights.supervisorPay.length >= 2 && (
            <div className="mt-3 rounded-md bg-muted/50 px-3 py-2 text-center text-sm">
              Supervisors earn{" "}
              <span className="font-semibold text-emerald-600">
                {Math.round(
                  ((insights.supervisorPay[0].avgPay - insights.supervisorPay[1].avgPay) /
                    insights.supervisorPay[1].avgPay) *
                    100
                )}
                % more
              </span>{" "}
              than non-supervisory
            </div>
          )}
        </div>
      </div>

      {/* Net Change Callout */}
      <div className="mb-10 rounded-lg border bg-card p-6">
        <div className="grid gap-6 sm:grid-cols-3">
          <div className="text-center">
            <div className="mx-auto mb-2 w-fit rounded-md bg-green-500/10 p-2">
              <UserPlus className="h-5 w-5 text-green-600" />
            </div>
            <p className="text-2xl font-bold">
              {formatNumber(stats.total_accessions)}
            </p>
            <p className="text-sm text-muted-foreground">New Hires</p>
          </div>
          <div className="text-center">
            <div className="mx-auto mb-2 w-fit rounded-md bg-orange-500/10 p-2">
              <UserMinus className="h-5 w-5 text-orange-600" />
            </div>
            <p className="text-2xl font-bold">
              {formatNumber(stats.total_separations)}
            </p>
            <p className="text-sm text-muted-foreground">Separations</p>
          </div>
          <div className="text-center">
            <div className="mx-auto mb-2 w-fit rounded-md bg-red-500/10 p-2">
              <TrendingDown className="h-5 w-5 text-red-600" />
            </div>
            <p className={`text-2xl font-bold ${netChange >= 0 ? "text-green-600" : "text-red-600"}`}>
              {netChange >= 0 ? "+" : ""}
              {formatNumber(netChange)}
            </p>
            <p className="text-sm text-muted-foreground">Net Change</p>
          </div>
        </div>
      </div>

      {/* CTA Buttons */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Button asChild size="lg" className="w-full gap-2">
          <Link href="/employment">
            <Briefcase className="h-4 w-4" />
            Browse Employment
            <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
        <Button asChild variant="outline" size="lg" className="w-full gap-2">
          <Link href="/accessions">
            <UserPlus className="h-4 w-4" />
            Browse Accessions
            <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
        <Button asChild variant="outline" size="lg" className="w-full gap-2">
          <Link href="/separations">
            <UserMinus className="h-4 w-4" />
            Browse Separations
            <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
      </div>

      <div className="mt-10 text-center">
        <p className="text-xs text-muted-foreground">
          Source: U.S. Office of Personnel Management &middot; FedScope Data
        </p>
      </div>
    </div>
  );
}
