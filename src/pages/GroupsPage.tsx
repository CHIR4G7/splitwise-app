import { Plus, Users } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Alert, Button, Card, EmptyState, Field, SelectField, Spinner } from "@/components/ui";
import { useCreateGroup, useGroups } from "@/features/groups/api";
import { useAuth } from "@/lib/auth";

const CURRENCIES = ["INR", "USD", "EUR", "GBP", "AUD", "SGD"];
const ICONS = ["🧾", "🏠", "✈️", "🍽️", "🎬", "🏅", "🛒", "🎉"];

export function GroupsPage() {
  const { session, profileError } = useAuth();
  const navigate = useNavigate();
  const groups = useGroups();
  const createGroup = useCreateGroup();
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [icon, setIcon] = useState("🧾");
  const [currency, setCurrency] = useState("INR");
  const [error, setError] = useState<string | null>(null);

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    setError(null);

    const userId = session?.user.id;
    if (!userId) {
      setError("Your session expired. Sign in again to create a group.");
      return;
    }

    try {
      const group = await createGroup.mutateAsync({ name, icon, currency });
      setShowForm(false);
      setName("");
      navigate(`/groups/${group.id}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not create the group.");
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Groups</h1>
          <p className="text-sm text-slate-600">Shared expenses, one group at a time.</p>
        </div>
        <Button size="sm" onClick={() => setShowForm((open) => !open)}>
          <Plus size={16} aria-hidden />
          New
        </Button>
      </header>

      {showForm && (
        <Card>
          <form onSubmit={handleCreate} className="flex flex-col gap-4">
            {error && <Alert>{error}</Alert>}
            <Field
              label="Group name"
              required
              maxLength={60}
              placeholder="Goa trip, Flat 302, Sunday football…"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <div>
              <span className="mb-1.5 block text-sm font-medium text-slate-700">Icon</span>
              <div className="flex flex-wrap gap-2">
                {ICONS.map((option) => (
                  <button
                    key={option}
                    type="button"
                    aria-pressed={icon === option}
                    onClick={() => setIcon(option)}
                    className={
                      icon === option
                        ? "h-10 w-10 rounded-lg border-2 border-brand-600 bg-brand-50 text-lg"
                        : "h-10 w-10 rounded-lg border border-slate-300 bg-white text-lg hover:bg-slate-50"
                    }
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>
            <SelectField label="Default currency" value={currency} onChange={(e) => setCurrency(e.target.value)}>
              {CURRENCIES.map((code) => (
                <option key={code} value={code}>
                  {code}
                </option>
              ))}
            </SelectField>
            <div className="flex gap-2">
              <Button type="submit" disabled={createGroup.isPending}>
                {createGroup.isPending ? "Creating…" : "Create group"}
              </Button>
              <Button type="button" variant="ghost" onClick={() => setShowForm(false)}>
                Cancel
              </Button>
            </div>
          </form>
        </Card>
      )}

      {profileError && <Alert>Your profile couldn't be loaded: {profileError}</Alert>}

      {groups.isLoading && <Spinner label="Loading your groups" />}
      {groups.isError && <Alert>Could not load your groups. Check your connection and try again.</Alert>}

      {groups.data && groups.data.length === 0 && !showForm && (
        <EmptyState
          icon={<Users size={32} aria-hidden />}
          title="No groups yet"
          body="Create a group to start splitting expenses, or open an invite link someone sent you."
          action={<Button onClick={() => setShowForm(true)}>Create your first group</Button>}
        />
      )}

      <ul className="flex flex-col gap-3">
        {groups.data?.map((group) => (
          <li key={group.id}>
            <Link
              to={`/groups/${group.id}`}
              className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-brand-300 hover:shadow"
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-xl">
                {group.icon}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium text-slate-900">{group.name}</span>
                <span className="block text-xs text-slate-500">{group.default_currency}</span>
              </span>
              <span className="text-sm text-slate-400">Settled</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
