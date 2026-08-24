import { formatMoney } from "@/lib/money";

/**
 * One hue for every bar. These categories are nominal — products, groups, spend buckets — so
 * shading them darker-where-bigger would double-encode length as colour and burn the only free
 * channel on information the bar already carries.
 */
export function RankedBars({
  rows,
  currency,
  emptyLabel
}: {
  rows: { key: string; icon: string; label: string; valueMinor: number; meta?: string }[];
  currency: string;
  emptyLabel: string;
}) {
  if (rows.length === 0) {
    return <p className="py-4 text-sm text-slate-500">{emptyLabel}</p>;
  }

  const max = Math.max(...rows.map((r) => r.valueMinor), 1);

  return (
    <ul className="flex flex-col gap-3">
      {rows.map((row) => {
        const pct = Math.max((row.valueMinor / max) * 100, 1.5);
        return (
          <li key={row.key} className="group">
            <div className="mb-1 flex items-baseline gap-2 text-sm">
              <span aria-hidden>{row.icon}</span>
              <span className="min-w-0 flex-1 truncate text-slate-800">{row.label}</span>
              {row.meta && <span className="text-xs text-slate-400">{row.meta}</span>}
              <span className="font-medium tabular-nums text-slate-900">
                {formatMoney(row.valueMinor, currency)}
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-chart transition-[width] duration-300"
                style={{ width: `${pct}%` }}
                role="img"
                aria-label={`${row.label}: ${formatMoney(row.valueMinor, currency)}`}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * Monthly trend. Only the peak is direct-labelled — a value above every bar goes unread — and
 * the rest is carried by the axis and the per-bar tooltip.
 */
export function MonthlyBars({
  rows,
  currency
}: {
  rows: { month: string; valueMinor: number }[];
  currency: string;
}) {
  if (rows.length === 0) {
    return <p className="py-4 text-sm text-slate-500">Nothing in this range yet.</p>;
  }

  const max = Math.max(...rows.map((r) => r.valueMinor), 1);
  const peak = rows.reduce((best, r) => (r.valueMinor > best.valueMinor ? r : best), rows[0]);

  const monthLabel = (month: string) =>
    new Date(month).toLocaleDateString(undefined, { month: "short" });

  return (
    <div>
      {/* items-stretch + h-full on each column gives the percentage heights something to resolve against. */}
      <div className="flex h-40 items-stretch gap-2 border-b border-slate-200 pb-0">
        {rows.map((row) => {
          const heightPct = Math.max((row.valueMinor / max) * 100, 2);
          const isPeak = row.month === peak.month;
          return (
            <div key={row.month} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1">
              {isPeak && (
                <span className="whitespace-nowrap text-[10px] font-medium tabular-nums text-slate-600">
                  {formatMoney(row.valueMinor, currency)}
                </span>
              )}
              <div
                className="w-full rounded-t bg-chart transition-[height] duration-300"
                style={{ height: `${heightPct}%` }}
                title={`${monthLabel(row.month)}: ${formatMoney(row.valueMinor, currency)}`}
                role="img"
                aria-label={`${monthLabel(row.month)}: ${formatMoney(row.valueMinor, currency)}`}
              />
            </div>
          );
        })}
      </div>
      <div className="flex gap-2 pt-1.5">
        {rows.map((row) => (
          <span key={row.month} className="min-w-0 flex-1 truncate text-center text-[10px] text-slate-500">
            {monthLabel(row.month)}
          </span>
        ))}
      </div>
    </div>
  );
}

/** The number is the chart — a single value doesn't need a plot. */
export function StatTile({
  label,
  valueMinor,
  currency,
  emphasis
}: {
  label: string;
  valueMinor: number;
  currency: string;
  emphasis?: boolean;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-card p-3">
      <p className="text-xs text-slate-500">{label}</p>
      <p
        className={
          emphasis
            ? "mt-0.5 text-2xl font-semibold tabular-nums text-slate-900"
            : "mt-0.5 text-lg font-medium tabular-nums text-slate-700"
        }
      >
        {formatMoney(valueMinor, currency)}
      </p>
    </div>
  );
}
