import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { env, type AppName } from "../env";
import { cookieName, hardenCookie } from "./cookies";

// Server-side Supabase client acting as the signed-in user. RLS applies to every query.
export async function createClient(app: AppName) {
  const store = await cookies();
  return createServerClient(env.supabaseUrl, env.supabaseKey, {
    cookieOptions: { name: cookieName(app) },
    cookies: {
      getAll: () => store.getAll(),
      setAll(list) {
        try {
          for (const { name, value, options } of list) store.set(name, value, hardenCookie(options));
        } catch {
          // Called from a Server Component: the proxy refreshes the session instead.
        }
      },
    },
  });
}

export type Who =
  | { kind: null }
  | { kind: "customer"; tenant_id: string; id_status: "unsubmitted" | "pending" | "approved" | "rejected"; name: string }
  | { kind: "driver"; tenant_id: string; name: string; active: boolean }
  | { kind: "staff"; tenant_id: string; role: "owner" | "admin" | "dispatcher"; name: string };

export async function whoami(app: AppName) {
  const supabase = await createClient(app);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, who: { kind: null } as Who };
  const { data } = await supabase.rpc("whoami");
  return { supabase, user, who: (data ?? { kind: null }) as Who };
}
