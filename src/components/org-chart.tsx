"use client";

import { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  ChevronDown,
  ChevronRight,
  Building2,
  Shield,
  Landmark,
  Search,
  Users,
  Crown,
  Scale,
  ScrollText,
} from "lucide-react";

/* ───── Types ───── */

export interface SubelementData {
  name: string;
  code: string;
  total: number;
}

export interface AgencyData {
  name: string;
  code: string;
  total: number;
  subelements: SubelementData[];
}

export interface CategoryData {
  key: string;
  label: string;
  total: number;
  agencies: AgencyData[];
}

export interface BranchData {
  key: string;
  label: string;
  total: number;
  subcategories: CategoryData[];
}

export interface OrgChartData {
  grandTotal: number;
  branches: BranchData[];
}

/* ───── Constants ───── */

const fmt = (n: number) => new Intl.NumberFormat("en-US").format(n);

const BRANCH_META: Record<
  string,
  { icon: typeof Building2; color: string; bg: string; border: string }
> = {
  executive: {
    icon: Building2,
    color: "#2563eb",
    bg: "rgba(37, 99, 235, 0.06)",
    border: "rgba(37, 99, 235, 0.2)",
  },
  legislative: {
    icon: ScrollText,
    color: "#d97706",
    bg: "rgba(217, 119, 6, 0.06)",
    border: "rgba(217, 119, 6, 0.2)",
  },
  judicial: {
    icon: Scale,
    color: "#dc2626",
    bg: "rgba(220, 38, 38, 0.06)",
    border: "rgba(220, 38, 38, 0.2)",
  },
};

const SUBCAT_COLORS: Record<string, { icon: typeof Building2; color: string }> = {
  cabinet: { icon: Building2, color: "#2563eb" },
  military: { icon: Shield, color: "#475569" },
  eop: { icon: Crown, color: "#9333ea" },
  independent: { icon: Landmark, color: "#059669" },
};

/* ───── Agency Card ───── */

