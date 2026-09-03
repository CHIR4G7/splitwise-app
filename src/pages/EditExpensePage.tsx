import { ChevronLeft, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Alert, Button, Card, Field, SelectField, Spinner } from "@/components/ui";
import { useCategories, useDeleteExpense, useExpense, useUpdateExpense } from "@/features/expenses/api";
import { useGroup, useGroupMembers } from "@/features/groups/api";
import { useAuth } from "@/lib/auth";
import { getLocalDateString, getYesterdayDateString } from "@/lib/date";
import { computeShares, formatMoney, reconciliationError, toMajor, toMinor } from "@/lib/money";
import type { SplitMethod } from "@/types/models";

const METHODS: { value: SplitMethod; label: string; hint: string }[] = [
  { value: "equal", label: "Equally", hint: "Split evenly between everyone selected." },
  { value: "exact", label: "Exact amounts", hint: "Type what each person owes." },
  { value: "percent", label: "Percentages", hint: "Must add up to 100%." },
  { value: "shares", label: "Shares", hint: "Relative weights, e.g. 2 : 1 : 1." }
];

export function EditExpensePage() {
  const { groupId, expenseId } = useParams<{ groupId: string; expenseId: string }>();
  const { session } = useAuth();
  const navigate = useNavigate();

  const group = useGroup(groupId);
  const members = useGroupMembers(groupId);
  const categories = useCategories(groupId);
  const expenseQuery = useExpense(groupId, expenseId);
  const updateExpense = useUpdateExpense(groupId!);
  const deleteExpense = useDeleteExpense(groupId!);

  const currency = group.data?.default_currency ?? "INR";
  const myId = session?.user.id;

  const todayStr = useMemo(() => getLocalDateString(), []);
  const yesterdayStr = useMemo(() => getYesterdayDateString(), []);

  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [expenseDate, setExpenseDate] = useState(() => getLocalDateString());
  const [paidBy, setPaidBy] = useState("");
  const [method, setMethod] = useState<SplitMethod>("equal");
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [inputs, setInputs] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  const roster = useMemo(() => members.data ?? [], [members.data]);
  const expense = expenseQuery.data;

  // Initialize form when expense data loads
  useEffect(() => {
    if (!expense || isInitialized) return;

    setDescription(expense.description);
    setAmount(toMajor(expense.total_amount_minor).toString());
    setCategoryId(expense.category_id ?? "");
    setExpenseDate(expense.expense_date?.slice(0, 10) ?? getLocalDateString());
    setPaidBy(expense.payers[0]?.user_id ?? myId ?? "");
    setMethod(expense.split_method);

    const selectedMap: Record<string, boolean> = {};
    const inputsMap: Record<string, string> = {};

    for (const share of expense.shares) {
      selectedMap[share.user_id] = true;
      if (expense.split_method === "exact") {
        inputsMap[share.user_id] = toMajor(share.share_amount_minor).toString();
      } else if (expense.split_method === "percent" && share.share_percent != null) {
        inputsMap[share.user_id] = share.share_percent.toString();
      } else if (expense.split_method === "shares" && share.share_units != null) {
        inputsMap[share.user_id] = share.share_units.toString();
      }
    }

    setSelected(selectedMap);
    setInputs(inputsMap);
    setIsInitialized(true);
  }, [expense, isInitialized, myId]);

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

    const finalDate = expenseDate.trim() || getLocalDateString();

    try {
      await updateExpense.mutateAsync({
        expenseId: expenseId!,
        description,
        totalMinor,
        splitMethod: method,
        categoryId: categoryId || null,
        expenseDate: finalDate,
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
      setError(cause instanceof Error ? cause.message : "Could not update this expense.");
    }
  }

  async function handleDelete() {
    if (!window.confirm("Are you sure you want to delete this expense?")) return;
    try {
      await deleteExpense.mutateAsync(expenseId!);
      navigate(`/groups/${groupId}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not delete this expense.");
    }
  }

  if (members.isLoading || group.isLoading || expenseQuery.isLoading) {
    return <Spinner label="Loading expense" />;
  }

  if (expenseQuery.isError || (!expenseQuery.isLoading && !expense)) {
    return (
      <div className="flex flex-col gap-4">
        <Alert>This expense was not found or could not be loaded.</Alert>
        <Link to={`/groups/${groupId}`}>
          <Button variant="secondary">Back to group</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5 pb-8">
      <div className="flex items-center justify-between">
        <Link to={`/groups/${groupId}`} className="inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900">
          <ChevronLeft size={16} aria-hidden />
          {group.data?.name ?? "Back"}
        </Link>
        <button
          type="button"
          onClick={handleDelete}
          disabled={deleteExpense.isPending}
          aria-label="Delete expense"
          className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-sm text-red-600 hover:bg-red-50 transition"
        >
          <Trash2 size={16} aria-hidden />
          Delete
        </button>
      </div>

      <h1 className="text-xl font-semibold text-slate-900">Edit expense</h1>

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

          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-sm font-medium text-slate-700">Date</span>
              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={() => setExpenseDate(todayStr)}
                  className={`rounded-md px-2 py-0.5 text-xs font-medium transition ${
                    expenseDate === todayStr
                      ? "bg-brand-600 text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  Today
                </button>
                <button
                  type="button"
                  onClick={() => setExpenseDate(yesterdayStr)}
                  className={`rounded-md px-2 py-0.5 text-xs font-medium transition ${
                    expenseDate === yesterdayStr
                      ? "bg-brand-600 text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  Yesterday
                </button>
              </div>
            </div>
            <div className="relative">
              <input
                type="date"
                value={expenseDate}
                onChange={(e) => setExpenseDate(e.target.value)}
                onClick={(e) => {
                  try {
                    (e.currentTarget as HTMLInputElement & { showPicker?: () => void }).showPicker?.();
                  } catch {
                    // fallback
                  }
                }}
                className="w-full min-h-[44px] rounded-lg border border-slate-300 bg-card px-3 py-2.5 text-base sm:text-sm text-slate-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
              />
            </div>
            <p className="mt-1 text-xs text-slate-500">Pick any past, present, or future date for this expense.</p>
          </div>

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
            <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2">
              {METHODS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  aria-pressed={method === option.value}
                  onClick={() => setMethod(option.value)}
                  className={
                    method === option.value
                      ? "min-h-[40px] rounded-lg border-2 border-brand-600 bg-brand-50 px-3 py-1.5 text-sm font-medium text-brand-800"
                      : "min-h-[40px] rounded-lg border border-slate-300 bg-card px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
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
                    id={`edit-member-${member.user_id}`}
                    checked={isIn}
                    onChange={(e) => setSelected((prev) => ({ ...prev, [member.user_id]: e.target.checked }))}
                    className="h-5 w-5 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                  />
                  <label htmlFor={`edit-member-${member.user_id}`} className="min-w-0 flex-1 truncate text-sm text-slate-800 cursor-pointer py-1">
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
                      className="w-24 min-h-[40px] rounded-lg border border-slate-300 px-2 py-1.5 text-right text-base sm:text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
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

        <div className="flex gap-3">
          <Button type="submit" block disabled={updateExpense.isPending || Boolean(validation)}>
            {updateExpense.isPending ? "Saving…" : "Update expense"}
          </Button>
          <Link to={`/groups/${groupId}`}>
            <Button type="button" variant="ghost">
              Cancel
            </Button>
          </Link>
        </div>
      </form>
    </div>
  );
}
