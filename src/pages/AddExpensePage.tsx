import { ChevronLeft } from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Alert, Button, Card, Field, SelectField, Spinner } from "@/components/ui";
import { useCategories, useCreateExpense } from "@/features/expenses/api";
import { useGroup, useGroupMembers } from "@/features/groups/api";
import { useAuth } from "@/lib/auth";
import { computeShares, formatMoney, reconciliationError, toMinor } from "@/lib/money";
import type { SplitMethod } from "@/types/models";

const METHODS: { value: SplitMethod; label: string; hint: string }[] = [
  { value: "equal", label: "Equally", hint: "Split evenly between everyone selected." },
  { value: "exact", label: "Exact amounts", hint: "Type what each person owes." },
  { value: "percent", label: "Percentages", hint: "Must add up to 100%." },
  { value: "shares", label: "Shares", hint: "Relative weights, e.g. 2 : 1 : 1." }
];

export function AddExpensePage() {
  const { groupId } = useParams<{ groupId: string }>();
  const { session } = useAuth();
  const navigate = useNavigate();

  const group = useGroup(groupId);
  const members = useGroupMembers(groupId);
  const categories = useCategories(groupId);
  const createExpense = useCreateExpense(groupId!);

  const currency = group.data?.default_currency ?? "INR";
  const myId = session?.user.id;

  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [expenseDate, setExpenseDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [paidBy, setPaidBy] = useState("");
  const [method, setMethod] = useState<SplitMethod>("equal");
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [inputs, setInputs] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  const roster = useMemo(() => members.data ?? [], [members.data]);

  // Default to everyone in, paid by me, once the roster arrives.
  useEffect(() => {
    if (roster.length === 0) return;
    setSelected((prev) => (Object.keys(prev).length > 0 ? prev : Object.fromEntries(roster.map((m) => [m.user_id, true]))));
    setPaidBy((prev) => prev || myId || roster[0].user_id);
  }, [roster, myId]);

  const participants = roster.filter((m) => selected[m.user_id]);
  const totalMinor = toMinor(amount || "0");

  const preview = useMemo(() => {
    if (!Number.isFinite(totalMinor) || participants.length === 0) {
      return { shares: [] as number[], rawInputs: [] as number[] };
    }
    const rawInputs = participants.map((m) => {
      const raw = inputs[m.user_id];
      if (method === "exact") return toMinor(raw || "0");
      return Number(raw || "0");
    });
    return { shares: computeShares(method, totalMinor, rawInputs), rawInputs };
  }, [method, totalMinor, participants, inputs]);

  const validation =
    !Number.isFinite(totalMinor) || totalMinor <= 0
      ? "Enter an amount greater than zero."
      : reconciliationError(method, totalMinor, preview.shares, preview.rawInputs, currency);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    if (!paidBy) {
      setError("Choose who paid.");
      return;
    }
    if (validation) {
      setError(validation);
      return;
    }

    try {
      await createExpense.mutateAsync({
        description,
        totalMinor,
        splitMethod: method,
        categoryId: categoryId || null,
        expenseDate,
        payers: [{ user_id: paidBy, amount_minor: totalMinor }],
        shares: participants.map((m, i) => ({
          user_id: m.user_id,
          share_amount_minor: preview.shares[i],
          share_percent: method === "percent" ? preview.rawInputs[i] : null,
          share_units: method === "shares" ? preview.rawInputs[i] : null
        }))
      });
      navigate(`/groups/${groupId}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save this expense.");
    }
  }

  if (members.isLoading || group.isLoading) return <Spinner label="Loading group" />;

  return (
    <div className="flex flex-col gap-5">
      <Link to={`/groups/${groupId}`} className="inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900">
        <ChevronLeft size={16} aria-hidden />
        {group.data?.name ?? "Back"}
      </Link>

      <h1 className="text-xl font-semibold text-slate-900">Add an expense</h1>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {error && <Alert>{error}</Alert>}

        <Card className="flex flex-col gap-4">
          <Field
            label="Description"
            required
            maxLength={140}
            placeholder="Dinner at Britannia, cab to airport…"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
          <Field
            label={`Amount (${currency})`}
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0.01"
            required
            placeholder="0.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
          <SelectField label="Category" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
            <option value="">Uncategorised</option>
            {categories.data?.map((category) => (
              <option key={category.id} value={category.id}>
                {category.icon} {category.name}
              </option>
            ))}
          </SelectField>
          <Field label="Date" type="date" value={expenseDate} onChange={(e) => setExpenseDate(e.target.value)} />
          <SelectField label="Paid by" value={paidBy} onChange={(e) => setPaidBy(e.target.value)}>
            {roster.map((member) => (
              <option key={member.user_id} value={member.user_id}>
                {member.user_id === myId ? "You" : member.profile.display_name}
              </option>
            ))}
          </SelectField>
        </Card>

        <Card className="flex flex-col gap-4">
          <div>
            <span className="mb-1.5 block text-sm font-medium text-slate-700">Split</span>
            <div className="flex flex-wrap gap-2">
              {METHODS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  aria-pressed={method === option.value}
                  onClick={() => setMethod(option.value)}
                  className={
                    method === option.value
                      ? "rounded-lg border-2 border-brand-600 bg-brand-50 px-3 py-1.5 text-sm font-medium text-brand-800"
                      : "rounded-lg border border-slate-300 bg-card px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
                  }
                >
                  {option.label}
                </button>
              ))}
            </div>
            <p className="mt-2 text-xs text-slate-500">{METHODS.find((m) => m.value === method)?.hint}</p>
          </div>

          <ul className="flex flex-col divide-y divide-slate-100">
            {roster.map((member) => {
              const isIn = Boolean(selected[member.user_id]);
              const index = participants.findIndex((p) => p.user_id === member.user_id);
              const shareMinor = index >= 0 ? preview.shares[index] ?? 0 : 0;

              return (
                <li key={member.user_id} className="flex items-center gap-3 py-2.5">
                  <input
                    type="checkbox"
                    id={`member-${member.user_id}`}
                    checked={isIn}
                    onChange={(e) => setSelected((prev) => ({ ...prev, [member.user_id]: e.target.checked }))}
                    className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                  />
                  <label htmlFor={`member-${member.user_id}`} className="min-w-0 flex-1 truncate text-sm text-slate-800">
                    {member.user_id === myId ? "You" : member.profile.display_name}
                  </label>

                  {isIn && method !== "equal" && (
                    <input
                      type="number"
                      inputMode="decimal"
                      step={method === "shares" ? "1" : "0.01"}
                      min="0"
                      aria-label={`${method} value for ${member.profile.display_name}`}
                      value={inputs[member.user_id] ?? ""}
                      onChange={(e) => setInputs((prev) => ({ ...prev, [member.user_id]: e.target.value }))}
                      placeholder={method === "percent" ? "%" : method === "shares" ? "1" : "0.00"}
                      className="w-24 rounded-lg border border-slate-300 px-2 py-1.5 text-right text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
                    />
                  )}

                  <span
                    className={
                      isIn
                        ? "w-24 text-right text-sm font-medium tabular-nums text-slate-900"
                        : "w-24 text-right text-sm tabular-nums text-slate-300"
                    }
                  >
                    {isIn ? formatMoney(shareMinor, currency) : "—"}
                  </span>
                </li>
              );
            })}
          </ul>

          {validation ? (
            <Alert tone="error">{validation}</Alert>
          ) : (
            <Alert tone="success">
              Splits to exactly {formatMoney(totalMinor, currency)} across {participants.length}{" "}
              {participants.length === 1 ? "person" : "people"}.
            </Alert>
          )}
        </Card>

        <Button type="submit" disabled={createExpense.isPending || Boolean(validation)}>
          {createExpense.isPending ? "Saving…" : "Save expense"}
        </Button>
      </form>
    </div>
  );
}
