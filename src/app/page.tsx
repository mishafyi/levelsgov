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
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getStats, getHomepageInsights } from "@/lib/filters";
import { HorizontalBarChart, VerticalBarChart } from "@/components/home-charts";

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

export default async function HomePage() {
  const [stats, insights] = await Promise.all([
    getStats(),
    getHomepageInsights(),
  ]);
  const snapshotLabel = formatSnapshotDate(stats.latest_snapshot);
  const netChange = stats.total_accessions - stats.total_separations;

  const stateData = insights.payByState.map((s) => ({
    label: s.state
      .replace(/^DISTRICT OF COLUMBIA$/, "Washington D.C.")
      .replace(/^([A-Z])([A-Z]+)$/g, (_, f, r) => f + r.toLowerCase())
      .replace(/\b([A-Z])([A-Z]+)\b/g, (_, f: string, r: string) => f + r.toLowerCase()),
    value: s.avgPay,
    headcount: s.headcount,
  }));

  const agencyData = insights.topAgencies.map((a) => ({
    label: a.agency
      .replace(/^DEPARTMENT OF /, "Dept. ")
      .replace(/^SECURITIES AND EXCHANGE COMMISSION$/, "SEC")
      .replace(/^FEDERAL RESERVE SYSTEM$/, "Federal Reserve")
      .replace(/^FEDERAL DEPOSIT INSURANCE CORPORATION$/, "FDIC")
      .replace(/^FEDERAL COMMUNICATIONS COMMISSION$/, "FCC")
      .replace(/^NATIONAL SCIENCE FOUNDATION$/, "NSF")
      .replace(/^NUCLEAR REGULATORY COMMISSION$/, "NRC")
      .replace(/^NATIONAL LABOR RELATIONS BOARD$/, "NLRB")
      .replace(/^NAT AERONAUTICS AND SPACE ADMINISTRATION$/, "NASA"),
    value: a.avgPay,
  }));

  const occData = insights.topOccupations.map((o) => ({
    label: o.occupation
      .replace(/^([A-Z])([A-Z]+)/g, (_, f, r) => f + r.toLowerCase())
      .replace(/\b([A-Z])([A-Z]+)\b/g, (_, f: string, r: string) => f + r.toLowerCase()),
    value: o.avgPay,
  }));

  const tenureData = insights.payByTenure.map((t) => ({
    label: t.tenure.replace(" years", "yr"),
    value: t.avgPay,
    count: t.count,
  }));

  const eduData = insights.payByEducation
    .filter((e) => e.education !== "INVALID")
    .slice(0, 6)
    .map((e) => ({
      label: e.education
        .split(" - ")[0]
        .replace(/TERMINAL OCCUPATIONAL PROGRAM/, "Vocational")
        .replace(/^FIRST PROFESSIONAL$/, "1st Professional")
        .replace(/^POST-DOCTORATE$/, "Post-Doc")
        .replace(/^POST-FIRST PROFESSIONAL$/, "Post-1st Prof")
        .replace(/^DOCTORATE DEGREE$/, "Doctorate")
        .replace(/^SIXTH-YEAR DEGREE$/, "6th Year")
        .replace(/^POST-SIXTH YEAR$/, "Post-6th Year")
        .replace(/^POST-MASTER'S$/, "Post-Master's"),
      value: e.avgPay,
    }));

  const stateConfig = { value: { label: "Avg Pay", color: "var(--chart-1)" } };
  const agencyConfig = { value: { label: "Avg Pay", color: "var(--chart-2)" } };
  const occConfig = { value: { label: "Avg Pay", color: "var(--chart-3)" } };
  const tenureConfig = { value: { label: "Avg Pay", color: "var(--chart-4)" } };
  const eduConfig = { value: { label: "Avg Pay", color: "var(--chart-5)" } };

  return (
    <div className="mx-auto max-w-6xl px-3 py-6 sm:px-6 sm:py-10">
      {/* Hero */}
      <div className="mb-6 text-center sm:mb-10">
        <h1 className="text-3xl font-bold tracking-tight sm:text-5xl">
          LevelsGov
        </h1>
        <p className="mx-auto mt-2 max-w-2xl text-sm text-muted-foreground sm:mt-3 sm:text-lg">
          Federal workforce compensation data, transparent and searchable.
          Powered by OPM FedScope ({snapshotLabel}).
        </p>
      </div>

      {/* Key Stats */}
      <div className="mb-6 grid grid-cols-2 gap-2 sm:mb-10 sm:gap-3 lg:grid-cols-5">
        {[
          { icon: Users, label: "Total Employees", value: formatNumber(stats.total_employment), iconClass: "text-primary", bgClass: "bg-primary/10" },
          { icon: DollarSign, label: "Median Pay", value: formatPay(stats.median_pay), iconClass: "text-emerald-600", bgClass: "bg-emerald-500/10" },
          { icon: Building2, label: "Agencies", value: formatNumber(stats.agencies_count), iconClass: "text-blue-600", bgClass: "bg-blue-500/10" },
          { icon: UserPlus, label: "New Hires", value: formatNumber(stats.total_accessions), iconClass: "text-green-600", bgClass: "bg-green-500/10" },
          { icon: TrendingDown, label: "Net Change", value: `${netChange >= 0 ? "+" : ""}${formatNumber(netChange)}`, iconClass: "text-red-600", bgClass: "bg-red-500/10", valueClass: netChange >= 0 ? "text-green-600" : "text-red-600" },
        ].map((stat, i) => (
          <Card key={stat.label} className={`py-3 sm:py-4 ${i === 4 ? "col-span-2 lg:col-span-1" : ""}`}>
            <CardContent className="pb-0">
              <div className="flex items-center gap-2">
                <div className={`rounded-md p-1 sm:p-1.5 ${stat.bgClass}`}>
                  <stat.icon className={`h-3.5 w-3.5 sm:h-4 sm:w-4 ${stat.iconClass}`} />
                </div>
                <p className="text-[11px] text-muted-foreground sm:text-xs">{stat.label}</p>
              </div>
              <p className={`mt-1.5 text-xl font-bold sm:mt-2 sm:text-2xl ${stat.valueClass ?? ""}`}>
                {stat.value}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Pay by State */}
      <Card className="mb-6 sm:mb-10">
        <CardHeader className="px-4 sm:px-6">
          <CardTitle className="text-base sm:text-lg">Highest Paying States</CardTitle>
          <CardDescription className="text-xs sm:text-sm">
            Average federal employee compensation by duty station state
          </CardDescription>
        </CardHeader>
        <CardContent className="px-2 sm:px-6">
          <HorizontalBarChart
            data={stateData}
            config={stateConfig}
            className="h-[420px] w-full sm:h-[520px]"
          />
        </CardContent>
      </Card>

      {/* Two-column: Agencies + Occupations */}
      <div className="mb-6 grid gap-4 sm:mb-10 sm:gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="px-4 sm:px-6">
            <CardTitle className="text-base sm:text-lg">Top Paying Agencies</CardTitle>
            <CardDescription className="text-xs sm:text-sm">
              Agencies with 1,000+ employees
            </CardDescription>
          </CardHeader>
          <CardContent className="px-2 sm:px-6">
            <HorizontalBarChart
              data={agencyData}
              config={agencyConfig}
              className="h-[320px] w-full sm:h-[380px]"
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="px-4 sm:px-6">
            <CardTitle className="text-base sm:text-lg">Top Paying Occupations</CardTitle>
            <CardDescription className="text-xs sm:text-sm">
              Occupations with 500+ employees
            </CardDescription>
          </CardHeader>
          <CardContent className="px-2 sm:px-6">
            <HorizontalBarChart
              data={occData}
              config={occConfig}
              className="h-[320px] w-full sm:h-[380px]"
            />
          </CardContent>
        </Card>
      </div>

      {/* Two-column: Tenure + Education */}
      <div className="mb-6 grid gap-4 sm:mb-10 sm:gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="px-4 sm:px-6">
            <CardTitle className="text-base sm:text-lg">Pay by Tenure</CardTitle>
            <CardDescription className="text-xs sm:text-sm">
              Average pay by years of federal service
            </CardDescription>
          </CardHeader>
          <CardContent className="px-2 sm:px-6">
            <VerticalBarChart
              data={tenureData}
              config={tenureConfig}
            />
          </CardContent>
          {insights.payByTenure.length >= 2 && (
            <CardFooter>
              <p className="mx-auto text-sm text-muted-foreground">
                30+ year veterans earn{" "}
                <span className="font-semibold text-emerald-600">
                  {Math.round(
                    ((insights.payByTenure[insights.payByTenure.length - 1].avgPay -
                      insights.payByTenure[0].avgPay) /
                      insights.payByTenure[0].avgPay) *
                      100
                  )}
                  % more
                </span>{" "}
                than new hires
              </p>
            </CardFooter>
          )}
        </Card>

        <Card>
          <CardHeader className="px-4 sm:px-6">
            <CardTitle className="text-base sm:text-lg">Pay by Education</CardTitle>
            <CardDescription className="text-xs sm:text-sm">
              Average pay by highest education attained
            </CardDescription>
          </CardHeader>
          <CardContent className="px-2 sm:px-6">
            <VerticalBarChart
              data={eduData}
              config={eduConfig}
            />
          </CardContent>
        </Card>
      </div>

      {/* Insight Cards: STEM + Supervisory */}
      <div className="mb-6 grid gap-4 sm:mb-10 sm:gap-6 sm:grid-cols-2">
        <Card>
          <CardHeader className="px-4 sm:px-6">
            <CardTitle className="text-base sm:text-lg">STEM Premium</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {insights.stemPay.map((s) => (
              <div key={s.category} className="flex items-center justify-between">
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
          </CardContent>
          {insights.stemPay.length >= 2 && (
            <CardFooter>
              <p className="mx-auto text-sm text-muted-foreground">
                STEM employees earn{" "}
                <span className="font-semibold text-emerald-600">
                  {Math.round(
                    ((insights.stemPay[0].avgPay -
                      insights.stemPay[insights.stemPay.length - 1].avgPay) /
                      insights.stemPay[insights.stemPay.length - 1].avgPay) *
                      100
                  )}
                  % more
                </span>{" "}
                than non-STEM
              </p>
            </CardFooter>
          )}
        </Card>

        <Card>
          <CardHeader className="px-4 sm:px-6">
            <CardTitle className="text-base sm:text-lg">Supervisory Pay Gap</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {insights.supervisorPay.map((s) => (
              <div key={s.category} className="flex items-center justify-between">
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
          </CardContent>
          {insights.supervisorPay.length >= 2 && (
            <CardFooter>
              <p className="mx-auto text-sm text-muted-foreground">
                Supervisors earn{" "}
                <span className="font-semibold text-emerald-600">
                  {Math.round(
                    ((insights.supervisorPay[0].avgPay -
                      insights.supervisorPay[1].avgPay) /
                      insights.supervisorPay[1].avgPay) *
                      100
                  )}
                  % more
                </span>{" "}
                than non-supervisory
              </p>
            </CardFooter>
          )}
        </Card>
      </div>

      {/* Net Change Callout */}
      <Card className="mb-6 sm:mb-10">
        <CardContent>
          <div className="grid grid-cols-3 gap-3 sm:gap-6">
            <div className="text-center">
              <div className="mx-auto mb-1.5 w-fit rounded-md bg-green-500/10 p-1.5 sm:mb-2 sm:p-2">
                <UserPlus className="h-4 w-4 text-green-600 sm:h-5 sm:w-5" />
              </div>
              <p className="text-lg font-bold sm:text-2xl">
                {formatNumber(stats.total_accessions)}
              </p>
              <p className="text-xs text-muted-foreground sm:text-sm">New Hires</p>
            </div>
            <div className="text-center">
              <div className="mx-auto mb-1.5 w-fit rounded-md bg-orange-500/10 p-1.5 sm:mb-2 sm:p-2">
                <UserMinus className="h-4 w-4 text-orange-600 sm:h-5 sm:w-5" />
              </div>
              <p className="text-lg font-bold sm:text-2xl">
                {formatNumber(stats.total_separations)}
              </p>
              <p className="text-xs text-muted-foreground sm:text-sm">Departures</p>
            </div>
            <div className="text-center">
              <div className="mx-auto mb-1.5 w-fit rounded-md bg-red-500/10 p-1.5 sm:mb-2 sm:p-2">
                <TrendingDown className="h-4 w-4 text-red-600 sm:h-5 sm:w-5" />
              </div>
              <p
                className={`text-lg font-bold sm:text-2xl ${netChange >= 0 ? "text-green-600" : "text-red-600"}`}
              >
                {netChange >= 0 ? "+" : ""}
                {formatNumber(netChange)}
              </p>
              <p className="text-xs text-muted-foreground sm:text-sm">Net Change</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* CTA Buttons */}
      <div className="grid gap-2 sm:gap-4 sm:grid-cols-3">
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
            Browse New Hires
            <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
        <Button asChild variant="outline" size="lg" className="w-full gap-2">
          <Link href="/separations">
            <UserMinus className="h-4 w-4" />
            Browse Departures
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
