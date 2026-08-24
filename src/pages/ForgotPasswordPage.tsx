import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { Alert, Button, Field } from "@/components/ui";
import { sendPasswordReset } from "@/lib/auth";
import { AuthLayout } from "@/pages/AuthLayout";

export function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await sendPasswordReset(email);
      setSent(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not send the reset link.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthLayout title="Reset your password" subtitle="We'll email you a link to set a new one.">
      {sent ? (
        <div className="flex flex-col gap-4">
          <Alert tone="success">If an account exists for {email}, a reset link is on its way.</Alert>
          <Link to="/login">
            <Button variant="secondary" block>
              Back to sign in
            </Button>
          </Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {error && <Alert>{error}</Alert>}
          <Field
            label="Email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <Button type="submit" block disabled={busy}>
            {busy ? "Sending…" : "Send reset link"}
          </Button>
          <Link to="/login" className="text-center text-sm text-brand-700 hover:underline">
            Back to sign in
          </Link>
        </form>
      )}
    </AuthLayout>
  );
}
