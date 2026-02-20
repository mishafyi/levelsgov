import Link from "next/link";
import {
  ArrowRight,
  Briefcase,
  Building2,
  TrendingDown,
  TrendingUp,
  UserMinus,
  UserPlus,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { getStats } from "@/lib/filters";

function formatSnapshotDate(yyyymm: string): string {
  const year = yyyymm.slice(0, 4);
  const month = yyyymm.slice(4, 6);
  const date = new Date(Number(year), Number(month) - 1);
  return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

function formatNumber(n: number): string {
  return new Intl.NumberFormat("en-US").format(n);
}

export default async function HomePage() {
  const stats = await getStats();
  const snapshotLabel = formatSnapshotDate(stats.latest_snapshot);
  const netChange = stats.total_accessions - stats.total_separations;

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:py-16">
      {/* Hero */}
      <div className="mb-12 text-center">
        <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
          FedWork
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
          Browse and explore U.S. federal workforce data from the Office of
          Personnel Management. View employment records, new hires, and
          departures across all federal agencies.
        </p>
      </div>

      {/* Stats Grid */}
      <div className="mb-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border bg-card p-6">
          <div className="flex items-center gap-3">
            <div className="rounded-md bg-primary/10 p-2">
              <Users className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">
                Total Employees
              </p>
              <p className="text-2xl font-bold">
                {formatNumber(stats.total_employment)}
              </p>
            </div>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Snapshot: {snapshotLabel}
          </p>
        </div>

        <div className="rounded-lg border bg-card p-6">
          <div className="flex items-center gap-3">
            <div className="rounded-md bg-green-500/10 p-2">
              <UserPlus className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">
                New Hires ({snapshotLabel})
              </p>
              <p className="text-2xl font-bold">
                {formatNumber(stats.total_accessions)}
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-lg border bg-card p-6">
          <div className="flex items-center gap-3">
            <div className="rounded-md bg-orange-500/10 p-2">
              <UserMinus className="h-5 w-5 text-orange-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">
                Separations ({snapshotLabel})
              </p>
              <p className="text-2xl font-bold">
                {formatNumber(stats.total_separations)}
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-lg border bg-card p-6">
          <div className="flex items-center gap-3">
            <div className="rounded-md bg-blue-500/10 p-2">
              <Building2 className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Agencies</p>
              <p className="text-2xl font-bold">
                {formatNumber(stats.agencies_count)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Net Change Callout */}
      <div className="mb-12 rounded-lg border bg-card p-6 text-center">
        <div className="flex items-center justify-center gap-2">
          {netChange >= 0 ? (
            <TrendingUp className="h-5 w-5 text-green-600" />
          ) : (
            <TrendingDown className="h-5 w-5 text-red-600" />
          )}
          <span className="text-lg font-semibold">
            Net Change ({snapshotLabel})
          </span>
        </div>
        <p
          className={`mt-1 text-3xl font-bold ${
            netChange >= 0 ? "text-green-600" : "text-red-600"
          }`}
        >
          {netChange >= 0 ? "+" : ""}
          {formatNumber(netChange)}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          Accessions minus separations
        </p>
      </div>

      {/* Definitions */}
      <div className="mb-12 grid gap-6 sm:grid-cols-2">
        <div className="rounded-lg border bg-card p-6">
          <div className="mb-3 flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-green-600" />
            <h3 className="font-semibold">What are Accessions?</h3>
          </div>
          <p className="text-sm text-muted-foreground">
            Accessions are new entries into federal service, including new hires,
            transfers from other agencies, and reinstatements of former
            employees.
          </p>
        </div>
        <div className="rounded-lg border bg-card p-6">
          <div className="mb-3 flex items-center gap-2">
            <UserMinus className="h-5 w-5 text-orange-600" />
            <h3 className="font-semibold">What are Separations?</h3>
          </div>
          <p className="text-sm text-muted-foreground">
            Separations are departures from federal service, including
            retirements, resignations, terminations, and transfers to other
            agencies.
          </p>
        </div>
      </div>

      {/* CTA Buttons */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Button asChild size="lg" className="w-full gap-2">
          <Link href="/employment">
            <Briefcase className="h-4 w-4" />
            Browse Employment Records
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

      {/* Source attribution */}
      <div className="mt-12 text-center">
        <p className="text-xs text-muted-foreground">
          Data: U.S. Office of Personnel Management
        </p>
      </div>
    </div>
  );
}
