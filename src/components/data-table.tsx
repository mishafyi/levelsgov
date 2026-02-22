"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AnimatedTable,
  type ColumnDef,
  type SortDirection,
} from "@/components/ui/animated-table";
import { Badge } from "@/components/ui/badge";

type Dataset = "employment" | "accessions" | "separations";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any> & { id: number };

interface DataTableProps {
  initialData: Row[];
  total: number;
  dataset: Dataset;
  filters: Record<string, string>;
}

const payFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

function formatPay(value: unknown): React.ReactNode {
  if (value === null || value === undefined || value === "") {
    return (
      <Badge variant="secondary" className="text-xs text-muted-foreground">
        Suppressed
      </Badge>
    );
  }
  return payFormatter.format(Number(value));
}

function formatValue(value: unknown): React.ReactNode {
  if (value === null || value === undefined || value === "") {
    return <span className="text-muted-foreground">&mdash;</span>;
  }
  return String(value);
}

// All possible columns with metadata
const ALL_COLUMNS: ColumnDef<Row>[] = [
  {
    id: "agency",
    header: "Agency",
    accessorKey: "agency",
    sortable: true,
    cell: (row) => formatValue(row.agency),
  },
  {
    id: "duty_station_state",
    header: "State",
    accessorKey: "duty_station_state",
    sortable: true,
    cell: (row) =>
      formatValue(row.duty_station_state_abbreviation || row.duty_station_state),
  },
  {
    id: "occupational_series",
    header: "Occupation",
    accessorKey: "occupational_series",
    sortable: true,
    cell: (row) => formatValue(row.occupational_series),
  },
  {
    id: "grade",
    header: "Grade",
    accessorKey: "grade",
    sortable: true,
    cell: (row) => formatValue(row.grade),
    width: "80px",
  },
  {
    id: "annualized_adjusted_basic_pay",
    header: "Annual Pay",
    accessorKey: "annualized_adjusted_basic_pay",
    sortable: true,
    align: "right",
    cell: (row) => formatPay(row.annualized_adjusted_basic_pay),
  },
  {
    id: "education_level",
    header: "Education",
    accessorKey: "education_level",
    sortable: true,
    cell: (row) => formatValue(row.education_level),
  },
  // Hidden by default
  {
    id: "agency_subelement",
    header: "Agency Subelement",
    accessorKey: "agency_subelement",
    cell: (row) => formatValue(row.agency_subelement),
  },
  {
    id: "age_bracket",
    header: "Age Bracket",
    accessorKey: "age_bracket",
    sortable: true,
    cell: (row) => formatValue(row.age_bracket),
  },
  {
    id: "appointment_type",
    header: "Appointment Type",
    accessorKey: "appointment_type",
    cell: (row) => formatValue(row.appointment_type),
  },
  {
    id: "pay_plan",
    header: "Pay Plan",
    accessorKey: "pay_plan",
    cell: (row) => formatValue(row.pay_plan),
  },
  {
    id: "work_schedule",
    header: "Work Schedule",
    accessorKey: "work_schedule",
    cell: (row) => formatValue(row.work_schedule),
  },
  {
    id: "supervisory_status",
    header: "Supervisory Status",
    accessorKey: "supervisory_status",
    cell: (row) => formatValue(row.supervisory_status),
  },
  {
    id: "stem_occupation",
    header: "STEM Occupation",
    accessorKey: "stem_occupation",
    cell: (row) => formatValue(row.stem_occupation),
  },
  {
    id: "length_of_service_years",
    header: "Years of Service",
    accessorKey: "length_of_service_years",
    sortable: true,
    align: "right",
    cell: (row) => formatValue(row.length_of_service_years),
  },
  {
    id: "duty_station_country",
    header: "Country",
    accessorKey: "duty_station_country",
    cell: (row) => formatValue(row.duty_station_country),
  },
  {
    id: "occupational_group",
    header: "Occupational Group",
    accessorKey: "occupational_group",
    cell: (row) => formatValue(row.occupational_group),
  },
];

const DEFAULT_VISIBLE_DESKTOP = [
  "agency",
  "duty_station_state",
  "occupational_series",
  "grade",
  "annualized_adjusted_basic_pay",
  "education_level",
];

const DEFAULT_VISIBLE_MOBILE = [
  "agency",
  "grade",
  "annualized_adjusted_basic_pay",
];

