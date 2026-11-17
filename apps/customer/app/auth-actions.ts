"use server";

import { redirect } from "next/navigation";
import { passwordSignIn, readCredentials, signOut, siteUrl, type FormState } from "@iron40/core/supabase/auth";
import { safeNext } from "@iron40/core/supabase/proxy";
import { createClient } from "@iron40/core/supabase/server";

export async function signInAction(_: FormState, form: FormData): Promise<FormState> {
  const result = await passwordSignIn("customer", form, [null, "customer"]);
  if (result?.error) return result;
  redirect(safeNext(form.get("next"), "/"));
}

export async function signUpAction(_: FormState, form: FormData): Promise<FormState> {
  if (form.get("adult") !== "on") return { error: "Confirm that you are 21 or older." };
  if (form.get("terms") !== "on") return { error: "Agree to the terms to continue." };
  const creds = readCredentials(form);
  if ("error" in creds) return { error: creds.error };
  const supabase = await createClient("customer");
  const { data, error } = await supabase.auth.signUp({
    ...creds,
    options: { emailRedirectTo: `${siteUrl()}/auth/confirm?next=/account` },
  });
  if (error) {
    if (error.status === 429) return { error: "Too many sign-ups right now. Try again in a few minutes." };
    if (error.code === "weak_password") return { error: "Choose a stronger password." };
    // Same message whether or not the email exists.
    return { ok: "Check your email for a link to confirm your account." };
  }
  if (data.session) redirect("/account");
  return { ok: "Check your email for a link to confirm your account." };
}

export async function signOutAction() {
  await signOut("customer");
  redirect("/");
}
