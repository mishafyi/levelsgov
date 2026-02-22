"use client";

import { useCallback, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Filter, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FilterCombobox, type ComboboxOption } from "./filter-combobox";
import type { getFilterOptions } from "@/lib/filters";

type Dataset = "employment" | "accessions" | "separations";

export interface FilterSidebarProps {
  dataset: Dataset;
  options: Awaited<ReturnType<typeof getFilterOptions>>;
}

const FILTER_CONFIG: Record<
  string,
  { label: string; type: "combobox" | "select"; datasets?: Dataset[] }
> = {
  agency_code: { label: "Agency", type: "combobox" },
  occupational_group_code: { label: "Occupational Group", type: "combobox" },
  occupational_series_code: { label: "Occupational Series", type: "combobox" },
  duty_station_state_abbreviation: { label: "State", type: "select" },
  grade: { label: "Grade", type: "select" },
  pay_bracket: { label: "Pay Range", type: "select" },
  sensitive_occupation: { label: "Sensitive Occupation", type: "combobox" },
  pay_plan_code: { label: "Pay Plan", type: "select" },
  education_level_code: { label: "Education Level", type: "select" },
  age_bracket: { label: "Age Bracket", type: "select" },
  work_schedule_code: { label: "Work Schedule", type: "select" },
  accession_category_code: {
    label: "Accession Category",
    type: "select",
    datasets: ["accessions"],
  },
  separation_category_code: {
    label: "Separation Category",
    type: "select",
    datasets: ["separations"],
  },
};

const FILTER_KEYS = Object.keys(FILTER_CONFIG);

function nonEmpty(items: ComboboxOption[]): ComboboxOption[] {
  return items.filter((i) => i.value !== "" && i.label !== "");
}

function buildFilterOptions(
  options: FilterSidebarProps["options"]
): Record<string, ComboboxOption[]> {
  const opts = options as Record<string, unknown[]>;
  return {
    agency_code: nonEmpty(
      ((opts.agencies as { code: string; name: string }[]) || []).map((a) => ({
        value: a.code,
        label: a.name,
      }))
    ),
    occupational_group_code: nonEmpty(
      ((opts.occGroups as { code: string; name: string }[]) || []).map((o) => ({
        value: o.code,
        label: o.name,
      }))
    ),
    occupational_series_code: nonEmpty(
      ((opts.occupations as { code: string; name: string }[]) || []).map(
        (o) => ({ value: o.code, label: o.name })
      )
    ),
    duty_station_state_abbreviation: nonEmpty(
      ((opts.states as { abbreviation: string; name: string }[]) || []).map(
        (s) => ({ value: s.abbreviation, label: s.name })
      )
    ),
    grade: nonEmpty(
      ((opts.grades as { grade: string }[]) || []).map((g) => ({
        value: g.grade,
        label: g.grade,
      }))
    ),
    pay_plan_code: nonEmpty(
      ((opts.payPlans as { code: string; name: string }[]) || []).map((p) => ({
        value: p.code,
        label: p.name,
      }))
    ),
    education_level_code: nonEmpty(
      ((opts.educations as { code: string; name: string }[]) || []).map(
        (e) => ({ value: e.code, label: e.name })
      )
    ),
    age_bracket: nonEmpty(
      ((opts.ages as { age_bracket: string }[]) || []).map((a) => ({
        value: a.age_bracket,
        label: a.age_bracket,
      }))
    ),
    work_schedule_code: nonEmpty(
      ((opts.workSchedules as { code: string; name: string }[]) || []).map(
        (w) => ({ value: w.code, label: w.name })
      )
    ),
    pay_bracket: [
      { value: "under_50k", label: "Under $50,000" },
      { value: "50k_75k", label: "$50,000 – $75,000" },
      { value: "75k_100k", label: "$75,000 – $100,000" },
      { value: "100k_150k", label: "$100,000 – $150,000" },
      { value: "150k_200k", label: "$150,000 – $200,000" },
      { value: "200k_plus", label: "$200,000+" },
    ],
    sensitive_occupation: [
      { value: "all_sensitive", label: "All Sensitive Occupations" },
      { value: "non_sensitive", label: "Non-Sensitive Only" },
      { value: "0007", label: "0007 – Correctional Officer" },
      { value: "0082", label: "0082 – United States Marshal" },
      { value: "0083", label: "0083 – Police" },
      { value: "0084", label: "0084 – Nuclear Materials Courier" },
      { value: "0132", label: "0132 – Intelligence" },
      { value: "0134", label: "0134 – Intelligence Clerk/Aide" },
      { value: "0401", label: "0401 – General Natural Resources & Bio Science (DHS)" },
      { value: "0436", label: "0436 – Plant Protection & Quarantine" },
      { value: "0512", label: "0512 – Internal Revenue Agent" },
      { value: "0840", label: "0840 – Nuclear Engineering" },
      { value: "0930", label: "0930 – Hearings and Appeals" },
      { value: "1169", label: "1169 – Internal Revenue Officer" },
      { value: "1171", label: "1171 – Appraising (IRS)" },
      { value: "1801", label: "1801 – General Inspection/Investigation/Enforcement" },
      { value: "1802", label: "1802 – Compliance Inspection/Investigating" },
      { value: "1811", label: "1811 – Criminal Investigating" },
      { value: "1812", label: "1812 – Game Law Enforcement" },
      { value: "1816", label: "1816 – Immigration Inspection" },
      { value: "1854", label: "1854 – Alcohol, Tobacco & Firearms Inspection" },
      { value: "1881", label: "1881 – Customs & Border Protection Interdiction" },
      { value: "1884", label: "1884 – Customs Patrol Officer" },
      { value: "1890", label: "1890 – Customs Inspection" },
      { value: "1895", label: "1895 – Customs and Border Protection" },
      { value: "1896", label: "1896 – Border Patrol Enforcement" },
    ],
    accession_category_code: nonEmpty(
      (
        (opts.accessionCategories as { code: string; name: string }[]) || []
      ).map((c) => ({ value: c.code, label: c.name }))
    ),
    separation_category_code: nonEmpty(
      (
        (opts.separationCategories as { code: string; name: string }[]) || []
      ).map((c) => ({ value: c.code, label: c.name }))
    ),
  };
}