function ExpandedRowContent({ row }: { row: Row }) {
  const sections = [
    {
      title: "Organization",
      fields: [
        { label: "Agency", value: row.agency },
        { label: "Agency Subelement", value: row.agency_subelement },
        { label: "Agency Code", value: row.agency_code },
      ],
    },
    {
      title: "Location",
      fields: [
        { label: "State", value: row.duty_station_state },
        { label: "Country", value: row.duty_station_country },
      ],
    },
    {
      title: "Position",
      fields: [
        { label: "Occupational Series", value: row.occupational_series },
        { label: "Occupational Group", value: row.occupational_group },
        { label: "Grade", value: row.grade },
        { label: "Pay Plan", value: row.pay_plan },
      ],
    },
    {
      title: "Compensation",
      fields: [
        {
          label: "Annual Pay",
          value: row.annualized_adjusted_basic_pay,
          format: "pay",
        },
      ],
    },
    {
      title: "Workforce",
      fields: [
        { label: "Education Level", value: row.education_level },
        { label: "Age Bracket", value: row.age_bracket },
        { label: "Years of Service", value: row.length_of_service_years },
        { label: "Work Schedule", value: row.work_schedule },
        { label: "Supervisory Status", value: row.supervisory_status },
        { label: "STEM Occupation", value: row.stem_occupation },
        { label: "Appointment Type", value: row.appointment_type },
      ],
    },
  ];

  // Add dataset-specific sections
  if (row.accession_category !== undefined) {
    sections.push({
      title: "Accession",
      fields: [
        { label: "Accession Category", value: row.accession_category },
      ],
    });
  }
  if (row.separation_category !== undefined) {
    sections.push({
      title: "Separation",
      fields: [
        { label: "Separation Category", value: row.separation_category },
      ],
    });
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {sections.map((section) => (
        <div key={section.title}>
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {section.title}
          </h4>
          <dl className="space-y-1">
            {section.fields.map((field) => (
              <div key={field.label} className="flex justify-between text-sm">
                <dt className="text-muted-foreground">{field.label}</dt>
                <dd className="font-medium text-foreground">
                  {"format" in field && field.format === "pay"
                    ? formatPay(field.value)
                    : formatValue(field.value)}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      ))}
    </div>
  );
}

export function DataTable({
  initialData,
  total: initialTotal,
  dataset,
  filters,
}: DataTableProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [data, setData] = useState<Row[]>(initialData);
  const [total, setTotal] = useState(initialTotal);
  const [loading, setLoading] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState<string[]>(() => {
    if (typeof window !== "undefined" && window.innerWidth < 640) {
      return DEFAULT_VISIBLE_MOBILE;
    }
    return DEFAULT_VISIBLE_DESKTOP;
  });

  // Track whether we've made a client-side navigation
  const isInitialRender = useRef(true);
  const prevParamsStr = useRef(searchParams.toString());

  const page = Number(searchParams.get("page") || "1");
  const pageSize = Number(searchParams.get("pageSize") || "50");
  const sortColumn = searchParams.get("sort") || undefined;
  const sortDir = (searchParams.get("sortDir") as SortDirection) || undefined;

  // When searchParams change (after initial render), fetch client-side
  useEffect(() => {
    const currentStr = searchParams.toString();
    if (isInitialRender.current) {
      isInitialRender.current = false;
      prevParamsStr.current = currentStr;
      return;
    }
    if (currentStr === prevParamsStr.current) return;
    prevParamsStr.current = currentStr;

    const controller = new AbortController();
    setLoading(true);

    fetch(`/api/${dataset}?${currentStr}`, { signal: controller.signal })
      .then((res) => res.json())
      .then((json) => {
        setData(json.data);
        setTotal(json.total);
      })
      .catch((err) => {
        if (err.name !== "AbortError") {
          console.error("Failed to fetch data:", err);
        }
      })
      .finally(() => setLoading(false));

    return () => controller.abort();
  }, [searchParams, dataset]);

  // Sync initial data from SSR when props change (e.g. full page navigation)
  useEffect(() => {
    setData(initialData);
    setTotal(initialTotal);
  }, [initialData, initialTotal]);

  const handlePageChange = useCallback(
    (newPage: number) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("page", String(newPage));
      router.replace(`?${params.toString()}`, { scroll: false });
    },
    [router, searchParams]
  );

  const handlePageSizeChange = useCallback(
    (newSize: number) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("pageSize", String(newSize));
      params.delete("page");
      router.replace(`?${params.toString()}`, { scroll: false });
    },
    [router, searchParams]
  );

  const handleSort = useCallback(
    (columnId: string, direction: SortDirection) => {
      const params = new URLSearchParams(searchParams.toString());
      if (direction) {
        params.set("sort", columnId);
        params.set("sortDir", direction);
      } else {
        params.delete("sort");
        params.delete("sortDir");
      }
      params.delete("page");
      router.replace(`?${params.toString()}`, { scroll: false });
    },
    [router, searchParams]
  );

  // Add dataset-specific columns
  const columns = useMemo(() => {
    const cols = [...ALL_COLUMNS];
    if (dataset === "accessions") {
      cols.push({
        id: "accession_category",
        header: "Accession Category",
        accessorKey: "accession_category",
        cell: (row) => formatValue(row.accession_category),
      });
    }
    if (dataset === "separations") {
      cols.push({
        id: "separation_category",
        header: "Separation Category",
        accessorKey: "separation_category",
        cell: (row) => formatValue(row.separation_category),
      });
    }
    return cols;
  }, [dataset]);

  return (
    <AnimatedTable<Row>
      data={data}
      columns={columns}
      sortColumn={sortColumn}
      sortDirection={sortDir}
      onSort={handleSort}
      loading={loading}
      striped
      expandable
      renderExpandedRow={(row) => <ExpandedRowContent row={row} />}
      columnVisibility
      visibleColumns={visibleColumns}
      onVisibleColumnsChange={setVisibleColumns}
      emptyMessage="No records match the current filters."
      pagination={{
        page,
        pageSize,
        totalItems: total,
        pageSizeOptions: [25, 50, 100],
        onPageChange: handlePageChange,
        onPageSizeChange: handlePageSizeChange,
      }}
    />
  );
}
