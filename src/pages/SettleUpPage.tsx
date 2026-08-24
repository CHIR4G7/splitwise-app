import { ChevronLeft } from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Alert, Button, Card, Field, SelectField, Spinner } from "@/components/ui";
import { useSettleUp, useSimplifiedDebts } from "@/features/expenses/api";
import { useGroup, useGroupMembers } from "@/features/groups/api";
import { useAuth } from "@/lib/auth";
import { formatMoney, toMajor, toMinor } from "@/lib/money";

export function SettleUpPage() {
  const { groupId } = useParams<{ groupId: string }>();
  const { session } = useAuth();
  const navigate = useNavigate();
  const myId = session?.user.id;

  const group = useGroup(groupId);
  const members = useGroupMembers(groupId);
  const debts = useSimplifiedDebts(groupId);
  const settleUp = useSettleUp(groupId!);

  const currency = group.data?.default_currency ?? "INR";

  const [toUser, setToUser] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  const others = useMemo(
    () => (members.data ?? []).filter((m) => m.user_id !== myId),
    [members.data, myId]
  );

  // Pre-fill from the simplified plan: what I owe, to whom.
  const myDebts = useMemo(
    () => (debts.data ?? []).filter((d) => d.from_user === myId),
    [debts.data, myId]
  );

  useEffect(() => {
    if (toUser || myDebts.length === 0) return;
    setToUser(myDebts[0].to_user);
    setAmount(String(toMajor(myDebts[0].amount_minor)));
  }, [myDebts, toUser]);

  const nameFor = useMemo(() => {
    const map = new Map(members.data?.map((m) => [m.user_id, m.profile.display_name]) ?? []);
    return (userId: string) => map.get(userId) ?? "Someone";
  }, [members.data]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    const amountMinor = toMinor(amount || "0");
    if (!toUser) {
      setError("Choose who you're paying.");
      return;
    }
    if (!Number.isFinite(amountMinor) || amountMinor <= 0) {
      setError("Enter an amount greater than zero.");
      return;
    }

    try {
      await settleUp.mutateAsync({ toUser, amountMinor, note: note.trim() || undefined });
      navigate(`/groups/${groupId}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not record this payment.");
    }
  }

  if (members.isLoading || group.isLoading) return <Spinner label="Loading group" />;

  return (
    <div className="flex flex-col gap-5">
      <Link to={`/groups/${groupId}`} className="inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900">
        <ChevronLeft size={16} aria-hidden />
        {group.data?.name ?? "Back"}
      </Link>

      <h1 className="text-xl font-semibold text-slate-900">Settle up</h1>

      {myDebts.length > 0 && (
        <Card>
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">Suggested</h2>
          <ul className="flex flex-col gap-2">
            {myDebts.map((debt) => (
              <li key={debt.to_user}>
                <button
                  type="button"
                  onClick={() => {
                    setToUser(debt.to_user);
                    setAmount(String(toMajor(debt.amount_minor)));
                  }}
                  className="flex w-full items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-left text-sm hover:border-brand-300 hover:bg-brand-50"
                >
                  <span className="flex-1">
                    Pay <span className="font-medium">{nameFor(debt.to_user)}</span>
                  </span>
                  <span className="font-medium tabular-nums">{formatMoney(debt.amount_minor, currency)}</span>
                </button>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {error && <Alert>{error}</Alert>}
        <Card className="flex flex-col gap-4">
          <SelectField label="You paid" value={toUser} onChange={(e) => setToUser(e.target.value)}>
            <option value="">Choose someone…</option>
            {others.map((member) => (
              <option key={member.user_id} value={member.user_id}>
                {member.profile.display_name}
              </option>
            ))}
          </SelectField>
          <Field
            label={`Amount (${currency})`}
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0.01"
            required
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
          <Field
            label="Note (optional)"
            maxLength={140}
            placeholder="UPI, cash, bank transfer…"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </Card>
        <Button type="submit" disabled={settleUp.isPending}>
          {settleUp.isPending ? "Recording…" : "Record payment"}
        </Button>
      </form>
    </div>
  );
}
