import { useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { AuthDivider, GoogleButton } from "@/components/GoogleButton";
import { Alert, Button, Field } from "@/components/ui";
import { signUp } from "@/lib/auth";
import { AuthLayout } from "@/pages/AuthLayout";

export function SignupPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const redirectTo = params.get("next") ?? "/groups";
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await signUp(email, password, displayName);
      // With email confirmation on, there is no session yet — tell the user to check their inbox.
      navigate(redirectTo, { replace: true });
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Could not create your account.";
      if (message.toLowerCase().includes("confirm")) {
        setNotice("Check your inbox to confirm your email, then sign in.");
      } else {
        setError(message);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthLayout title="Create your account" subtitle="Split expenses without the spreadsheet.">
      <GoogleButton next={redirectTo} label="Sign up with Google" />
      <AuthDivider />
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {error && <Alert>{error}</Alert>}
        {notice && <Alert tone="success">{notice}</Alert>}
        <Field
          label="Display name"
          autoComplete="name"
          required
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
        />
        <Field
          label="Email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <Field
          label="Password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          hint="At least 8 characters."
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <Button type="submit" block disabled={busy}>
          {busy ? "Creating account…" : "Create account"}
        </Button>
      </form>
      <p className="mt-5 text-center text-sm text-slate-600">
        Already have an account?{" "}
        <Link to={`/login?next=${encodeURIComponent(redirectTo)}`} className="font-medium text-brand-700 hover:underline">
          Sign in
        </Link>
      </p>
    </AuthLayout>
  );
}
