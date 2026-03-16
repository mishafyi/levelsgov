"use client";

import { useEffect, useRef, useCallback, useState } from "react";

export interface OccupationData {
  title: string;
  series_code: string;
  category: string;
  category_code: string;
  employees: number;
  avg_pay: number | null;
  median_pay: number | null;
  top_education: string | null;
  stem: boolean;
  exposure: number | null;
  exposure_rationale: string | null;
}

export interface AgeExposure {
  bracket: string;
  employees: number;
  avg: number;
}

export interface EduExposure {
  group: string;
  employees: number;
  avg: number;
}

interface Rect extends OccupationData {
  rx: number;
  ry: number;
  rw: number;
  rh: number;
  value: number;
}

// ── Broad category mapping (60 OPM groups → 12 categories) ────────────

const BROAD_CATEGORY: Record<string, string> = {
  // Healthcare
  "06": "Healthcare",
  "07": "Healthcare",           // Veterinary
  // Law Enforcement / Security
  "00": "Law Enforcement",      // Misc: police, fire, corrections, security
  "18": "Law Enforcement",      // Investigation
  // Engineering
  "08": "Engineering",
  // IT / Cyber
  "22": "IT / Cyber",
  // Admin / Clerical
  "03": "Admin / Clerical",
  "16": "Admin / Clerical",     // Equipment, Facilities, and Services
  // Legal
  "09": "Legal",
  "12": "Legal",                // Copyright, Patent, and Trademark
  // Science
  "04": "Science",              // Biological Sciences
  "13": "Science",              // Physical Sciences
  "15": "Science",              // Mathematics and Statistics
  // Finance / Accounting
  "05": "Finance / Accounting",
  "11": "Finance / Accounting", // Business and Industry
  // Trades / Maintenance
  "25": "Trades / Maintenance",
  "26": "Trades / Maintenance",
  "28": "Trades / Maintenance",
  "31": "Trades / Maintenance",
  "33": "Trades / Maintenance",
  "34": "Trades / Maintenance",
  "35": "Trades / Maintenance",
  "36": "Trades / Maintenance",
  "37": "Trades / Maintenance",
  "38": "Trades / Maintenance",
  "39": "Trades / Maintenance",
  "40": "Trades / Maintenance",
  "41": "Trades / Maintenance",
  "42": "Trades / Maintenance",
  "43": "Trades / Maintenance",
  "44": "Trades / Maintenance",
  "46": "Trades / Maintenance",
  "47": "Trades / Maintenance",
  "48": "Trades / Maintenance",
  "50": "Trades / Maintenance",
  "52": "Trades / Maintenance",
  "53": "Trades / Maintenance",
  "54": "Trades / Maintenance",
  "57": "Trades / Maintenance",
  "58": "Trades / Maintenance",
  "65": "Trades / Maintenance",
  "66": "Trades / Maintenance",
  "70": "Trades / Maintenance",
  "73": "Trades / Maintenance",
  "74": "Trades / Maintenance",
  "76": "Trades / Maintenance",
  "82": "Trades / Maintenance",
  "86": "Trades / Maintenance",
  "88": "Trades / Maintenance",
  "99": "Trades / Maintenance", // Vessel jobs
  // Education
  "17": "Education",
  "14": "Education",            // Library and Archives
  "10": "Education",            // Information and Arts
  // Supply / Logistics
  "20": "Supply / Logistics",
  "21": "Supply / Logistics",   // Transportation
  "69": "Supply / Logistics",   // Warehousing
  // Management / Policy
  "01": "Management / Policy",  // Social Science, Psychology, Welfare
  "02": "Management / Policy",  // Human Resources
  "19": "Management / Policy",  // Quality Assurance
};

function getBroadCategory(categoryCode: string): string {
  return BROAD_CATEGORY[categoryCode] || "Other";
}

// ── Color scale (AI exposure: green → red) ─────────────────────────────