function FilterControls({
  dataset,
  filterOptions,
  values,
  onFilterChange,
  onClearAll,
  activeCount,
}: {
  dataset: Dataset;
  filterOptions: Record<string, ComboboxOption[]>;
  values: Record<string, string>;
  onFilterChange: (key: string, value: string) => void;
  onClearAll: () => void;
  activeCount: number;
}) {
  const visibleFilters = FILTER_KEYS.filter((key) => {
    const config = FILTER_CONFIG[key];
    if (config.datasets && !config.datasets.includes(dataset)) return false;
    return true;
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">Filters</h3>
        {activeCount > 0 && (
          <Badge variant="secondary" className="text-xs">
            {activeCount} active
          </Badge>
        )}
      </div>

      {visibleFilters.map((key) => {
        const config = FILTER_CONFIG[key];
        const opts = filterOptions[key] || [];
        const currentValue = values[key] || "";

        return (
          <div key={key} className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-muted-foreground">
                {config.label}
              </label>
              {currentValue && (
                <button
                  onClick={() => onFilterChange(key, "")}
                  className="rounded p-0.5 text-muted-foreground hover:text-foreground"
                  aria-label={`Clear ${config.label}`}
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
            {config.type === "combobox" ? (
              <FilterCombobox
                label={config.label}
                options={opts}
                value={currentValue}
                onChange={(v) => onFilterChange(key, v)}
                placeholder={`All ${config.label.toLowerCase()}s`}
              />
            ) : (
              <Select
                value={currentValue || "__all__"}
                onValueChange={(v) =>
                  onFilterChange(key, v === "__all__" ? "" : v)
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue
                    placeholder={`All ${config.label.toLowerCase()}s`}
                  />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">
                    All {config.label.toLowerCase()}s
                  </SelectItem>
                  {opts.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        );
      })}

      {activeCount > 0 && (
        <Button
          variant="outline"
          size="sm"
          onClick={onClearAll}
          className="mt-2 w-full"
        >
          Clear All Filters
        </Button>
      )}
    </div>
  );
}

function useFilterState() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const values = useMemo(() => {
    const v: Record<string, string> = {};
    for (const key of FILTER_KEYS) {
      const val = searchParams.get(key);
      if (val) v[key] = val;
    }
    return v;
  }, [searchParams]);

  const activeCount = Object.values(values).filter(Boolean).length;

  const onFilterChange = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
      params.delete("page");
      router.replace(`?${params.toString()}`, { scroll: false });
    },
    [router, searchParams]
  );

  const onClearAll = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString());
    for (const key of FILTER_KEYS) {
      params.delete(key);
    }
    params.delete("page");
    router.replace(`?${params.toString()}`, { scroll: false });
  }, [router, searchParams]);

  return { values, activeCount, onFilterChange, onClearAll };
}

/** Desktop sidebar - renders as a fixed-width aside in a flex container */
export function FilterSidebar({ dataset, options }: FilterSidebarProps) {
  const filterOptions = useMemo(() => buildFilterOptions(options), [options]);
  const { values, activeCount, onFilterChange, onClearAll } = useFilterState();

  return (
    <aside className="hidden w-64 shrink-0 border-r bg-background md:block">
      <ScrollArea className="h-[calc(100vh-3.5rem)]">
        <div className="p-4">
          <FilterControls
            dataset={dataset}
            filterOptions={filterOptions}
            values={values}
            onFilterChange={onFilterChange}
            onClearAll={onClearAll}
            activeCount={activeCount}
          />
        </div>
      </ScrollArea>
    </aside>
  );
}

/** Mobile filter button + sheet - renders inline, shown only below md */
export function MobileFilterButton({ dataset, options }: FilterSidebarProps) {
  const filterOptions = useMemo(() => buildFilterOptions(options), [options]);
  const { values, activeCount, onFilterChange, onClearAll } = useFilterState();

  return (
    <div className="md:hidden">
      <Sheet>
        <SheetTrigger asChild>
          <Button variant="outline" size="sm" className="gap-2">
            <Filter className="h-4 w-4" />
            Filters
            {activeCount > 0 && (
              <Badge variant="default" className="ml-1 text-xs">
                {activeCount}
              </Badge>
            )}
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-80 p-0">
          <SheetHeader className="border-b p-4">
            <SheetTitle>Filters</SheetTitle>
          </SheetHeader>
          <ScrollArea className="h-[calc(100vh-4rem)]">
            <div className="p-4">
              <FilterControls
                dataset={dataset}
                filterOptions={filterOptions}
                values={values}
                onFilterChange={onFilterChange}
                onClearAll={onClearAll}
                activeCount={activeCount}
              />
            </div>
          </ScrollArea>
        </SheetContent>
      </Sheet>
    </div>
  );
}
