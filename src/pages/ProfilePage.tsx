import { useState, type FormEvent } from "react";
import { InstallCard } from "@/components/InstallCard";
import { Alert, Avatar, Button, Card, Field, SelectField, Spinner } from "@/components/ui";
import { signOut, useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";

const CURRENCIES = ["INR", "USD", "EUR", "GBP", "AUD", "SGD"];

export function ProfilePage() {
  const { profile } = useAuth();
  const [displayName, setDisplayName] = useState(profile?.display_name ?? "");
  const [currency, setCurrency] = useState(profile?.default_currency ?? "INR");
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!profile) return <Spinner label="Loading profile" />;

  async function handleSave(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setStatus(null);
    setBusy(true);
    const { error: updateError } = await supabase
      .from("profiles")
      .update({ display_name: displayName.trim(), default_currency: currency })
      .eq("id", profile!.id);
    setBusy(false);
    if (updateError) setError(updateError.message);
    else setStatus("Profile saved.");
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-3">
        <Avatar name={profile.display_name} url={profile.avatar_url} size={48} />
        <h1 className="text-2xl font-semibold text-slate-900">Profile</h1>
      </div>

      <Card>
        <form onSubmit={handleSave} className="flex flex-col gap-4">
          {error && <Alert>{error}</Alert>}
          {status && <Alert tone="success">{status}</Alert>}
          <Field label="Email" value={profile.email} disabled readOnly />
          <Field
            label="Display name"
            required
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
          />
          <SelectField label="Default currency" value={currency} onChange={(e) => setCurrency(e.target.value)}>
            {CURRENCIES.map((code) => (
              <option key={code} value={code}>
                {code}
              </option>
            ))}
          </SelectField>
          <Button type="submit" disabled={busy}>
            {busy ? "Saving…" : "Save changes"}
          </Button>
        </form>
      </Card>

      <InstallCard />

      <Button variant="secondary" onClick={() => signOut()}>
        Sign out
      </Button>
    </div>
  );
}