function exposureColor(score: number | null): [number, number, number] {
  if (score == null) return [128, 128, 128];
  const t = Math.max(0, Math.min(10, score)) / 10;
  let r: number, g: number, b: number;
  if (t < 0.5) {
    const s = t / 0.5;
    r = Math.round(50 + s * 180);
    g = Math.round(160 - s * 10);
    b = Math.round(50 - s * 20);
  } else {
    const s = (t - 0.5) / 0.5;
    r = Math.round(230 + s * 25);
    g = Math.round(150 - s * 110);
    b = Math.round(30 - s * 10);
  }
  return [r, g, b];
}

function exposureCSS(score: number | null, alpha: number): string {
  const [r, g, b] = exposureColor(score);
  return `rgba(${r},${g},${b},${alpha})`;
}

// ── Squarified treemap layout ──────────────────────────────────────────

interface SquarifyItem {
  value: number;
  [key: string]: unknown;
}

function worstAspect(
  row: SquarifyItem[],
  rowSum: number,
  side: number,
  totalArea: number,
  availableExtent: number
): number {
  const rowExtent = availableExtent * (rowSum / totalArea);
  if (rowExtent === 0) return Infinity;
  let worst = 0;
  for (const item of row) {
    const itemLen = side * (item.value / rowSum);
    if (itemLen === 0) continue;
    const aspect = Math.max(rowExtent / itemLen, itemLen / rowExtent);
    if (aspect > worst) worst = aspect;
  }
  return worst;
}

function squarify<T extends SquarifyItem>(
  items: T[],
  x: number,
  y: number,
  w: number,
  h: number
): (T & { rx: number; ry: number; rw: number; rh: number })[] {
  if (items.length === 0) return [];
  if (items.length === 1) {
    return [{ ...items[0], rx: x, ry: y, rw: w, rh: h }];
  }

  const total = items.reduce((s, d) => s + d.value, 0);
  if (total === 0) return [];

  const results: (T & { rx: number; ry: number; rw: number; rh: number })[] =
    [];
  let remaining = [...items];
  let cx = x,
    cy = y,
    cw = w,
    ch = h;

  while (remaining.length > 0) {
    const remTotal = remaining.reduce((s, d) => s + d.value, 0);
    const vertical = cw >= ch;
    const side = vertical ? ch : cw;

    let row = [remaining[0]];
    let rowSum = remaining[0].value;

    for (let i = 1; i < remaining.length; i++) {
      const candidate = [...row, remaining[i]];
      const candidateSum = rowSum + remaining[i].value;
      if (
        worstAspect(
          candidate,
          candidateSum,
          side,
          remTotal,
          vertical ? cw : ch
        ) <
        worstAspect(row, rowSum, side, remTotal, vertical ? cw : ch)
      ) {
        row = candidate;
        rowSum = candidateSum;
      } else {
        break;
      }
    }

    const rowFraction = rowSum / remTotal;
    const rowThickness = vertical ? cw * rowFraction : ch * rowFraction;

    let offset = 0;
    for (const item of row) {
      const itemFraction = item.value / rowSum;
      const itemLength = side * itemFraction;
      if (vertical) {
        results.push({
          ...item,
          rx: cx,
          ry: cy + offset,
          rw: rowThickness,
          rh: itemLength,
        });
      } else {
        results.push({
          ...item,
          rx: cx + offset,
          ry: cy,
          rw: itemLength,
          rh: rowThickness,
        });
      }
      offset += itemLength;
    }

    if (vertical) {
      cx += rowThickness;
      cw -= rowThickness;
    } else {
      cy += rowThickness;
      ch -= rowThickness;
    }

    remaining = remaining.slice(row.length);
  }

  return results;
}

// ── Helpers ────────────────────────────────────────────────────────────

function formatNumber(n: number | null): string {
  if (n == null) return "\u2014";
  if (n >= 1000000) return (n / 1000000).toFixed(1) + "M";
  if (n >= 1000) return Math.round(n / 1000).toLocaleString() + "K";
  return n.toLocaleString();
}

function formatPay(n: number | null): string {
  if (n == null) return "\u2014";
  return "$" + Math.round(n).toLocaleString();
}

function titleCase(s: string): string {
  return s
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .replace(/\bAnd\b/g, "and")
    .replace(/\bOf\b/g, "of")
    .replace(/\bThe\b/g, "the")
    .replace(/\bIn\b/g, "in")
    .replace(/\bFor\b/g, "for");
}

