import clsx from "clsx";
import { ChevronLeft, Plus, Receipt, Settings, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Alert, Button, Card, EmptyState, SelectField, Spinner } from "@/components/ui";
import {
  useBalances,
  useCategories,
  useDeleteExpense,
  useExpenses,
  useSimplifiedDebts
} from "@/features/expenses/api";
import { useGroup, useGroupMembers } from "@/features/groups/api";
import { useAuth } from "@/lib/auth";
import { formatMoney } from "@/lib/money";
import type { ExpenseFilters } from "@/types/models";

type Tab = "expenses" | "balances";

export function GroupDetailPage() {
  const { groupId } = useParams<{ groupId: string }>();
  const { session } = useAuth();
  const myId = session?.user.id;

  const [tab, setTab] = useState<Tab>("expenses");
  const [filters, setFilters] = useState<ExpenseFilters>({});

  const group = useGroup(groupId);
  const members = useGroupMembers(groupId);
  const categories = useCategories(groupId);
  const expenses = useExpenses(groupId, filters);
  const balances = useBalances(groupId);
  const debts = useSimplifiedDebts(groupId);
  const deleteExpense = useDeleteExpense(groupId!);

  const currency = group.data?.default_currency ?? "INR";

  const nameFor = useMemo(() => {
    const map = new Map(members.data?.map((m) => [m.user_id, m.profile.display_name]) ?? []);
    return (userId: string) => (userId === myId ? "You" : map.get(userId) ?? "Someone");
  }, [members.data, myId]);

  const myBalance = balances.data?.find((b) => b.user_id === myId)?.net_minor ?? 0;

  if (group.isLoading) return <Spinner label="Loading group" />;
  if (group.isError || !group.data) return <Alert>This group doesn't exist, or you're not a member of it.</Alert>;

  return (
    <div className="flex flex-col gap-5">
      <Link to="/groups" className="inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900">
        <ChevronLeft size={16} aria-hidden />
        All groups
      </Link>

      <header className="flex items-center gap-3">
        <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-2xl">
          {group.data.icon}
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-xl font-semibold text-slate-900">{group.data.name}</h1>
          <p className="text-sm text-slate-600">
            {members.data?.length ?? "—"} members · {currency}
          </p>
        </div>
        <Link
          to={`/groups/${group.data.id}/settings`}
          aria-label="Group settings"
          className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
        >
          <Settings size={20} aria-hidden />
        </Link>
      </header>

      <Card className={clsx(myBalance === 0 ? "bg-slate-50" : myBalance > 0 ? "bg-emerald-50" : "bg-amber-50")}>
        <p className="text-sm text-slate-600">
          {myBalance === 0 ? "You're all settled up" : myBalance > 0 ? "You are owed" : "You owe"}
        </p>
        {myBalance !== 0 && (
          <p
            className={clsx(
              "text-2xl font-semibold tabular-nums",
              myBalance > 0 ? "text-emerald-700" : "text-amber-700"
            )}
          >
            {formatMoney(Math.abs(myBalance), currency)}
          </p>
        )}
      </Card>

      <div className="flex gap-2">
        <Link to={`/groups/${groupId}/expenses/new`} className="flex-1">
          <Button block>
            <Plus size={16} aria-hidden />
            Add expense
          </Button>
        </Link>
        <Link to={`/groups/${groupId}/settle`} className="flex-1">
          <Button block variant="secondary">
            Settle up
          </Button>
        </Link>
      </div>

      <div className="flex gap-1 rounded-lg bg-slate-100 p-1">
        {(["expenses", "balances"] as Tab[]).map((value) => (
          <button
            key={value}
            type="button"
            aria-pressed={tab === value}
            onClick={() => setTab(value)}
            className={clsx(
              "flex-1 rounded-md py-2 text-sm font-medium capitalize transition",
              tab === value ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-800"
            )}
          >
            {value}
          </button>
        ))}
      </div>

      {tab === "expenses" && (
        <div className="flex flex-col gap-4">
          <Card className="flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-3">
              <SelectField
                label="Category"
                value={filters.categoryId ?? ""}
                onChange={(e) => setFilters((f) => ({ ...f, categoryId: e.target.value || null }))}
              >
                <option value="">All</option>
                {categories.data?.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.icon} {category.name}
                  </option>
                ))}
              </SelectField>
              <SelectField
                label="Member"
                value={filters.memberId ?? ""}
                onChange={(e) => setFilters((f) => ({ ...f, memberId: e.target.value || null }))}
              >
                <option value="">Everyone</option>
                {members.data?.map((member) => (
                  <option key={member.user_id} value={member.user_id}>
                    {member.user_id === myId ? "You" : member.profile.display_name}
                  </option>
                ))}
              </SelectField>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-slate-700">From</span>
                <input
                  type="date"
                  value={filters.from ?? ""}
                  onChange={(e) => setFilters((f) => ({ ...f, from: e.target.value || null }))}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
                />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-slate-700">To</span>
                <input
                  type="date"
                  value={filters.to ?? ""}
                  onChange={(e) => setFilters((f) => ({ ...f, to: e.target.value || null }))}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
                />
              </label>
            </div>
            {(filters.categoryId || filters.memberId || filters.from || filters.to) && (
              <Button size="sm" variant="ghost" onClick={() => setFilters({})}>
                Clear filters
              </Button>
            )}
          </Card>

          {expenses.isLoading && <Spinner label="Loading expenses" />}
          {expenses.isError && <Alert>Could not load expenses.</Alert>}

          {expenses.data?.length === 0 && (
            <EmptyState
              icon={<Receipt size={32} aria-hidden />}
              title="No expenses yet"
              body="Add the first one and everyone's balance updates straight away."
            />
          )}

          <ul className="flex flex-col gap-2">
            {expenses.data?.map((expense) => {
              const myShare = expense.shares.find((s) => s.user_id === myId)?.share_amount_minor ?? 0;
              const payer = expense.payers[0];
              return (
                <li key={expense.id}>
                  <Card className="flex items-center gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-lg">
                      {expense.category?.icon ?? "🧾"}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-slate-900">{expense.description}</p>
                      <p className="truncate text-xs text-slate-500">
                        {payer ? `${nameFor(payer.user_id)} paid` : "Paid"} ·{" "}
                        {new Date(expense.expense_date).toLocaleDateString()}
                        {expense.category ? ` · ${expense.category.name}` : ""}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium tabular-nums text-slate-900">
                        {formatMoney(expense.total_amount_minor, currency)}
                      </p>
                      <p className="text-xs tabular-nums text-slate-500">
                        your share {formatMoney(myShare, currency)}
                      </p>
                    </div>
                    <button
                      type="button"
                      aria-label={`Delete ${expense.description}`}
                      onClick={() => deleteExpense.mutate(expense.id)}
                      className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600"
                    >
                      <Trash2 size={16} aria-hidden />
                    </button>
                  </Card>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {tab === "balances" && (
        <div className="flex flex-col gap-4">
          <Card>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Everyone's balance</h2>
            {balances.isLoading && <Spinner label="Calculating balances" />}
            <ul className="flex flex-col gap-2">
              {balances.data?.map((balance) => (
                <li key={balance.user_id} className="flex items-center gap-3">
                  <span className="min-w-0 flex-1 truncate text-sm text-slate-800">{nameFor(balance.user_id)}</span>
                  <span
                    className={clsx(
                      "text-sm font-medium tabular-nums",
                      balance.net_minor === 0
                        ? "text-slate-400"
                        : balance.net_minor > 0
                          ? "text-emerald-700"
                          : "text-amber-700"
                    )}
                  >
                    {balance.net_minor === 0
                      ? "settled"
                      : balance.net_minor > 0
                        ? `is owed ${formatMoney(balance.net_minor, currency)}`
                        : `owes ${formatMoney(Math.abs(balance.net_minor), currency)}`}
                  </span>
                </li>
              ))}
            </ul>
          </Card>

          <Card>
            <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-slate-500">Simplified settle-up</h2>
            <p className="mb-3 text-xs text-slate-500">
              The fewest transfers that clear every balance in this group.
            </p>
            {debts.isLoading && <Spinner label="Working out who pays whom" />}
            {debts.data?.length === 0 && <p className="text-sm text-slate-600">Everyone is settled up. 🎉</p>}
            <ul className="flex flex-col gap-2">
              {debts.data?.map((debt, i) => (
                <li key={`${debt.from_user}-${debt.to_user}-${i}`} className="flex items-center gap-2 text-sm">
                  <span className="font-medium text-slate-800">{nameFor(debt.from_user)}</span>
                  <span className="text-slate-400">→</span>
                  <span className="font-medium text-slate-800">{nameFor(debt.to_user)}</span>
                  <span className="ml-auto font-medium tabular-nums text-slate-900">
                    {formatMoney(debt.amount_minor, currency)}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      )}
    </div>
  );
}
