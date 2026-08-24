import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  console.warn("Supabase env vars missing. Copy .env.example to .env and fill in your project credentials.");
}

export const supabase = createClient(url ?? "", anonKey ?? "", {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    // PKCE, not the v2 default implicit flow: implicit returns the real access and refresh
    // tokens in the URL fragment, where they end up in history, screenshots and referrers.
    // PKCE returns a single-use code that is exchanged for the session instead.
    flowType: "pkce"
  }
});

export const isSupabaseConfigured = Boolean(url && anonKey);