// ── Sidebar stats ──────────────────────────────────────────────────────

function Stats({ data, ageExposure, eduExposure }: { data: OccupationData[]; ageExposure: AgeExposure[]; eduExposure: EduExposure[] }) {
  const totalEmployees = data.reduce((s, d) => s + d.employees, 0);

  // Weighted avg exposure
  let weightedSum = 0,
    weightedCount = 0;
  for (const d of data) {
    if (d.exposure != null) {
      weightedSum += d.exposure * d.employees;
      weightedCount += d.employees;
    }
  }
  const weightedAvg = weightedCount > 0 ? weightedSum / weightedCount : 0;

  // Histogram: employees per exposure score 0-10
  const histogram = new Array(11).fill(0) as number[];
  for (const d of data) {
    if (d.exposure != null) {
      histogram[d.exposure] += d.employees;
    }
  }
  const maxHist = Math.max(...histogram);

  // Tiers
  const tiers = [
    { name: "Minimal", range: [0, 1] as const, ref: 0.5 },
    { name: "Low", range: [2, 3] as const, ref: 2.5 },
    { name: "Moderate", range: [4, 5] as const, ref: 4.5 },
    { name: "High", range: [6, 7] as const, ref: 6.5 },
    { name: "Very high", range: [8, 10] as const, ref: 9 },
  ].map((tier) => {
    let employees = 0;
    for (const d of data) {
      if (
        d.exposure != null &&
        d.exposure >= tier.range[0] &&
        d.exposure <= tier.range[1]
      ) {
        employees += d.employees;
      }
    }
    return {
      ...tier,
      employees,
      pct: totalEmployees > 0 ? (employees / totalEmployees) * 100 : 0,
    };
  });

  // Exposure by pay band
  const payBands = [
    { label: "<$50K", min: 0, max: 50000 },
    { label: "$50-75K", min: 50000, max: 75000 },
    { label: "$75-100K", min: 75000, max: 100000 },
    { label: "$100-150K", min: 100000, max: 150000 },
    { label: "$150K+", min: 150000, max: Infinity },
  ].map((band) => {
    let wSum = 0,
      wCount = 0;
    for (const d of data) {
      if (
        d.exposure != null &&
        d.avg_pay != null &&
        d.avg_pay >= band.min &&
        d.avg_pay < band.max
      ) {
        wSum += d.exposure * d.employees;
        wCount += d.employees;
      }
    }
    const avg = wCount > 0 ? wSum / wCount : 0;
    return { ...band, avg };
  });

  // Wages in high-exposure jobs (7+)
  let wagesExposed = 0;
  for (const d of data) {
    if (d.exposure != null && d.exposure >= 7 && d.avg_pay != null) {
      wagesExposed += d.employees * d.avg_pay;
    }
  }

  const gradientRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = gradientRef.current;
    if (!c) return;
    const gctx = c.getContext("2d");
    if (!gctx) return;
    for (let x = 0; x < 80; x++) {
      const score = (x / 79) * 10;
      gctx.fillStyle = exposureCSS(score, 1);
      gctx.fillRect(x, 0, 1, 8);
    }
  }, []);

  return (
    <div className="flex w-[220px] shrink-0 flex-col gap-5 overflow-y-auto border-r border-white/[0.06] bg-[#12121a] p-5 text-[#e0e0e8]">
      <div>
        <h1 className="text-base font-semibold leading-tight tracking-tight">
          AI Exposure of the Federal Workforce
        </h1>
        <p className="mt-1 text-[11px] leading-snug text-[#888894]">
          {data.length} occupation series &middot; area = headcount &middot;
          color = AI exposure
          <br />
          Employment from{" "}
          <a
            href="https://www.opm.gov/data/"
            className="text-[#888894] underline"
          >
            OPM
          </a>
          , scored by Claude Opus, Mar 2026
        </p>
      </div>

      {/* Total employees */}
      <div className="flex flex-col gap-1.5">
        <h3 className="text-[10px] font-semibold uppercase tracking-widest text-[#888894]">
          Federal employees
        </h3>
        <div className="text-[28px] font-bold leading-none tracking-tight">
          {(totalEmployees / 1e6).toFixed(1)}M
        </div>
      </div>

      {/* Weighted avg exposure */}
      <div className="flex flex-col gap-1.5">
        <h3 className="text-[10px] font-semibold uppercase tracking-widest text-[#888894]">
          Weighted avg. exposure
        </h3>
        <div
          className="text-[28px] font-bold leading-none tracking-tight"
          style={{ color: exposureCSS(weightedAvg, 1) }}
        >
          {weightedAvg.toFixed(1)}
        </div>
        <div className="text-[11px] text-[#888894]">
          headcount-weighted, 0-10 scale
        </div>
      </div>

      {/* Histogram */}
      <div className="flex flex-col gap-1.5">
        <h3 className="text-[10px] font-semibold uppercase tracking-widest text-[#888894]">
          Employees by exposure
        </h3>
        <div className="flex h-12 items-end gap-0.5">
          {histogram.map((count, i) => (
            <div
              key={i}
              className="min-h-[1px] flex-1 rounded-t-[1px]"
              style={{
                height: `${Math.max(2, maxHist > 0 ? (count / maxHist) * 100 : 0)}%`,
                background: exposureCSS(i, 0.7),
              }}
              title={`${i}: ${formatNumber(count)} employees`}
            />
          ))}
        </div>
        <div className="flex justify-between text-[9px] text-[#888894]">
          <span>0</span>
          <span>5</span>
          <span>10</span>
        </div>
      </div>

      {/* Tier breakdown */}
      <div className="flex flex-col gap-1.5">
        <h3 className="text-[10px] font-semibold uppercase tracking-widest text-[#888894]">
          Breakdown
        </h3>
        <div className="flex flex-col gap-1">
          {tiers.map((t) => (
            <div
              key={t.name}
              className="flex items-center gap-1.5 text-[11px]"
            >
              <div
                className="h-2.5 w-2.5 shrink-0 rounded-[2px]"
                style={{ background: exposureCSS(t.ref, 1) }}
              />
              <span className="flex-1 text-[#888894]">
                {t.name} ({t.range[0]}-{t.range[1]})
              </span>
              <span className="whitespace-nowrap">
                {formatNumber(t.employees)}
              </span>
              <span className="w-8 text-right text-[10px] text-[#888894]">
                {t.pct.toFixed(0)}%
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Exposure by pay */}
      <div className="flex flex-col gap-1.5">
        <h3 className="text-[10px] font-semibold uppercase tracking-widest text-[#888894]">
          Exposure by pay
        </h3>
        <div className="flex flex-col gap-1">
          {payBands.map((band) => (
            <div
              key={band.label}
              className="flex items-center gap-1.5 text-[11px]"
            >
              <span className="w-[68px] shrink-0 text-right text-[10px] text-[#888894]">
                {band.label}
              </span>
              <div className="h-2.5 flex-1 overflow-hidden rounded-[2px] bg-white/[0.04]">
                <div
                  className="h-full rounded-[2px]"
                  style={{
                    width: `${(band.avg / 10) * 100}%`,
                    background: exposureCSS(band.avg, 0.8),
                  }}
                />
              </div>
              <span className="w-[22px] shrink-0 text-right text-[10px]">
                {band.avg.toFixed(1)}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Exposure by education */}
      <div className="flex flex-col gap-1.5">
        <h3 className="text-[10px] font-semibold uppercase tracking-widest text-[#888894]">
          Exposure by education
        </h3>
        <div className="flex flex-col gap-1">
          {eduExposure.map((grp) => (
            <div
              key={grp.group}
              className="flex items-center gap-1.5 text-[11px]"
            >
              <span className="w-[68px] shrink-0 text-right text-[10px] text-[#888894]">
                {grp.group}
              </span>
              <div className="h-2.5 flex-1 overflow-hidden rounded-[2px] bg-white/[0.04]">
                <div
                  className="h-full rounded-[2px]"
                  style={{
                    width: `${(grp.avg / 10) * 100}%`,
                    background: exposureCSS(grp.avg, 0.8),
                  }}
                />
              </div>
              <span className="w-[22px] shrink-0 text-right text-[10px]">
                {grp.avg.toFixed(1)}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Exposure by age */}
      {ageExposure.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <h3 className="text-[10px] font-semibold uppercase tracking-widest text-[#888894]">
            Exposure by age
          </h3>
          <div className="flex flex-col gap-1">
            {ageExposure.map((a) => (
              <div
                key={a.bracket}
                className="flex items-center gap-1.5 text-[11px]"
              >
                <span className="w-[68px] shrink-0 text-right text-[10px] text-[#888894]">
                  {a.bracket}
                </span>
                <div className="h-2.5 flex-1 overflow-hidden rounded-[2px] bg-white/[0.04]">
                  <div
                    className="h-full rounded-[2px]"
                    style={{
                      width: `${(a.avg / 10) * 100}%`,
                      background: exposureCSS(a.avg, 0.8),
                    }}
                  />
                </div>
                <span className="w-[22px] shrink-0 text-right text-[10px]">
                  {a.avg.toFixed(1)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Wages exposed */}
      <div className="flex flex-col gap-1.5">
        <h3 className="text-[10px] font-semibold uppercase tracking-widest text-[#888894]">
          Wages exposed
        </h3>
        <div className="text-[28px] font-bold leading-none tracking-tight">
          ${(wagesExposed / 1e9).toFixed(0)}B
        </div>
        <div className="text-[11px] text-[#888894]">
          annual wages in high-exposure roles (7+)
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-1.5 text-[10px] text-[#888894]">
        <span>Low</span>
        <canvas
          ref={gradientRef}
          width={80}
          height={8}
          className="rounded-[2px]"
        />
        <span>High</span>
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────

const LENS_RADIUS = 120;
const LENS_ZOOM = 3;

export function OccupationTreemap({ data, ageExposure, eduExposure }: { data: OccupationData[]; ageExposure: AgeExposure[]; eduExposure: EduExposure[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const bufferRef = useRef<HTMLCanvasElement | null>(null);
  const rectsRef = useRef<Rect[]>([]);
  const catRectsRef = useRef<{ name: string; rx: number; ry: number; rw: number; rh: number }[]>([]);
  const hoveredRef = useRef<Rect | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const mouseRef = useRef<{ x: number; y: number } | null>(null);
  const [magnifierOn, setMagnifierOn] = useState(false);
  const magnifierRef = useRef(false);

  // Keep ref in sync so callbacks don't go stale
  magnifierRef.current = magnifierOn;

  const GAP = 1.5;
  const MARGIN = 12;

  const doLayout = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container || data.length === 0) return;

    // Reset canvas size so flex container can shrink freely
    canvas.style.width = "0px";
    canvas.style.height = "0px";

    const dpr = window.devicePixelRatio || 1;
    const w = container.clientWidth;
    const h = container.clientHeight;

    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = w + "px";
    canvas.style.height = h + "px";

    // Create offscreen buffer at same size
    if (!bufferRef.current) {
      bufferRef.current = document.createElement("canvas");
    }
    bufferRef.current.width = w * dpr;
    bufferRef.current.height = h * dpr;

    const tx = MARGIN;
    const ty = MARGIN;
    const tw = w - MARGIN * 2;
    const th = h - MARGIN * 2;

    const byCategory: Record<string, OccupationData[]> = {};
    for (const d of data) {
      const key = getBroadCategory(d.category_code);
      if (!byCategory[key]) byCategory[key] = [];
      byCategory[key].push(d);
    }

    const categories = Object.keys(byCategory)
      .map((cat) => ({
        cat,
        items: byCategory[cat].sort((a, b) => b.employees - a.employees),
        value: byCategory[cat].reduce((s, d) => s + d.employees, 0),
      }))
      .sort((a, b) => b.value - a.value);

    const catRects = squarify(categories, tx, ty, tw, th);

    const rects: Rect[] = [];
    const catRectsList: { name: string; rx: number; ry: number; rw: number; rh: number }[] = [];
    for (const cr of catRects) {
      catRectsList.push({
        name: cr.cat,
        rx: cr.rx,
        ry: cr.ry,
        rw: cr.rw,
        rh: cr.rh,
      });
      const innerGap = GAP;
      const items = cr.items.map((d) => ({ ...d, value: d.employees }));
      const innerRects = squarify(
        items,
        cr.rx + innerGap,
        cr.ry + innerGap,
        cr.rw - innerGap * 2,
        cr.rh - innerGap * 2
      );
      for (const ir of innerRects) {
        rects.push(ir as Rect);
      }
    }

    rectsRef.current = rects;
    catRectsRef.current = catRectsList;
  }, [data]);

  // Draw treemap to a given context
  const drawTreemap = useCallback(
    (ctx: CanvasRenderingContext2D, w: number, h: number) => {
      const dpr = window.devicePixelRatio || 1;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = "#0a0a0f";
      ctx.fillRect(0, 0, w, h);

      const hovered = hoveredRef.current;

      for (const r of rectsRef.current) {
        const isHovered = r === hovered;
        const g = GAP / 2;
        const rx = r.rx + g;
        const ry = r.ry + g;
        const rw = r.rw - g * 2;
        const rh = r.rh - g * 2;

        if (rw <= 0 || rh <= 0) continue;

        ctx.fillStyle = exposureCSS(r.exposure, isHovered ? 0.8 : 0.5);
        ctx.fillRect(rx, ry, rw, rh);

        if (isHovered) {
          ctx.strokeStyle = "#fff";
          ctx.lineWidth = 2;
          ctx.strokeRect(rx, ry, rw, rh);
        }

        if (rw > 50 && rh > 18) {
          ctx.save();
          ctx.beginPath();
          ctx.rect(rx + 4, ry + 2, rw - 8, rh - 4);
          ctx.clip();

          const fontSize = Math.min(
            13,
            Math.max(9, Math.min(rw / 10, rh / 3))
          );
          ctx.font = `500 ${fontSize}px -apple-system, system-ui, sans-serif`;
          ctx.fillStyle = isHovered ? "#fff" : "rgba(255,255,255,0.85)";
          ctx.textBaseline = "top";
          ctx.fillText(titleCase(r.title), rx + 5, ry + 4);

          if (rh > 34 && rw > 60) {
            const info =
              (r.exposure != null ? r.exposure + "/10" : "") +
              " \u00b7 " +
              formatNumber(r.employees) +
              " employees";
            ctx.font = `400 ${Math.max(8, fontSize - 2)}px -apple-system, system-ui, sans-serif`;
            ctx.fillStyle = "rgba(255,255,255,0.5)";
            ctx.fillText(info, rx + 5, ry + 4 + fontSize + 2);
          }

          ctx.restore();
        }
      }

      // Draw group name overlays
      for (const cr of catRectsRef.current) {
        if (cr.rw < 60 || cr.rh < 30) continue;

        const fontSize = Math.min(11, Math.max(8, cr.rw / 18));
        ctx.font = `600 ${fontSize}px -apple-system, system-ui, sans-serif`;

        const maxLabelWidth = cr.rw - 12;
        let label = cr.name;
        let textWidth = ctx.measureText(label).width;

        // Truncate with ellipsis if too wide
        if (textWidth > maxLabelWidth) {
          while (label.length > 1 && ctx.measureText(label + "\u2026").width > maxLabelWidth) {
            label = label.slice(0, -1);
          }
          label += "\u2026";
          textWidth = ctx.measureText(label).width;
        }

        // Position at bottom-left of group
        const px = cr.rx + 4;
        const py = cr.ry + cr.rh - 4;

        // Dark pill background
        const padX = 4;
        const padY = 2;
        ctx.fillStyle = "rgba(0,0,0,0.55)";
        ctx.beginPath();
        const bx = px - padX;
        const by = py - fontSize - padY;
        const bw = Math.min(textWidth + padX * 2, maxLabelWidth + padX * 2);
        const bh = fontSize + padY * 2;
        const br = 3;
        ctx.moveTo(bx + br, by);
        ctx.lineTo(bx + bw - br, by);
        ctx.quadraticCurveTo(bx + bw, by, bx + bw, by + br);
        ctx.lineTo(bx + bw, by + bh - br);
        ctx.quadraticCurveTo(bx + bw, by + bh, bx + bw - br, by + bh);
        ctx.lineTo(bx + br, by + bh);
        ctx.quadraticCurveTo(bx, by + bh, bx, by + bh - br);
        ctx.lineTo(bx, by + br);
        ctx.quadraticCurveTo(bx, by, bx + br, by);
        ctx.fill();

        ctx.fillStyle = "rgba(255,255,255,0.7)";
        ctx.textBaseline = "bottom";
        ctx.fillText(label, px, py);
      }
    },
    []
  );

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const buffer = bufferRef.current;
    if (!canvas || !buffer) return;
    const ctx = canvas.getContext("2d");
    const bctx = buffer.getContext("2d");
    if (!ctx || !bctx) return;

    const dpr = window.devicePixelRatio || 1;
    const w = canvas.width / dpr;
    const h = canvas.height / dpr;

    // Draw treemap to buffer
    drawTreemap(bctx, w, h);

    // Copy buffer to main canvas
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(buffer, 0, 0);

    // Draw magnifier lens if active
    const mouse = mouseRef.current;
    if (magnifierRef.current && mouse) {
      const mx = mouse.x;
      const my = mouse.y;
      const r = LENS_RADIUS;
      const zoom = LENS_ZOOM;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      // Clip to circle
      ctx.save();
      ctx.beginPath();
      ctx.arc(mx, my, r, 0, Math.PI * 2);
      ctx.clip();

      // Draw zoomed portion from buffer
      const srcX = (mx - r / zoom) * dpr;
      const srcY = (my - r / zoom) * dpr;
      const srcW = (r * 2) / zoom * dpr;
      const srcH = (r * 2) / zoom * dpr;

      ctx.drawImage(
        buffer,
        srcX,
        srcY,
        srcW,
        srcH,
        mx - r,
        my - r,
        r * 2,
        r * 2
      );

      ctx.restore();

      // Draw lens border + shadow
      ctx.beginPath();
      ctx.arc(mx, my, r, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(255,255,255,0.4)";
      ctx.lineWidth = 2;
      ctx.stroke();

      // Outer glow
      ctx.beginPath();
      ctx.arc(mx, my, r + 1, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(0,0,0,0.5)";
      ctx.lineWidth = 3;
      ctx.stroke();

      // Crosshair dot
      ctx.beginPath();
      ctx.arc(mx, my, 2, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(255,255,255,0.6)";
      ctx.fill();
    }
  }, [drawTreemap]);

  const showTooltip = useCallback(
    (d: Rect, mx: number, my: number) => {
      const tt = tooltipRef.current;
      if (!tt) return;

      const scoreBar =
        d.exposure != null
          ? `<span style="color:${exposureCSS(d.exposure, 1)};font-weight:600;">AI Exposure: ${d.exposure}/10</span>
         <div style="margin-top:3px;height:4px;background:rgba(255,255,255,0.08);border-radius:2px;">
         <div style="height:100%;width:${d.exposure * 10}%;background:${exposureCSS(d.exposure, 1)};border-radius:2px;"></div></div>`
          : "";

      tt.innerHTML = `
      <div style="font-weight:600;font-size:14px;margin-bottom:6px;color:#fff;">${titleCase(d.title)}</div>
      <div style="font-size:12px;margin-bottom:8px;">${scoreBar}</div>
      <div style="display:grid;grid-template-columns:auto auto;gap:2px 12px;font-size:12px;">
        <span style="color:#888894;">Series code</span><span style="text-align:right;">${d.series_code}</span>
        <span style="color:#888894;">Employees</span><span style="text-align:right;">${d.employees.toLocaleString()}</span>
        <span style="color:#888894;">Avg pay</span><span style="text-align:right;">${formatPay(d.avg_pay)}</span>
        <span style="color:#888894;">Education</span><span style="text-align:right;">${d.top_education || "\u2014"}</span>
        <span style="color:#888894;">Group</span><span style="text-align:right;">${titleCase(d.category.replace(/ GROUP$| FAMILY$/, ""))}</span>
        <span style="color:#888894;">STEM</span><span style="text-align:right;">${d.stem ? "Yes" : "No"}</span>
      </div>
      ${d.exposure_rationale ? `<div style="font-size:11px;color:#888894;margin-top:8px;line-height:1.4;border-top:1px solid rgba(255,255,255,0.06);padding-top:8px;">${d.exposure_rationale}</div>` : ""}
    `;

      const pad = 16;
      let tx = mx + pad;
      let ty = my - pad;
      if (tx + 340 > window.innerWidth) tx = mx - 340 - pad;
      if (ty < 10) ty = my + pad;
      if (ty + 200 > window.innerHeight) ty = my - 200;

      tt.style.left = tx + "px";
      tt.style.top = ty + "px";
      tt.style.opacity = "1";
    },
    []
  );

  const hideTooltip = useCallback(() => {
    const tt = tooltipRef.current;
    if (tt) tt.style.opacity = "0";
  }, []);

  useEffect(() => {
    doLayout();
    draw();

    const onResize = () => {
      doLayout();
      draw();
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [data, doLayout, draw]);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const cx = e.clientX - rect.left;
      const cy = e.clientY - rect.top;

      mouseRef.current = { x: cx, y: cy };

      let hit: Rect | null = null;
      for (let i = rectsRef.current.length - 1; i >= 0; i--) {
        const r = rectsRef.current[i];
        if (
          cx >= r.rx &&
          cx < r.rx + r.rw &&
          cy >= r.ry &&
          cy < r.ry + r.rh
        ) {
          hit = r;
          break;
        }
      }

      if (hit !== hoveredRef.current) {
        hoveredRef.current = hit;
      }

      // Always redraw when magnifier is on (lens follows cursor)
      if (magnifierRef.current) {
        draw();
      } else if (hit !== hoveredRef.current) {
        draw();
      } else {
        draw();
      }

      if (hit) {
        showTooltip(hit, e.clientX, e.clientY);
        canvas.style.cursor = magnifierRef.current ? "none" : "pointer";
      } else {
        hideTooltip();
        canvas.style.cursor = magnifierRef.current ? "none" : "default";
      }
    },
    [draw, showTooltip, hideTooltip]
  );

  const handleMouseLeave = useCallback(() => {
    hoveredRef.current = null;
    mouseRef.current = null;
    hideTooltip();
    draw();
  }, [draw, hideTooltip]);

  return (
    <div className="flex h-[calc(100vh-3.5rem)] overflow-hidden bg-[#0a0a0f]">
      <Stats data={data} ageExposure={ageExposure} eduExposure={eduExposure} />
      <div ref={containerRef} className="relative flex-1 overflow-hidden">
        <canvas
          ref={canvasRef}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          className="block"
        />
        {/* Magnifier toggle */}
        <button
          onClick={() => setMagnifierOn((v) => !v)}
          className={`absolute right-3 top-3 flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium transition-all ${
            magnifierOn
              ? "border-white/40 bg-white/20 text-white shadow-lg shadow-black/30"
              : "border-white/20 bg-black/50 text-white/70 hover:bg-black/60 hover:text-white"
          }`}
          title={magnifierOn ? "Turn off magnifier" : "Turn on magnifier"}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
            {!magnifierOn && (
              <>
                <line x1="11" y1="8" x2="11" y2="14" />
                <line x1="8" y1="11" x2="14" y2="11" />
              </>
            )}
          </svg>
          {magnifierOn ? "Magnifier On" : "Magnify"}
        </button>
      </div>
      <div
        ref={tooltipRef}
        className="pointer-events-none fixed z-50 max-w-[340px] rounded-lg border border-white/[0.12] bg-[#12121a] px-4 py-3 text-[13px] leading-relaxed text-[#e0e0e8] opacity-0 shadow-[0_8px_32px_rgba(0,0,0,0.6)] transition-opacity duration-100"
      />
    </div>
  );
}
