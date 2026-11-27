"use client";

import Link from "next/link";
import { useState } from "react";
import { motion } from "framer-motion";
import {
  formatCompact,
  formatMoney,
  type Bucket,
  type CategorySlice,
} from "@/lib/finance";
import { niceTicks, useWidth } from "./use-width";

const HEIGHT = 240;
const PAD = { top: 12, right: 8, bottom: 28, left: 48 };

// Column with 4px rounded data-end, square at the baseline.
function columnPath(x: number, y: number, w: number, h: number) {
  if (h <= 0) return "";
  const r = Math.min(4, w / 2, h);
  return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`;
}

function Tooltip({
  x,
  width,
  title,
  rows,
}: {
  x: number;
  width: number;
  title: string;
  rows: { label: string; value: string; color?: string }[];
}) {
  const left = Math.min(Math.max(x, 80), width - 80);
  return (
    <div
      className="pointer-events-none absolute top-0 z-10 w-40 -translate-x-1/2 rounded-xl card glass-strong px-3 py-2 text-xs shadow-xl shadow-black/10 dark:shadow-black/40"
      style={{ left }}
    >
      <p className="mb-1 text-paper/70">{title}</p>
      {rows.map((row) => (
        <p key={row.label} className="flex items-center gap-2">
          {row.color && (
            <span
              className="h-0.5 w-3 rounded-full"
              style={{ background: row.color }}
            />
          )}
          <span className="font-semibold tabular-nums">{row.value}</span>
          <span className="ml-auto text-paper/65">{row.label}</span>
        </p>
      ))}
    </div>
  );
}

function YAxis({
  ticks,
  y,
  width,
}: {
  ticks: number[];
  y: (v: number) => number;
  width: number;
}) {
  return (
    <g>
      {ticks.map((t) => (
        <g key={t}>
          <line
            x1={PAD.left}
            x2={width - PAD.right}
            y1={y(t)}
            y2={y(t)}
            stroke="var(--chart-grid)"
            strokeWidth={1}
          />
          <text
            x={PAD.left - 8}
            y={y(t)}
            dy="0.32em"
            textAnchor="end"
            className="fill-paper/45 text-[11px] tabular-nums"
          >
            {formatCompact(t)}
          </text>
        </g>
      ))}
    </g>
  );
}

function labelEvery(count: number, plotWidth: number) {
  return Math.max(
    1,
    Math.ceil(count / Math.max(1, Math.floor(plotWidth / 36))),
  );
}

// ---------------------------------------------------------------------------
// Income vs expense columns
// ---------------------------------------------------------------------------
export function IncomeExpenseChart({ data }: { data: Bucket[] }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [active, setActive] = useState<number | null>(null);

  const max = Math.max(0, ...data.flatMap((d) => [d.income, d.expense]));
  const ticks = niceTicks(max);
  const top = ticks[ticks.length - 1];
  const plotW = Math.max(0, width - PAD.left - PAD.right);
  const plotH = HEIGHT - PAD.top - PAD.bottom;
  const band = data.length ? plotW / data.length : 0;
  const barW = Math.max(2, Math.min(12, band * 0.36));
  const y = (v: number) => PAD.top + plotH - (v / top) * plotH;
  const every = labelEvery(data.length, plotW);
  const activeBucket = active === null ? null : data[active];

  return (
    <div>
      <Legend
        items={[
          { label: "Income", color: "var(--chart-income)" },
          { label: "Expenses", color: "var(--chart-expense)" },
        ]}
      />
      <div
        ref={ref}
        className="relative mt-3"
        onMouseLeave={() => setActive(null)}
      >
        {width > 0 && (
          <svg
            width={width}
            height={HEIGHT}
            role="img"
            aria-label="Income and expenses chart"
          >
            <YAxis ticks={ticks} y={y} width={width} />
            {data.map((d, i) => {
              const cx = PAD.left + band * i + band / 2;
              const hI = plotH - (y(d.income) - PAD.top);
              const hE = plotH - (y(d.expense) - PAD.top);
              return (
                <g key={d.key}>
                  <motion.g
                    initial={{ scaleY: 0 }}
                    animate={{ scaleY: 1 }}
                    transition={{
                      duration: 0.5,
                      delay: i * 0.012,
                      ease: [0.22, 1, 0.36, 1],
                    }}
                    style={{
                      transformOrigin: `0px ${PAD.top + plotH}px`,
                      transformBox: "view-box",
                    }}
                    opacity={active === null || active === i ? 1 : 0.45}
                  >
                    <path
                      d={columnPath(cx - barW - 1, y(d.income), barW, hI)}
                      fill="var(--chart-income)"
                    />
                    <path
                      d={columnPath(cx + 1, y(d.expense), barW, hE)}
                      fill="var(--chart-expense)"
                    />
                  </motion.g>
                  {i % every === 0 && (
                    <text
                      x={cx}
                      y={HEIGHT - 8}
                      textAnchor="middle"
                      className="fill-paper/45 text-[11px]"
                    >
                      {d.label}
                    </text>
                  )}
                  {/* Hit target: the whole band */}
                  <rect
                    x={PAD.left + band * i}
                    y={PAD.top}
                    width={band}
                    height={plotH}
                    fill="transparent"
                    tabIndex={0}
                    aria-label={`${d.title}: income ${formatMoney(d.income)}, expenses ${formatMoney(d.expense)}`}
                    // A mouse shows it on hover; a tap shows or hides it.
                    // Not onClick: focus lands first and would undo it.
                    onPointerEnter={(e) => {
                      if (e.pointerType === "mouse") setActive(i);
                    }}
                    onPointerDown={(e) => {
                      if (e.pointerType !== "mouse")
                        setActive((a) => (a === i ? null : i));
                    }}
                    onFocus={() => setActive(i)}
                    onBlur={() => setActive(null)}
                    className="outline-none"
                  />
                </g>
              );
            })}
            <line
              x1={PAD.left}
              x2={width - PAD.right}
              y1={PAD.top + plotH}
              y2={PAD.top + plotH}
              stroke="var(--chart-grid)"
            />
          </svg>
        )}
        {activeBucket && active !== null && (
          <Tooltip
            x={PAD.left + band * active + band / 2}
            width={width}
            title={activeBucket.title}
            rows={[
              {
                label: "Income",
                value: formatMoney(activeBucket.income),
                color: "var(--chart-income)",
              },
              {
                label: "Expenses",
                value: formatMoney(activeBucket.expense),
                color: "var(--chart-expense)",
              },
              {
                label: "Net",
                value: formatMoney(activeBucket.income - activeBucket.expense),
              },
            ]}
          />
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Running balance line
// ---------------------------------------------------------------------------
export function BalanceChart({ data }: { data: Bucket[] }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [active, setActive] = useState<number | null>(null);

  const points = data.reduce<(Bucket & { balance: number })[]>((acc, d) => {
    const previous = acc.length ? acc[acc.length - 1].balance : 0;
    acc.push({ ...d, balance: previous + d.income - d.expense });
    return acc;
  }, []);
  const values = points.map((p) => p.balance);
  const ticks = niceTicks(Math.max(0, ...values), Math.min(0, ...values));
  const lo = ticks[0];
  const hi = ticks[ticks.length - 1];
  const plotW = Math.max(0, width - PAD.left - PAD.right);
  const plotH = HEIGHT - PAD.top - PAD.bottom;
  const step = points.length > 1 ? plotW / (points.length - 1) : 0;
  const x = (i: number) =>
    PAD.left + (points.length > 1 ? step * i : plotW / 2);
  const y = (v: number) =>
    PAD.top + plotH - ((v - lo) / (hi - lo || 1)) * plotH;

  const line = points
    .map((p, i) => `${i ? "L" : "M"}${x(i)},${y(p.balance)}`)
    .join("");
  const area = points.length
    ? `${line}L${x(points.length - 1)},${y(0)}L${x(0)},${y(0)}Z`
    : "";
  const every = labelEvery(points.length, plotW);
  const last = points[points.length - 1];

  function onMove(e: React.PointerEvent<SVGRectElement>) {
    const box = e.currentTarget.getBoundingClientRect();
    const i = Math.round((e.clientX - box.left) / (step || 1));
    setActive(Math.max(0, Math.min(points.length - 1, i)));
  }

  return (
    <div ref={ref} className="relative" onMouseLeave={() => setActive(null)}>
      {width > 0 && points.length > 0 && (
        <svg
          width={width}
          height={HEIGHT}
          role="img"
          aria-label="Running balance chart"
        >
          <YAxis ticks={ticks} y={y} width={width} />
          <line
            x1={PAD.left}
            x2={width - PAD.right}
            y1={y(0)}
            y2={y(0)}
            stroke="var(--paper)"
            strokeOpacity={0.25}
          />
          <motion.path
            d={area}
            fill="var(--chart-net)"
            fillOpacity={0.1}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.3 }}
          />
          <motion.path
            d={line}
            fill="none"
            stroke="var(--chart-net)"
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
          />
          {points.map(
            (p, i) =>
              i % every === 0 && (
                <text
                  key={p.key}
                  x={x(i)}
                  y={HEIGHT - 8}
                  textAnchor="middle"
                  className="fill-paper/45 text-[11px]"
                >
                  {p.label}
                </text>
              ),
          )}
          {active !== null && (
            <line
              x1={x(active)}
              x2={x(active)}
              y1={PAD.top}
              y2={PAD.top + plotH}
              stroke="var(--paper)"
              strokeOpacity={0.3}
            />
          )}
          {last && (
            <circle
              cx={x(points.length - 1)}
              cy={y(last.balance)}
              r={4}
              fill="var(--chart-net)"
              stroke="var(--surface)"
              strokeWidth={2}
            />
          )}
          {active !== null && (
            <circle
              cx={x(active)}
              cy={y(points[active].balance)}
              r={5}
              fill="var(--chart-net)"
              stroke="var(--surface)"
              strokeWidth={2}
            />
          )}
          <rect
            x={PAD.left - step / 2}
            y={PAD.top}
            width={plotW + step}
            height={plotH}
            fill="transparent"
            onPointerMove={onMove}
            onPointerDown={onMove}
          />
        </svg>
      )}
      {active !== null && points[active] && (
        <Tooltip
          x={x(active)}
          width={width}
          title={points[active].title}
          rows={[
            {
              label: "Balance",
              value: formatMoney(points[active].balance),
              color: "var(--chart-net)",
            },
          ]}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Spending by category
// ---------------------------------------------------------------------------
export function CategoryBars({ slices }: { slices: CategorySlice[] }) {
  const total = slices.reduce((sum, s) => sum + s.amount, 0);
  const max = slices[0]?.amount ?? 0;

  if (slices.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-paper/55">
        Nothing to show yet.
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-3">
      {slices.map((s, i) => (
        <li
          key={s.id}
          className="grid grid-cols-[minmax(0,7rem)_1fr_auto] items-center gap-3 text-sm sm:grid-cols-[minmax(0,9rem)_1fr_auto]"
        >
          <span className="flex min-w-0 items-center gap-2">
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-sm"
              style={{ background: `var(--cat-${s.color})` }}
            />
            <span className="min-w-0 truncate">{s.name}</span>
          </span>
          <span className="h-2.5">
            <motion.span
              className="block h-full rounded-r"
              style={{
                background: `var(--cat-${s.color})`,
                width: `${Math.max(1, (s.amount / max) * 100)}%`,
                originX: 0,
              }}
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{
                duration: 0.6,
                delay: i * 0.05,
                ease: [0.22, 1, 0.36, 1],
              }}
            />
          </span>
          <span className="text-right tabular-nums">
            <span className="font-semibold">{formatMoney(s.amount)}</span>
            <span className="ml-2 text-paper/60">
              {Math.round((s.amount / total) * 100)}%
            </span>
          </span>
        </li>
      ))}
    </ul>
  );
}

// ---------------------------------------------------------------------------
// Legend + table view
// ---------------------------------------------------------------------------
function Legend({ items }: { items: { label: string; color: string }[] }) {
  return (
    <ul className="flex flex-wrap gap-4 text-sm text-paper/72">
      {items.map((item) => (
        <li key={item.label} className="flex items-center gap-2">
          <span
            className="h-2.5 w-2.5 rounded-sm"
            style={{ background: item.color }}
          />
          {item.label}
        </li>
      ))}
    </ul>
  );
}

export function BucketTable({
  data,
  heading,
}: {
  data: Bucket[];
  heading: string;
}) {
  const [open, setOpen] = useState(false);
  const rows = data.filter((d) => d.income || d.expense);
  const totals = rows.reduce(
    (acc, d) => ({
      income: acc.income + d.income,
      expense: acc.expense + d.expense,
    }),
    { income: 0, expense: 0 },
  );

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="text-sm text-paper/70 underline-offset-4 transition hover:text-paper hover:underline"
      >
        {open ? "Hide table" : "Show as table"}
      </button>
      {open && (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-md text-sm tabular-nums">
            <thead>
              <tr className="border-b border-paper/10 text-left text-paper/65">
                <th className="py-2 font-medium">{heading}</th>
                <th className="py-2 text-right font-medium">Income</th>
                <th className="py-2 text-right font-medium">Expenses</th>
                <th className="py-2 text-right font-medium">Net</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((d) => (
                <tr key={d.key} className="border-b border-paper/5">
                  <td className="py-2">
                    {d.href ? (
                      <Link href={d.href} className="hover:underline">
                        {d.title}
                      </Link>
                    ) : (
                      d.title
                    )}
                  </td>
                  <td className="py-2 text-right">{formatMoney(d.income)}</td>
                  <td className="py-2 text-right">{formatMoney(d.expense)}</td>
                  <td className="py-2 text-right font-medium">
                    {formatMoney(d.income - d.expense)}
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-6 text-center text-paper/55">
                    No entries in this range.
                  </td>
                </tr>
              )}
            </tbody>
            {rows.length > 0 && (
              <tfoot>
                <tr className="font-semibold">
                  <td className="py-2">Total</td>
                  <td className="py-2 text-right">
                    {formatMoney(totals.income)}
                  </td>
                  <td className="py-2 text-right">
                    {formatMoney(totals.expense)}
                  </td>
                  <td className="py-2 text-right">
                    {formatMoney(totals.income - totals.expense)}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}
    </div>
  );
}
