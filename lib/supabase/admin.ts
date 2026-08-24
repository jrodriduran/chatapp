import { createClient } from "@supabase/supabase-js";

// SERVER-ONLY: never import this in client components.
// Uses the service role key which bypasses RLS.
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}