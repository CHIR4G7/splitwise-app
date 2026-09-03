import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { Spinner } from "@/components/ui";
import { AuthProvider, useAuth } from "@/lib/auth";
import { ForgotPasswordPage } from "@/pages/ForgotPasswordPage";
import { GroupDetailPage } from "@/pages/GroupDetailPage";
import { GroupSettingsPage } from "@/pages/GroupSettingsPage";
import { AddExpensePage } from "@/pages/AddExpensePage";
import { EditExpensePage } from "@/pages/EditExpensePage";
import { AuthCallbackPage } from "@/pages/AuthCallbackPage";
import { DevChartsPage } from "@/pages/DevChartsPage";
import { GroupsPage } from "@/pages/GroupsPage";
import { SettleUpPage } from "@/pages/SettleUpPage";
import { InsightsPage } from "@/pages/InsightsPage";
import { JoinGroupPage } from "@/pages/JoinGroupPage";
import { LoginPage } from "@/pages/LoginPage";
import { ProfilePage } from "@/pages/ProfilePage";
import { ResetPasswordPage } from "@/pages/ResetPasswordPage";
import { SignupPage } from "@/pages/SignupPage";

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, refetchOnWindowFocus: false } }
});

function RequireAuth({ children }: { children: ReactNode }) {
  const { session, loading } = useAuth();
  const location = useLocation();

  if (loading) return <Spinner label="Loading" />;
  if (!session) {
    const next = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?next=${next}`} replace />;
  }
  return <>{children}</>;
}

function RedirectIfAuthed({ children }: { children: ReactNode }) {
  const { session, loading } = useAuth();
  if (loading) return <Spinner label="Loading" />;
  if (session) return <Navigate to="/groups" replace />;
  return <>{children}</>;
}

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<RedirectIfAuthed><LoginPage /></RedirectIfAuthed>} />
            <Route path="/signup" element={<RedirectIfAuthed><SignupPage /></RedirectIfAuthed>} />
            <Route path="/auth/callback" element={<AuthCallbackPage />} />
            {import.meta.env.DEV && <Route path="/dev/charts" element={<DevChartsPage />} />}
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />
            <Route path="/join/:token" element={<RequireAuth><JoinGroupPage /></RequireAuth>} />

            <Route element={<RequireAuth><AppLayout /></RequireAuth>}>
              <Route path="/groups" element={<GroupsPage />} />
              <Route path="/groups/:groupId" element={<GroupDetailPage />} />
              <Route path="/groups/:groupId/settings" element={<GroupSettingsPage />} />
              <Route path="/groups/:groupId/expenses/new" element={<AddExpensePage />} />
              <Route path="/groups/:groupId/expenses/:expenseId/edit" element={<EditExpensePage />} />
              <Route path="/groups/:groupId/settle" element={<SettleUpPage />} />
              <Route path="/insights" element={<InsightsPage />} />
              <Route path="/profile" element={<ProfilePage />} />
            </Route>

            <Route path="*" element={<Navigate to="/groups" replace />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
