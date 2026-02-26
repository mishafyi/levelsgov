"use client";

import { useEffect, useState } from "react";
import { ComposableMap, Geographies, Geography } from "@vnedyalk0v/react19-simple-maps";

const GEO_URL = "https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json";

interface StateData {
  state: string;
  abbreviation: string;
  headcount: number;
  avgPay: number;
}

const STATE_ABBR: Record<string, string> = {
  Alabama: "AL", Alaska: "AK", Arizona: "AZ", Arkansas: "AR",
  California: "CA", Colorado: "CO", Connecticut: "CT", Delaware: "DE",
  Florida: "FL", Georgia: "GA", Hawaii: "HI", Idaho: "ID",
  Illinois: "IL", Indiana: "IN", Iowa: "IA", Kansas: "KS",
  Kentucky: "KY", Louisiana: "LA", Maine: "ME", Maryland: "MD",
  Massachusetts: "MA", Michigan: "MI", Minnesota: "MN", Mississippi: "MS",
  Missouri: "MO", Montana: "MT", Nebraska: "NE", Nevada: "NV",
  "New Hampshire": "NH", "New Jersey": "NJ", "New Mexico": "NM", "New York": "NY",
  "North Carolina": "NC", "North Dakota": "ND", Ohio: "OH", Oklahoma: "OK",
  Oregon: "OR", Pennsylvania: "PA", "Rhode Island": "RI", "South Carolina": "SC",
  "South Dakota": "SD", Tennessee: "TN", Texas: "TX", Utah: "UT",
  Vermont: "VT", Virginia: "VA", Washington: "WA", "West Virginia": "WV",
  Wisconsin: "WI", Wyoming: "WY", "District of Columbia": "DC",
};

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

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function payColor(t: number): string {
  // Light sky blue → deep blue
  const r = Math.round(lerp(219, 30, t));
  const g = Math.round(lerp(234, 64, t));
  const b = Math.round(lerp(254, 175, t));
  return `rgb(${r}, ${g}, ${b})`;
}

function impactColor(t: number): string {
  // Red (low replacement) → Yellow (mid) → Green (high replacement)
  // t: 0 = worst (red), 1 = best (green)
  const r = Math.round(lerp(220, 34, t));
  const g = Math.round(lerp(38, 197, t));
  const b = Math.round(lerp(38, 94, t));
  return `rgb(${r}, ${g}, ${b})`;
}

const fmtPay = (n: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);

const fmtNum = (n: number) => new Intl.NumberFormat("en-US").format(n);

export function USPayMap({ data }: { data: StateData[] }) {
  const isMobile = useIsMobile();
  const [tooltip, setTooltip] = useState<{
    x: number;
    y: number;
    name: string;
    pay?: number;
    headcount?: number;
  } | null>(null);

  const lookup = new Map<string, StateData>();
  for (const d of data) lookup.set(d.abbreviation, d);

  const pays = data.map((d) => d.avgPay);
  const minPay = Math.min(...pays);
  const maxPay = Math.max(...pays);
  const range = maxPay - minPay || 1;

  const getColor = (abbr: string | undefined) => {
    if (!abbr) return "hsl(var(--muted))";
    const d = lookup.get(abbr);
    if (!d) return "hsl(var(--muted))";
    return payColor((d.avgPay - minPay) / range);
  };

  return (
    <div className="relative">
      <ComposableMap
        projection="geoAlbersUsa"
        projectionConfig={{ scale: isMobile ? 700 : 900 }}
        width={800}
        height={500}
        style={{ width: "100%", height: "auto" }}
      >
        <Geographies geography={GEO_URL}>
          {({ geographies }) =>
            geographies.map((geo) => {
              const name: string = geo.properties.name;
              const abbr = STATE_ABBR[name];
              const sd = abbr ? lookup.get(abbr) : undefined;

              return (
                <Geography
                  key={geo.rsmKey}
                  geography={geo}
                  fill={getColor(abbr)}
                  stroke="hsl(var(--background))"
                  strokeWidth={0.75}
                  style={{
                    default: { outline: "none" },
                    hover: { outline: "none", opacity: 0.8 },
                    pressed: { outline: "none" },
                  }}
                  onMouseMove={(e) => {
                    setTooltip({
                      x: e.clientX,
                      y: e.clientY,
                      name,
                      pay: sd?.avgPay,
                      headcount: sd?.headcount,
                    });
                  }}
                  onMouseLeave={() => setTooltip(null)}
                />
              );
            })
          }
        </Geographies>
      </ComposableMap>

      {tooltip && (
        <div
          className="pointer-events-none fixed z-50 rounded-md border bg-popover px-3 py-1.5 shadow-md"
          style={{ left: tooltip.x + 14, top: tooltip.y - 14 }}
        >
          <p className="text-sm font-semibold">{tooltip.name}</p>
          {tooltip.pay != null ? (
            <>
              <p className="text-xs text-muted-foreground">
                Avg Pay: <span className="font-medium text-foreground">{fmtPay(tooltip.pay)}</span>
              </p>
              <p className="text-xs text-muted-foreground">
                {fmtNum(tooltip.headcount!)} employees
              </p>
            </>
          ) : (
            <p className="text-xs text-muted-foreground">No data</p>
          )}
        </div>
      )}

      <div className="mt-1 flex items-center justify-center gap-2 text-xs text-muted-foreground">
        <span>{fmtPay(minPay)}</span>
        <div
          className="h-2.5 w-28 rounded-sm sm:w-36"
          style={{
            background: `linear-gradient(to right, ${payColor(0)}, ${payColor(0.5)}, ${payColor(1)})`,
          }}
        />
        <span>{fmtPay(maxPay)}</span>
      </div>
    </div>
  );
}

