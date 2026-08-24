import { useEffect, useState } from "react";
import { Link, Navigate, useSearchParams } from "react-router-dom";
import { Alert, Button, Spinner } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { AuthLayout } from "@/pages/AuthLayout";

/**
 * Where Google sends the browser back to. supabase-js exchanges the code in the URL on its own
 * (detectSessionInUrl), so this page only waits for the session to appear and then forwards to
 * wherever the user was headed — which keeps invite links working through a Google sign-in.
 */
export function AuthCallbackPage() {
  const { session, loading } = useAuth();
  const [params] = useSearchParams();
  const [timedOut, setTimedOut] = useState(false);

  const next = params.get("next") ?? "/groups";
  // Supabase forwards provider failures as query params rather than throwing.
  const providerError = params.get("error_description") ?? params.get("error");

  useEffect(() => {
    if (session || providerError) return;
    const timer = window.setTimeout(() => setTimedOut(true), 8000);
    return () => window.clearTimeout(timer);
  }, [session, providerError]);

  if (session) return <Navigate to={next} replace />;

  if (providerError || timedOut) {
    return (
      <AuthLayout title="Sign-in didn't complete" subtitle="Nothing was changed on your account.">
        <div className="flex flex-col gap-4">
          <Alert>
            {providerError ?? "Google didn't send us back a session. This usually means the redirect URL isn't allow-listed in Supabase."}
          </Alert>
          <Link to={`/login?next=${encodeURIComponent(next)}`}>
            <Button variant="secondary" block>
              Back to sign in
            </Button>
          </Link>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Signing you in" subtitle="One moment while we finish up with Google.">
      <Spinner label={loading ? "Checking your session" : "Almost there"} />
    </AuthLayout>
  );
}
