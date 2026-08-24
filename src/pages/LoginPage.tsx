import { useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { AuthDivider, GoogleButton } from "@/components/GoogleButton";
import { Alert, Button, Field } from "@/components/ui";
import { signIn } from "@/lib/auth";
import { AuthLayout } from "@/pages/AuthLayout";

export function LoginPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const redirectTo = params.get("next") ?? "/groups";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await signIn(email, password);
      navigate(redirectTo, { replace: true });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not sign in.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthLayout title="Welcome back" subtitle="Sign in to see your groups and balances.">
      <GoogleButton next={redirectTo} label="Continue with Google" />
      <AuthDivider />
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
        <Field
          label="Password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <Button type="submit" block disabled={busy}>
          {busy ? "Signing in…" : "Sign in"}
        </Button>
      </form>
      <div className="mt-5 flex flex-col gap-2 text-center text-sm text-slate-600">
        <Link to="/forgot-password" className="text-brand-700 hover:underline">
          Forgot your password?
        </Link>
        <span>
          New here?{" "}
          <Link to={`/signup?next=${encodeURIComponent(redirectTo)}`} className="font-medium text-brand-700 hover:underline">
            Create an account
          </Link>
        </span>
      </div>
    </AuthLayout>
  );
}
