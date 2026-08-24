import clsx from "clsx";
import { ChartPie } from "lucide-react";
import { useMemo, useState } from "react";
import { MonthlyBars, RankedBars, StatTile } from "@/components/charts";
import { Alert, Card, EmptyState, Spinner } from "@/components/ui";
import { RANGE_PRESETS, usePersonalInsights } from "@/features/insights/api";
import { formatMoney } from "@/lib/money";

const initialRange = RANGE_PRESETS[2].range();

export function InsightsPage() {
  const [preset, setPreset] = useState<string | null>("3-months");
  const [from, setFrom] = useState(initialRange.from);
  const [to, setTo] = useState(initialRange.to);

  const insights = usePersonalInsights(from, to);

  function applyPreset(id: string) {
    const found = RANGE_PRESETS.find((p) => p.id === id);
    if (!found) return;
    const range = found.range();
    setPreset(id);
    setFrom(range.from);
    setTo(range.to);
  }

  // Groups carry their own currency, so every breakdown is reported per currency rather than
  // summed into one confident but meaningless number.
  const currencies = useMemo(
    () => (insights.data?.totals ?? []).map((t) => t.currency),
    [insights.data]
  );

  return (
    <div className="flex flex-col gap-5">
      <header>
        <h1 className="text-2xl font-semibold text-slate-900">Insights</h1>
        <p className="text-sm text-slate-600">Your share of spending across every group.</p>
      </header>

      <Card className="flex flex-col gap-3">
        <div className="flex flex-wrap gap-2">
          {RANGE_PRESETS.map((option) => (
            <button
              key={option.id}
              type="button"
              aria-pressed={preset === option.id}
              onClick={() => applyPreset(option.id)}
              className={clsx(
                "rounded-full px-3 py-1.5 text-sm transition",
                preset === option.id
                  ? "bg-brand-600 text-white"
                  : "border border-slate-300 bg-card text-slate-700 hover:bg-slate-50"
              )}
            >
              {option.label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-slate-700">From</span>
            <input
              type="date"
              value={from}
              max={to}
              onChange={(e) => {
                setFrom(e.target.value);
                setPreset(null);
              }}
              className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-slate-700">To</span>
            <input
              type="date"
              value={to}
              min={from}
              onChange={(e) => {
                setTo(e.target.value);
                setPreset(null);
              }}
              className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
            />
          </label>
        </div>
      </Card>

      {insights.isLoading && <Spinner label="Adding up your share" />}
      {insights.isError && (
        <Alert>
          {insights.error instanceof Error ? insights.error.message : "Could not load your insights."}
        </Alert>
      )}

      {insights.data && currencies.length === 0 && (
        <EmptyState
          icon={<ChartPie size={32} aria-hidden />}
          title="Nothing in this range"
          body="Once expenses land in that window, your share shows up here broken down by category, group, and month."
        />
      )}

      {currencies.map((currency) => {
        const total = insights.data!.totals.find((t) => t.currency === currency)!;
        const categories = insights.data!.by_category.filter((c) => c.currency === currency);
        const groups = insights.data!.by_group.filter((g) => g.currency === currency);
        const months = insights.data!.by_month.filter((m) => m.currency === currency);
        const expenses = insights.data!.expenses.filter((e) => e.currency === currency);

        return (
          <section key={currency} className="flex flex-col gap-4">
            {currencies.length > 1 && (
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">{currency}</h2>
            )}

            <div className="grid grid-cols-2 gap-3">
              <StatTile label="Your share" valueMinor={total.share_minor} currency={currency} emphasis />
              <StatTile label="You paid" valueMinor={total.paid_minor} currency={currency} />
            </div>
            <p className="-mt-2 text-xs text-slate-500">
              Across {total.expense_count} {total.expense_count === 1 ? "expense" : "expenses"} in this range.
            </p>

            <Card>
              <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">By month</h3>
              <MonthlyBars rows={months.map((m) => ({ month: m.month, valueMinor: m.share_minor }))} currency={currency} />
            </Card>

            <Card>
              <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">By category</h3>
              <RankedBars
                currency={currency}
                emptyLabel="No categorised spending in this range."
                rows={categories.map((c) => ({
                  key: c.category_id ?? "none",
                  icon: c.icon,
                  label: c.name,
                  valueMinor: c.share_minor,
                  meta: `${c.expense_count}×`
                }))}
              />
            </Card>

            <Card>
              <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">By group</h3>
              <RankedBars
                currency={currency}
                emptyLabel="No group spending in this range."
                rows={groups.map((g) => ({
                  key: g.group_id,
                  icon: g.icon,
                  label: g.name,
                  valueMinor: g.share_minor,
                  meta: `${g.expense_count}×`
                }))}
              />
            </Card>

            <Card>
              <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
                Your expenses
              </h3>
              {expenses.length === 0 ? (
                <p className="py-2 text-sm text-slate-500">Nothing in this range.</p>
              ) : (
                <ul className="flex flex-col divide-y divide-slate-100">
                  {expenses.map((expense) => (
                    <li key={expense.expense_id} className="flex items-center gap-3 py-2.5">
                      <span aria-hidden className="text-lg">
                        {expense.category_icon}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm text-slate-800">{expense.description}</p>
                        <p className="truncate text-xs text-slate-500">
                          {expense.group_icon} {expense.group_name} ·{" "}
                          {new Date(expense.expense_date).toLocaleDateString()}
                        </p>
                      </div>
                      <span className="text-sm font-medium tabular-nums text-slate-900">
                        {formatMoney(expense.share_amount_minor, currency)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </section>
        );
      })}
    </div>
  );
}
