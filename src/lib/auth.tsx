import type { Session } from "@supabase/supabase-js";
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { supabase } from "@/lib/supabase";
import type { Profile } from "@/types/models";

type AuthState = {
  session: Session | null;
  profile: Profile | null;
  profileError: string | null;
  loading: boolean;
};

const AuthContext = createContext<AuthState>({
  session: null,
  profile: null,
  profileError: null,
  loading: true
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      setLoading(false);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const user = session?.user;
    if (!user) {
      setProfile(null);
      setProfileError(null);
      return;
    }

    let active = true;

    async function loadProfile(userId: string) {
      const columns = "id, email, display_name, avatar_url, default_currency";
      const { data, error } = await supabase.from("profiles").select(columns).eq("id", userId).maybeSingle();

      if (!active) return;

      if (error) {
        setProfileError(error.message);
        setProfile(null);
        return;
      }

      if (data) {
        setProfile(data as Profile);
        setProfileError(null);
        return;
      }

      // No profile row: the account predates the handle_new_user trigger. Create it now so the
      // rest of the app (which foreign-keys to profiles) has something to point at.
      // Email signup sets display_name; Google returns full_name/name and picture.
      const meta = user!.user_metadata ?? {};
      const fallbackName =
        (meta.display_name as string | undefined)?.trim() ||
        (meta.full_name as string | undefined)?.trim() ||
        (meta.name as string | undefined)?.trim() ||
        user!.email?.split("@")[0] ||
        "Member";
      const fallbackAvatar =
        (meta.avatar_url as string | undefined) || (meta.picture as string | undefined) || null;

      const { data: created, error: insertError } = await supabase
        .from("profiles")
        .insert({
          id: userId,
          email: user!.email ?? "",
          display_name: fallbackName,
          avatar_url: fallbackAvatar
        })
        .select(columns)
        .single();

      if (!active) return;

      if (insertError) {
        setProfileError(insertError.message);
        setProfile(null);
      } else {
        setProfile(created as Profile);
        setProfileError(null);
      }
    }

    void loadProfile(user.id);

    return () => {
      active = false;
    };
  }, [session?.user.id]);

  const value = useMemo(
    () => ({ session, profile, profileError, loading }),
    [session, profile, profileError, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}

export async function signUp(email: string, password: string, displayName: string) {
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { display_name: displayName } }
  });
  if (error) throw error;
}

/**
 * Sends the browser to Google and back to /auth/callback, which forwards to `next`.
 * The redirect must be on the project's allow-list in Supabase → Authentication → URL Configuration.
 */
export async function signInWithGoogle(next = "/groups") {
  const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo,
      queryParams: { access_type: "offline", prompt: "consent" }
    }
  });
  if (error) throw error;
}

export async function signIn(email: string, password: string) {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
}

export async function sendPasswordReset(email: string) {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/reset-password`
  });
  if (error) throw error;
}

export async function updatePassword(password: string) {
  const { error } = await supabase.auth.updateUser({ password });
  if (error) throw error;
}

export async function signOut() {
  await supabase.auth.signOut();
}