function AgencyCard({
  agency,
  maxTotal,
  color,
}: {
  agency: AgencyData;
  maxTotal: number;
  color: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const pct = (agency.total / maxTotal) * 100;
  const hasExpandable =
    agency.subelements.length > 1 ||
    (agency.subelements.length === 1 &&
      agency.subelements[0].name !== agency.name);
  const maxSub = agency.subelements[0]?.total ?? 1;

  return (
    <div
      className={`border rounded-lg bg-card transition-shadow ${
        hasExpandable ? "cursor-pointer hover:shadow-md" : ""
      }`}
      onClick={() => hasExpandable && setExpanded(!expanded)}
    >
      <div className="flex items-center gap-2 p-2.5">
        <div
          className="w-0.5 self-stretch rounded-full shrink-0"
          style={{
            backgroundColor: color,
            opacity: 0.25 + (pct / 100) * 0.75,
          }}
        />
        <div className="flex-1 min-w-0">
          <p className="font-medium text-xs leading-tight truncate">
            {agency.name}
          </p>
          <p
            className="text-muted-foreground mt-0.5 tabular-nums"
            style={{ fontSize: 11 }}
          >
            {fmt(agency.total)}
          </p>
        </div>
        <Badge variant="outline" className="text-[9px] shrink-0 font-mono px-1.5 py-0">
          {agency.code}
        </Badge>
        {hasExpandable &&
          (expanded ? (
            <ChevronDown className="h-3 w-3 text-muted-foreground shrink-0" />
          ) : (
            <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />
          ))}
      </div>

      {/* Progress bar */}
      <div className="px-2.5 pb-2">
        <div
          className="rounded-full overflow-hidden"
          style={{ height: 3, backgroundColor: "var(--muted)" }}
        >
          <div
            className="h-full rounded-full"
            style={{
              width: `${pct}%`,
              backgroundColor: color,
              opacity: 0.5,
              transition: "width 300ms ease",
            }}
          />
        </div>
      </div>

      {/* Expandable subelements */}
      {hasExpandable && (
        <div
          style={{
            display: "grid",
            gridTemplateRows: expanded ? "1fr" : "0fr",
            transition: "grid-template-rows 200ms ease-out",
          }}
        >
          <div style={{ overflow: "hidden" }}>
            <div
              className="border-t px-2.5 pb-2.5 pt-1.5"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="space-y-1">
                {agency.subelements.map((sub) => {
                  const subPct = (sub.total / maxSub) * 100;
                  return (
                    <div key={sub.code} className="flex items-center gap-1.5">
                      <div className="flex-1 min-w-0">
                        <div
                          className="relative rounded overflow-hidden"
                          style={{
                            height: 20,
                            backgroundColor: "var(--muted)",
                          }}
                        >
                          <div
                            className="absolute inset-y-0 left-0 rounded"
                            style={{
                              width: `${subPct}%`,
                              backgroundColor: color,
                              opacity: 0.1,
                            }}
                          />
                          <span
                            className="absolute inset-0 flex items-center px-1.5 truncate"
                            style={{ fontSize: 10 }}
                          >
                            {sub.name}
                          </span>
                        </div>
                      </div>
                      <span
                        className="text-muted-foreground whitespace-nowrap tabular-nums"
                        style={{ fontSize: 10 }}
                      >
                        {fmt(sub.total)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ───── Sub-category Section (tree node within a branch) ───── */

function SubCategorySection({
  subcat,
  branchColor,
  isLast,
}: {
  subcat: CategoryData;
  branchColor: string;
  isLast: boolean;
}) {
  const [collapsed, setCollapsed] = useState(subcat.agencies.length > 8);
  const meta = SUBCAT_COLORS[subcat.key];
  const color = meta?.color ?? branchColor;
  const Icon = meta?.icon ?? Landmark;
  const maxTotal = subcat.agencies[0]?.total ?? 1;
  const visibleAgencies = collapsed
    ? subcat.agencies.slice(0, 5)
    : subcat.agencies;

  return (
    <div className="relative" style={{ paddingLeft: 20 }}>
      {/* Tree connector: vertical line + horizontal branch */}
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          bottom: isLast ? "auto" : 0,
          width: 1.5,
          height: isLast ? 16 : "100%",
          backgroundColor: branchColor,
          opacity: 0.2,
        }}
      />
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 16,
          width: 20,
          height: 1.5,
          backgroundColor: branchColor,
          opacity: 0.2,
        }}
      />

      {/* Sub-category header */}
      <div className="flex items-center gap-2 mb-2 pt-1.5">
        <Icon className="h-3.5 w-3.5 shrink-0" style={{ color }} />
        <span className="font-semibold text-xs">{subcat.label}</span>
        <span
          className="text-muted-foreground tabular-nums"
          style={{ fontSize: 11 }}
        >
          {fmt(subcat.total)}
        </span>
      </div>

      {/* Agency cards */}
      <div className="space-y-1.5 pb-4">
        {visibleAgencies.map((agency) => (
          <AgencyCard
            key={agency.code}
            agency={agency}
            maxTotal={maxTotal}
            color={color}
          />
        ))}
        {subcat.agencies.length > 5 && (
          <button
            className="w-full text-center text-xs text-muted-foreground hover:text-foreground py-1.5 transition-colors"
            onClick={() => setCollapsed(!collapsed)}
          >
            {collapsed
              ? `Show ${subcat.agencies.length - 5} more`
              : "Show less"}
          </button>
        )}
      </div>
    </div>
  );
}

/* ───── Branch Column ───── */

function BranchColumn({ branch }: { branch: BranchData }) {
  const meta = BRANCH_META[branch.key] ?? BRANCH_META.executive;
  const Icon = meta.icon;

  return (
    <div>
      {/* Branch header card */}
      <div
        className="rounded-lg p-4 border"
        style={{
          backgroundColor: meta.bg,
          borderColor: meta.border,
        }}
      >
        <div className="flex items-center gap-2 mb-1">
          <Icon className="h-4 w-4" style={{ color: meta.color }} />
          <h2 className="font-bold text-sm">{branch.label}</h2>
        </div>
        <p className="text-lg font-bold tabular-nums font-mono" style={{ color: meta.color }}>
          {fmt(branch.total)}
        </p>
        <p className="text-[11px] text-muted-foreground">
          {branch.subcategories.reduce((s, c) => s + c.agencies.length, 0)} agencies
        </p>
      </div>

      {/* Vertical connector from branch to sub-categories */}
      <div
        className="flex justify-start"
        style={{ paddingLeft: 20, height: 16 }}
      >
        <div
          style={{
            width: 1.5,
            height: "100%",
            backgroundColor: meta.color,
            opacity: 0.2,
          }}
        />
      </div>

      {/* Sub-categories with tree lines */}
      {branch.subcategories.length === 1 &&
      branch.subcategories[0].key === branch.key ? (
        /* Simple branch - show agencies directly */
        <div style={{ paddingLeft: 20 }}>
          <div className="space-y-1.5">
            {branch.subcategories[0].agencies.map((agency) => (
              <AgencyCard
                key={agency.code}
                agency={agency}
                maxTotal={branch.subcategories[0].agencies[0]?.total ?? 1}
                color={meta.color}
              />
            ))}
          </div>
        </div>
      ) : (
        /* Complex branch (Executive) - show sub-categories */
        branch.subcategories.map((subcat, i) => (
          <SubCategorySection
            key={subcat.key}
            subcat={subcat}
            branchColor={meta.color}
            isLast={i === branch.subcategories.length - 1}
          />
        ))
      )}
    </div>
  );
}

/* ───── Main Component ───── */

export function OrgChart({ data }: { data: OrgChartData }) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (!search.trim()) return data.branches;
    const q = search.toLowerCase();
    return data.branches
      .map((branch) => ({
        ...branch,
        subcategories: branch.subcategories
          .map((subcat) => ({
            ...subcat,
            agencies: subcat.agencies.filter(
              (a) =>
                a.name.toLowerCase().includes(q) ||
                a.code.toLowerCase().includes(q) ||
                a.subelements.some(
                  (s) =>
                    s.name.toLowerCase().includes(q) ||
                    s.code.toLowerCase().includes(q)
                )
            ),
          }))
          .filter((subcat) => subcat.agencies.length > 0),
        total: branch.total, // keep original total
      }))
      .filter((branch) => branch.subcategories.length > 0);
  }, [data.branches, search]);

  return (
    <div className="mx-auto px-4 sm:px-6 py-8" style={{ maxWidth: "80rem" }}>
      {/* Root node */}
      <div className="flex justify-center">
        <Card className="w-full text-center" style={{ maxWidth: 380 }}>
          <CardContent className="pt-6 pb-4">
            <div className="flex items-center justify-center gap-2 mb-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-medium">
                United States
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight">
              Federal Government
            </h1>
            <p className="text-2xl sm:text-3xl font-bold tabular-nums mt-1.5 font-mono">
              {fmt(data.grandTotal)}
            </p>
            <p className="text-sm text-muted-foreground mt-0.5">
              federal employees
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tree connector: root to 3 branches */}
      <div className="hidden lg:block" style={{ height: 48 }}>
        <div
          style={{
            width: 1.5,
            height: 16,
            backgroundColor: "var(--border)",
            margin: "0 auto",
          }}
        />
        <div
          style={{
            position: "relative",
            maxWidth: "64rem",
            margin: "0 auto",
            height: 32,
          }}
        >
          <div
            style={{
              position: "absolute",
              top: 0,
              left: "16.67%",
              right: "16.67%",
              height: 1.5,
              backgroundColor: "var(--border)",
            }}
          />
          <div
            style={{
              position: "absolute",
              top: 0,
              left: "16.67%",
              width: 1.5,
              height: "100%",
              backgroundColor: "var(--border)",
            }}
          />
          <div
            style={{
              position: "absolute",
              top: 0,
              left: "50%",
              width: 1.5,
              transform: "translateX(-50%)",
              height: "100%",
              backgroundColor: "var(--border)",
            }}
          />
          <div
            style={{
              position: "absolute",
              top: 0,
              right: "16.67%",
              width: 1.5,
              height: "100%",
              backgroundColor: "var(--border)",
            }}
          />
        </div>
      </div>

      {/* Mobile connector */}
      <div className="flex justify-center lg:hidden" style={{ height: 32 }}>
        <div
          style={{
            width: 1.5,
            height: "100%",
            backgroundColor: "var(--border)",
          }}
        />
      </div>

      {/* Search */}
      <div className="flex justify-center mb-6">
        <div className="relative w-full" style={{ maxWidth: 320 }}>
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search agencies..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9 text-sm"
          />
        </div>
      </div>

      {/* Three branches */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {filtered.map((branch) => (
          <BranchColumn key={branch.key} branch={branch} />
        ))}
      </div>

      {filtered.length === 0 && (
        <p className="text-center text-muted-foreground py-12">
          No agencies found for &ldquo;{search}&rdquo;
        </p>
      )}
    </div>
  );
}
