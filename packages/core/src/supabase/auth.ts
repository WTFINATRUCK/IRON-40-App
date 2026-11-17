import "server-only";
import type { AppName } from "../env";
import { createClient, type Who } from "./server";

export type FormState = { error?: string; ok?: string } | undefined;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function readCredentials(form: FormData) {
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");
  if (!EMAIL.test(email) || email.length > 254) return { error: "Enter a valid email." } as const;
  if (password.length < 10 || password.length > 128) return { error: "Passwords are 10 to 128 characters." } as const;
  return { email, password } as const;
}

// Signs in, then refuses accounts that belong to a different app (e.g. a driver on the customer app).
// The same message is used for every failure so the form can't be used to discover which emails exist.
export async function passwordSignIn(app: AppName, form: FormData, allowed: Who["kind"][]): Promise<FormState> {
  const creds = readCredentials(form);
  if ("error" in creds) return { error: "Email or password is incorrect." };
  const supabase = await createClient(app);
  const { error } = await supabase.auth.signInWithPassword(creds);
  if (error) {
    return { error: error.status === 429 ? "Too many attempts. Wait a few minutes." : "Email or password is incorrect." };
  }
  const { data } = await supabase.rpc("whoami");
  const kind = (data as Who | null)?.kind ?? null;
  if (!allowed.includes(kind)) {
    await supabase.auth.signOut();
    return { error: "This account can't sign in here." };
  }
  return undefined;
}

export async function signOut(app: AppName) {
  const supabase = await createClient(app);
  await supabase.auth.signOut();
}

export function siteUrl() {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL;
  if (explicit) return explicit.replace(/\/$/, "");
  const prod = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (prod) return `https://${prod}`;
  return "http://localhost:3000";
}
