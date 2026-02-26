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
import { HorizontalBarChart, NetChangeBarChart, TreemapChart, AreaLineChart } from "@/components/home-charts";
import { USPayMap, USStateImpactMap } from "@/components/us-pay-map";

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

  const stateData = insights.payByState;

  const agencyLabelMap: Record<string, string> = {
    "NATIONAL CREDIT UNION ADMINISTRATION": "NCUA",
    "FARM CREDIT ADMINISTRATION": "Farm Credit Admin.",
    "FARM CREDIT SYSTEM INSURANCE CORPORATION": "Farm Credit Ins.",
    "COMMODITY FUTURES TRADING COMMISSION": "CFTC",
    "SECURITIES AND EXCHANGE COMMISSION": "SEC",
    "FEDERAL HOUSING FINANCE AGENCY": "FHFA",
    "FEDERAL RESERVE SYSTEM": "Federal Reserve",
    "ARCTIC RESEARCH COMMISSION": "Arctic Research",
    "DEFENSE NUCLEAR FACILITIES SAFETY BOARD": "DNFSB",
    "FEDERAL DEPOSIT INSURANCE CORPORATION": "FDIC",
    "FEDERAL COMMUNICATIONS COMMISSION": "FCC",
    "NATIONAL SCIENCE FOUNDATION": "NSF",
    "NUCLEAR REGULATORY COMMISSION": "NRC",
    "NATIONAL LABOR RELATIONS BOARD": "NLRB",
    "NAT AERONAUTICS AND SPACE ADMINISTRATION": "NASA",
    "GENERAL SERVICES ADMINISTRATION": "GSA",
    "ENVIRONMENTAL PROTECTION AGENCY": "EPA",
    "OFFICE OF PERSONNEL MANAGEMENT": "OPM",
    "SOCIAL SECURITY ADMINISTRATION": "SSA",
    "SMALL BUSINESS ADMINISTRATION": "SBA",
    "AGENCY FOR INTERNATIONAL DEVELOPMENT": "USAID",
    "CONSUMER FINANCIAL PROTECTION BUREAU": "CFPB",
  };

  const agencyData = insights.topAgencies.map((a) => ({
    label: agencyLabelMap[a.agency]
      ?? a.agency.replace(/^DEPARTMENT OF (THE )?/, "Dept. "),
    value: a.avgPay,
  }));

  const occLabelMap: Record<string, string> = {
    "SECURITIES COMPLIANCE EXAMINING": "Securities Compliance",
    "GENERAL MATHEMATICS AND STATISTICS": "Math & Statistics",
    "ADMINISTRATIVE LAW JUDGE": "Admin. Law Judge",
    "TECHNICAL SYSTEMS PROGRAM MANAGER": "Tech. Systems PM",
    "PATENT ADMINISTRATION": "Patent Admin.",
    "PATENT CLASSIFYING": "Patent Classifying",
  };

  const occData = insights.topOccupations.map((o) => ({
    label: occLabelMap[o.occupation]
      ?? o.occupation
        .replace(/^([A-Z])([A-Z]+)/g, (_, f, r) => f + r.toLowerCase())
        .replace(/\b([A-Z])([A-Z]+)\b/g, (_, f: string, r: string) => f + r.toLowerCase()),
    value: o.avgPay,
  }));

  const tenureData = insights.payByTenure.map((t) => ({
    label: t.tenure.replace(" years", "yr"),
    value: t.avgPay,
    count: t.count,
  }));

  const eduLabelMap: Record<string, string> = {
    "NO FORMAL EDUCATION OR SOME ELEMENTARY SCHOOL - DID NOT COMPLETE": "No Formal Ed.",
    "ELEMENTARY SCHOOL COMPLETED - NO HIGH SCHOOL": "Elementary",
    "SOME HIGH SCHOOL - DID NOT COMPLETE": "Some High School",
    "HIGH SCHOOL GRADUATE OR CERTIFICATE OF EQUIVALENCY": "High School",
    "TERMINAL OCCUPATIONAL PROGRAM - DID NOT COMPLETE": "Vocational (Partial)",
    "TERMINAL OCCUPATIONAL PROGRAM - CERTIFICATE OF COMPLETION, DIPLOMA OR EQUIVALENT": "Vocational",
    "SOME COLLEGE - LESS THAN ONE YEAR": "Some College (<1yr)",
    "ONE YEAR COLLEGE": "1 Year College",
    "TWO YEARS COLLEGE": "2 Years College",
    "THREE YEARS COLLEGE": "3 Years College",
    "FOUR YEARS COLLEGE": "4 Years College",
    "ASSOCIATE DEGREE": "Associate's",
    "BACHELOR'S DEGREE": "Bachelor's",
    "POST-BACHELOR'S": "Post-Bachelor's",
    "MASTER'S DEGREE": "Master's",
    "POST-MASTER'S": "Post-Master's",
    "SIXTH-YEAR DEGREE": "6th-Year Degree",
    "POST-SIXTH YEAR": "Post-6th Year",
    "FIRST PROFESSIONAL": "Professional (JD/MD)",
    "POST-FIRST PROFESSIONAL": "Post-Professional",
    "DOCTORATE DEGREE": "Doctorate",
    "POST-DOCTORATE": "Post-Doctorate",
    "NO DATA REPORTED": "Not Reported",
  };

  const eduData = insights.payByEducation
    .filter((e) => e.education !== "INVALID" && e.education !== "NO DATA REPORTED")
    .map((e) => ({
      label: eduLabelMap[e.education] ?? e.education,
      value: e.avgPay,
    }));

  const separationLabelMap: Record<string, string> = {
    "RETIREMENT - VOLUNTARY": "Voluntary Retirement",
    "QUIT": "Quit",
    "RETIREMENT - EARLY OUT": "Early Retirement",
    "TERMINATION (EXPIRED APPT/OTHER)": "Termination",
    "OTHER SEPARATION": "Other",
    "TRANSFER OUT - INDIVIDUAL TRANSFER": "Transfer Out",
    "TRANSFER OUT - MASS TRANSFER": "Mass Transfer Out",
    "RETIREMENT - OTHER": "Other Retirement",
    "REDUCTION IN FORCE (RIF)": "RIF",
    "RETIREMENT - DISABILITY": "Disability Retirement",
    "RETIREMENT - INVOLUNTARY": "Involuntary Retirement",
    "DEATH": "Death",
  };

  const separationData = insights.separationReasons.map((r) => ({
    label: separationLabelMap[r.category] ?? r.category
      .replace(/^([A-Z])([A-Z]+)/g, (_, f, rest) => f + rest.toLowerCase())
      .replace(/\b([A-Z])([A-Z]+)\b/g, (_, f: string, rest: string) => f + rest.toLowerCase()),
    value: r.count,
  }));

  const agencyChangeData = insights.agencyNetChanges.map((a) => ({
    label: a.agency
      .replace(/^DEPARTMENT OF /, "Dept. ")
      .replace(/^SECURITIES AND EXCHANGE COMMISSION$/, "SEC")
      .replace(/^FEDERAL RESERVE SYSTEM$/, "Federal Reserve")
      .replace(/^FEDERAL DEPOSIT INSURANCE CORPORATION$/, "FDIC")
      .replace(/^FEDERAL COMMUNICATIONS COMMISSION$/, "FCC")
      .replace(/^NATIONAL SCIENCE FOUNDATION$/, "NSF")
      .replace(/^NUCLEAR REGULATORY COMMISSION$/, "NRC")
      .replace(/^NATIONAL LABOR RELATIONS BOARD$/, "NLRB")
      .replace(/^NAT AERONAUTICS AND SPACE ADMINISTRATION$/, "NASA")
      .replace(/^GENERAL SERVICES ADMINISTRATION$/, "GSA")
      .replace(/^OFFICE OF PERSONNEL MANAGEMENT$/, "OPM")
      .replace(/^SOCIAL SECURITY ADMINISTRATION$/, "SSA")
      .replace(/^SMALL BUSINESS ADMINISTRATION$/, "SBA")
      .replace(/^ENVIRONMENTAL PROTECTION AGENCY$/, "EPA")
      .replace(/^AGENCY FOR INTERNATIONAL DEVELOPMENT$/, "USAID")
      .replace(/^CONSUMER FINANCIAL PROTECTION BUREAU$/, "CFPB"),
    value: a.netChange,
    hires: a.hires,
    departures: a.departures,
  }));

  const stemDrainData = insights.stemBrainDrain.map((s) => ({
    category: s.category
      .replace(/^MATHEMATICS OCCUPATIONS$/, "Mathematics")
      .replace(/^TECHNOLOGY OCCUPATIONS$/, "Technology")
      .replace(/^ENGINEERING OCCUPATIONS$/, "Engineering")
      .replace(/^SCIENCE OCCUPATIONS$/, "Science")
      .replace(/^HEALTH OCCUPATIONS$/, "Health")
      .replace(/^ALL OTHER OCCUPATIONS$/, "All Other"),
    departures: s.departures,
    hires: s.hires,
    netLoss: s.netLoss,
    replacementPct: s.replacementPct,
    avgDepartingPay: s.avgDepartingPay,
  }));

  const stateImpactData = insights.stateReplacementRates.map((s) => ({
    label: s.state
      .replace(/^DISTRICT OF COLUMBIA$/, "Washington D.C.")
      .replace(/^([A-Z])([A-Z]+)$/g, (_, f, r) => f + r.toLowerCase())
      .replace(/\b([A-Z])([A-Z]+)\b/g, (_, f: string, r: string) => f + r.toLowerCase()),
    abbreviation: s.abbreviation,
    departures: s.departures,
    hires: s.hires,
    netLoss: s.netLoss,
    replacementPct: s.replacementPct,
    value: s.netLoss,
  }));

  const stemPositionData = insights.stemPositionLosses.map((p) => {
    const typeLabel = p.stemType
      .replace(/ OCCUPATIONS$/, "")
      .replace(/^MATHEMATICS$/, "Math")
      .replace(/^TECHNOLOGY$/, "Tech")
      .replace(/^ENGINEERING$/, "Eng.")
      .replace(/^SCIENCE$/, "Sci.");
    return {
      label: p.position
        .replace(/^INFORMATION TECHNOLOGY MANAGEMENT$/, "IT Management")
        .replace(/^GENERAL ENGINEERING$/, "General Engineering")
        .replace(/^GENERAL NATURAL RESOURCES MANAGEMENT AND BIOLOGICAL SCIENCES$/, "Natural Resources & Bio")
        .replace(/^SOCIAL SCIENCE$/, "Social Science")
        .replace(/^CIVIL ENGINEERING$/, "Civil Engineering")
        .replace(/^ELECTRONICS ENGINEERING$/, "Electronics Eng.")
        .replace(/^GENERAL PHYSICAL SCIENCE$/, "Physical Science")
        .replace(/^COMPUTER SCIENCE$/, "Computer Science")
        .replace(/^MECHANICAL ENGINEERING$/, "Mechanical Eng.")
        .replace(/^INTELLIGENCE$/, "Intelligence")
        .replace(/^FOREIGN AFFAIRS$/, "Foreign Affairs")
        .replace(/^ENVIRONMENTAL PROTECTION SPECIALIST$/, "Environmental Protection")
        .replace(/^ECONOMIST$/, "Economist")
        .replace(/^AEROSPACE ENGINEERING$/, "Aerospace Eng.")
        .replace(/^STATISTICS$/, "Statistics"),
      value: p.netLoss,
      replacementPct: p.replacementPct,
      typeLabel,
    };
  });

  const stemAgencyAll = insights.stemAgencyLosses.map((a) => ({
    label: agencyLabelMap[a.agency]
      ?? a.agency.replace(/^DEPARTMENT OF (THE )?/, "Dept. "),
    value: a.netLoss,
    sector: a.sector,
    replacementPct: a.replacementPct,
    departures: a.departures,
    hires: a.hires,
  }));

  const defenseTotals = stemAgencyAll.filter((a) => a.sector === "defense");
  const civilianTotals = stemAgencyAll.filter((a) => a.sector === "civilian");
  const stemSectorData = [
    {
      label: "Defense & Intel",
      value: defenseTotals.reduce((s, a) => s + a.value, 0),
      departures: defenseTotals.reduce((s, a) => s + a.departures, 0),
      hires: defenseTotals.reduce((s, a) => s + a.hires, 0),
    },
    {
      label: "Civilian Agencies",
      value: civilianTotals.reduce((s, a) => s + a.value, 0),
      departures: civilianTotals.reduce((s, a) => s + a.departures, 0),
      hires: civilianTotals.reduce((s, a) => s + a.hires, 0),
    },
  ];

  const stemPositionConfig = { value: { label: "Net Loss", color: "var(--chart-3)" } };
  const stemSectorConfig = { value: { label: "Net STEM Loss", color: "var(--chart-1)" } };

  const netChangeConfig = { value: { label: "Net Change", color: "var(--chart-2)" } };

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
          <CardTitle className="text-base sm:text-lg">Federal Pay by State</CardTitle>
          <CardDescription className="text-xs sm:text-sm">
            Average federal employee compensation by duty station state
          </CardDescription>
        </CardHeader>
        <CardContent className="px-2 sm:px-6">
          <USPayMap data={stateData} />
        </CardContent>
      </Card>

      {/* Two-column: Agencies + Occupations */}
      <div className="mb-6 grid gap-4 sm:mb-10 sm:gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="px-4 sm:px-6">
            <CardTitle className="text-base sm:text-lg">Top Paying Agencies</CardTitle>
            <CardDescription className="text-xs sm:text-sm">
              Top 10 agencies by average compensation
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
              Top 10 occupations by average compensation
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
      <div className="mb-6 grid items-start gap-4 sm:mb-10 sm:gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="px-4 sm:px-6">
            <CardTitle className="text-base sm:text-lg">Pay by Tenure</CardTitle>
            <CardDescription className="text-xs sm:text-sm">
              Average pay by years of federal service
            </CardDescription>
          </CardHeader>
          <CardContent className="px-2 sm:px-6">
            <AreaLineChart
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
            <HorizontalBarChart
              data={eduData}
              config={eduConfig}
              className="h-[560px] w-full sm:h-[640px]"
            />
          </CardContent>
        </Card>
      </div>

      {/* Insight Cards: STEM + Supervisory */}
      <div className="mb-6 grid gap-4 sm:mb-10 sm:gap-6 sm:grid-cols-2">
        <Card>
          <CardHeader className="px-4 sm:px-6">
            <CardTitle className="text-base sm:text-lg">Pay by Field</CardTitle>
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
                Health &amp; STEM roles earn{" "}
                <span className="font-semibold text-emerald-600">
                  {Math.round(
                    ((insights.stemPay[0].avgPay -
                      insights.stemPay[insights.stemPay.length - 1].avgPay) /
                      insights.stemPay[insights.stemPay.length - 1].avgPay) *
                      100
                  )}
                  % more
                </span>{" "}
                than other fields
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

      {/* Workforce Trends */}
      <div className="mb-6 grid gap-4 sm:mb-10 sm:gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="px-4 sm:px-6">
            <CardTitle className="text-base sm:text-lg">Why People Leave</CardTitle>
            <CardDescription className="text-xs sm:text-sm">
              Separation reasons across the federal workforce
            </CardDescription>
          </CardHeader>
          <CardContent className="px-2 sm:px-6">
            <TreemapChart data={separationData} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="px-4 sm:px-6">
            <CardTitle className="text-base sm:text-lg">Biggest Agency Changes</CardTitle>
            <CardDescription className="text-xs sm:text-sm">
              Agencies with the largest net workforce decline
            </CardDescription>
          </CardHeader>
          <CardContent className="px-2 sm:px-6">
            <NetChangeBarChart
              data={agencyChangeData}
              config={netChangeConfig}
              className="h-[320px] w-full sm:h-[380px]"
            />
          </CardContent>
        </Card>
      </div>

      {/* STEM Brain Drain + State Impact */}
      <div className="mb-6 grid gap-4 sm:mb-10 sm:gap-6 lg:grid-cols-2">
        {/* STEM Brain Drain */}
        <Card>
          <CardHeader className="px-4 sm:px-6">
            <CardTitle className="text-base sm:text-lg">STEM Brain Drain</CardTitle>
            <CardDescription className="text-xs sm:text-sm">
              2025 replacement rates by field — how many hires per departure
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5 px-4 sm:px-6">
            {stemDrainData.map((s) => (
              <div key={s.category}>
                <div className="mb-1.5 flex items-center justify-between">
                  <p className="text-sm font-medium">{s.category}</p>
                  <p className="text-sm font-bold tabular-nums">
                    {s.replacementPct}% replaced
                  </p>
                </div>
                <div className="mb-1.5 h-3 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${Math.min(s.replacementPct, 100)}%`,
                      backgroundColor: s.replacementPct < 20 ? "var(--chart-1)" : s.replacementPct < 40 ? "var(--chart-4)" : "var(--chart-2)",
                    }}
                  />
                </div>
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{formatNumber(s.departures)} departed</span>
                  <span>{formatNumber(s.hires)} hired</span>
                </div>
              </div>
            ))}
          </CardContent>
          <CardFooter>
            <p className="mx-auto text-sm text-muted-foreground">
              Math &amp; Tech replaced at{" "}
              <span className="font-semibold text-red-600">
                ~{Math.round(((stemDrainData.find((s) => s.category === "Mathematics")?.replacementPct ?? 0) + (stemDrainData.find((s) => s.category === "Technology")?.replacementPct ?? 0)) / 2)}%
              </span>
              {" "}— while Health is at{" "}
              <span className="font-semibold text-emerald-600">
                {stemDrainData.find((s) => s.category === "Health")?.replacementPct ?? 0}%
              </span>
            </p>
          </CardFooter>
        </Card>

        {/* State Impact */}
        <Card>
          <CardHeader className="px-4 sm:px-6">
            <CardTitle className="text-base sm:text-lg">Hardest Hit States</CardTitle>
            <CardDescription className="text-xs sm:text-sm">
              Lowest replacement rates — departures vs. new hires in 2025
            </CardDescription>
          </CardHeader>
          <CardContent className="px-2 sm:px-6">
            <USStateImpactMap data={stateImpactData} />
          </CardContent>
          <CardFooter>
            <p className="mx-auto text-sm text-muted-foreground">
              Maryland:{" "}
              <span className="font-semibold text-red-600">
                {stateImpactData.find((s) => s.abbreviation === "MD")?.replacementPct ?? 0}% replacement
              </span>
              {" "}— {formatNumber(stateImpactData.find((s) => s.abbreviation === "MD")?.departures ?? 0)} departed, only {formatNumber(stateImpactData.find((s) => s.abbreviation === "MD")?.hires ?? 0)} hired
            </p>
          </CardFooter>
        </Card>
      </div>

      {/* STEM Deep Dive: Positions + Agencies */}
      <div className="mb-6 grid gap-4 sm:mb-10 sm:gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="px-4 sm:px-6">
            <CardTitle className="text-base sm:text-lg">STEM Positions Lost</CardTitle>
            <CardDescription className="text-xs sm:text-sm">
              Top STEM roles by net workforce loss in 2025
            </CardDescription>
          </CardHeader>
          <CardContent className="px-2 sm:px-6">
            <HorizontalBarChart
              data={stemPositionData}
              config={stemPositionConfig}
              valueFormat="number"
              className="h-[420px] w-full sm:h-[520px]"
            />
          </CardContent>
          <CardFooter>
            <p className="mx-auto text-sm text-muted-foreground">
              IT Management alone lost{" "}
              <span className="font-semibold text-red-600">
                {formatNumber(stemPositionData[0]?.value ?? 0)} net
              </span>
              {" "}— Economists at just {stemPositionData.find((s) => s.label === "Economist")?.replacementPct ?? 0}% replacement
            </p>
          </CardFooter>
        </Card>

        <Card>
          <CardHeader className="px-4 sm:px-6">
            <CardTitle className="text-base sm:text-lg">STEM Loss: Defense vs Civilian</CardTitle>
            <CardDescription className="text-xs sm:text-sm">
              Net STEM worker loss by sector in 2025
            </CardDescription>
          </CardHeader>
          <CardContent className="px-2 sm:px-6">
            <HorizontalBarChart
              data={stemSectorData}
              config={stemSectorConfig}
              valueFormat="number"
              className="h-[120px] w-full sm:h-[140px]"
            />
          </CardContent>
          <CardFooter>
            <p className="mx-auto text-sm text-muted-foreground">
              Defense: {formatNumber(stemSectorData[0].departures)} departed, {formatNumber(stemSectorData[0].hires)} hired ·
              Civilian: {formatNumber(stemSectorData[1].departures)} departed, {formatNumber(stemSectorData[1].hires)} hired
            </p>
          </CardFooter>
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
