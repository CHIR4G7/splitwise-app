import { InstallCard } from "@/components/InstallCard";
import { MonthlyBars, RankedBars, StatTile } from "@/components/charts";
import { Card } from "@/components/ui";

/**
 * Dev-only harness for eyeballing chart layout without signing in and seeding data.
 * Mounted at /dev/charts behind import.meta.env.DEV, so it never reaches a build.
 */
export function DevChartsPage() {
  const currency = "INR";

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4 p-4">
      <h1 className="text-xl font-semibold text-slate-900">Component harness (dev only)</h1>

      <InstallCard />

      <div className="grid grid-cols-2 gap-3">
        <StatTile label="Your share" valueMinor={4823750} currency={currency} emphasis />
        <StatTile label="You paid" valueMinor={6120000} currency={currency} />
      </div>

      <Card>
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">By month</h3>
        <MonthlyBars
          currency={currency}
          rows={[
            { month: "2026-03-01", valueMinor: 812300 },
            { month: "2026-04-01", valueMinor: 1450000 },
            { month: "2026-05-01", valueMinor: 634500 },
            { month: "2026-06-01", valueMinor: 1926950 },
            { month: "2026-07-01", valueMinor: 1102000 },
            { month: "2026-08-01", valueMinor: 398000 }
          ]}
        />
      </Card>

      <Card>
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">By category</h3>
        <RankedBars
          currency={currency}
          emptyLabel="Nothing here."
          rows={[
            { key: "1", icon: "🏠", label: "Rent", valueMinor: 1800000, meta: "3×" },
            { key: "2", icon: "🛒", label: "Groceries", valueMinor: 1245000, meta: "24×" },
            { key: "3", icon: "✈️", label: "Travel", valueMinor: 964500, meta: "5×" },
            { key: "4", icon: "🍽️", label: "Dining", valueMinor: 512750, meta: "18×" },
            { key: "5", icon: "🎬", label: "Entertainment", valueMinor: 187500, meta: "6×" },
            { key: "6", icon: "🧾", label: "Uncategorised", valueMinor: 14000, meta: "2×" }
          ]}
        />
      </Card>

      <Card>
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">By group</h3>
        <RankedBars
          currency={currency}
          emptyLabel="Nothing here."
          rows={[
            { key: "a", icon: "🏠", label: "Flat 302", valueMinor: 3120000, meta: "31×" },
            { key: "b", icon: "✈️", label: "Goa trip 2026", valueMinor: 1450000, meta: "12×" },
            { key: "c", icon: "🏅", label: "Sunday football", valueMinor: 253750, meta: "15×" }
          ]}
        />
      </Card>
    </div>
  );
}