interface StateImpactData {
  label: string;
  abbreviation: string;
  replacementPct: number;
  departures: number;
  hires: number;
  netLoss: number;
}

export function USStateImpactMap({ data }: { data: StateImpactData[] }) {
  const isMobile = useIsMobile();
  const [tooltip, setTooltip] = useState<{
    x: number;
    y: number;
    name: string;
    replacementPct?: number;
    departures?: number;
    hires?: number;
  } | null>(null);

  const lookup = new Map<string, StateImpactData>();
  for (const d of data) lookup.set(d.abbreviation, d);

  const pcts = data.map((d) => d.replacementPct);
  const minPct = Math.min(...pcts);
  const maxPct = Math.max(...pcts);
  const range = maxPct - minPct || 1;

  const getColor = (abbr: string | undefined) => {
    if (!abbr) return "hsl(var(--muted))";
    const d = lookup.get(abbr);
    if (!d) return "hsl(var(--muted))";
    // Higher replacement % = greener (better), lower = redder (worse)
    return impactColor((d.replacementPct - minPct) / range);
  };

  return (
    <div className="relative">
      <ComposableMap
        projection="geoAlbersUsa"
        projectionConfig={{ scale: isMobile ? 700 : 900 }}
        width={800}
        height={500}
        style={{ width: "100%", height: "auto" }}
      >
        <Geographies geography={GEO_URL}>
          {({ geographies }) =>
            geographies.map((geo) => {
              const name: string = geo.properties.name;
              const abbr = STATE_ABBR[name];

              return (
                <Geography
                  key={geo.rsmKey}
                  geography={geo}
                  fill={getColor(abbr)}
                  stroke="hsl(var(--background))"
                  strokeWidth={0.75}
                  style={{
                    default: { outline: "none" },
                    hover: { outline: "none", opacity: 0.8 },
                    pressed: { outline: "none" },
                  }}
                  onMouseMove={(e) => {
                    const sd = abbr ? lookup.get(abbr) : undefined;
                    setTooltip({
                      x: e.clientX,
                      y: e.clientY,
                      name,
                      replacementPct: sd?.replacementPct,
                      departures: sd?.departures,
                      hires: sd?.hires,
                    });
                  }}
                  onMouseLeave={() => setTooltip(null)}
                />
              );
            })
          }
        </Geographies>
      </ComposableMap>

      {tooltip && (
        <div
          className="pointer-events-none fixed z-50 rounded-md border bg-popover px-3 py-1.5 shadow-md"
          style={{ left: tooltip.x + 14, top: tooltip.y - 14 }}
        >
          <p className="text-sm font-semibold">{tooltip.name}</p>
          {tooltip.replacementPct != null ? (
            <>
              <p className="text-xs text-muted-foreground">
                Replacement:{" "}
                <span className="font-medium text-foreground">
                  {tooltip.replacementPct}%
                </span>
              </p>
              <p className="text-xs text-muted-foreground">
                {fmtNum(tooltip.departures!)} departed · {fmtNum(tooltip.hires!)} hired
              </p>
            </>
          ) : (
            <p className="text-xs text-muted-foreground">No data</p>
          )}
        </div>
      )}

      <div className="mt-1 flex items-center justify-center gap-2 text-xs text-muted-foreground">
        <span>{Math.round(minPct)}% replaced</span>
        <div
          className="h-2.5 w-28 rounded-sm sm:w-36"
          style={{
            background: `linear-gradient(to right, ${impactColor(0)}, ${impactColor(0.5)}, ${impactColor(1)})`,
          }}
        />
        <span>{Math.round(maxPct)}% replaced</span>
      </div>
    </div>
  );
}
