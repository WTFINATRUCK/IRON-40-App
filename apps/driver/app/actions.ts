"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { errorMessage } from "@iron40/core/format";
import { passwordSignIn, readCredentials, signOut, siteUrl, type FormState } from "@iron40/core/supabase/auth";
import { safeNext } from "@iron40/core/supabase/proxy";
import { createClient, whoami } from "@iron40/core/supabase/server";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const coord = (v: unknown, max: number) => (typeof v === "number" && Number.isFinite(v) && Math.abs(v) <= max ? v : null);

export async function signInAction(_: FormState, form: FormData): Promise<FormState> {
  // A brand-new account (kind null) may sign in so it can redeem its invite code.
  const r = await passwordSignIn("driver", form, [null, "driver"]);
  if (r?.error) return r;
  redirect(safeNext(form.get("next"), "/"));
}

export async function joinAction(_: FormState, form: FormData): Promise<FormState> {
  const creds = readCredentials(form);
  if ("error" in creds) return { error: creds.error };
  const supabase = await createClient("driver");
  const { data, error } = await supabase.auth.signUp({ ...creds, options: { emailRedirectTo: `${siteUrl()}/auth/confirm` } });
  if (error?.status === 429) return { error: "Too many sign-ups right now. Try again in a few minutes." };
  if (data?.session) redirect("/");
  return { ok: "Check your email to confirm, then sign in and enter your invite code." };
}

export async function redeemAction(_: FormState, form: FormData): Promise<FormState> {
  const { supabase, user } = await whoami("driver");
  if (!user) return { error: errorMessage("not_authenticated") };
  const code = String(form.get("code") ?? "").slice(0, 20);
  const name = String(form.get("name") ?? "").trim().slice(0, 40);
  const phone = String(form.get("phone") ?? "").trim().slice(0, 20);
  const vehicle = String(form.get("vehicle") ?? "").trim().slice(0, 80);
  if (name.length < 2) return { error: "Enter the name customers will see." };
  if (!/^\+?[0-9 ()-]{7,20}$/.test(phone)) return { error: "Enter a valid phone number." };
  const { error } = await supabase.rpc("redeem_driver_invite", {
    p_code: code,
    p_display_name: name,
    p_phone: phone,
    p_vehicle: vehicle,
  });
  if (error) return { error: error.code === "23514" ? "Check your details and try again." : errorMessage(error) };
  redirect("/");
}

export async function signOutAction() {
  await signOut("driver");
  redirect("/login");
}

export async function setOnline(online: boolean, lat?: number, lng?: number): Promise<string | null> {
  const { supabase, user } = await whoami("driver");
  if (!user) return errorMessage("not_authenticated");
  const { error } = await supabase.rpc("driver_set_status", {
    p_online: online,
    p_lat: online ? coord(lat, 90) : null,
    p_lng: online ? coord(lng, 180) : null,
  });
  if (error) return errorMessage(error);
  revalidatePath("/");
  return null;
}

export async function ping(lat: number, lng: number): Promise<void> {
  const la = coord(lat, 90);
  const ln = coord(lng, 180);
  if (la == null || ln == null) return;
  const { supabase, user } = await whoami("driver");
  if (!user) return;
  await supabase.rpc("driver_ping", { p_lat: la, p_lng: ln });
}

export async function advance(orderId: string, status: "en_route" | "arrived"): Promise<string | null> {
  if (!UUID.test(orderId) || (status !== "en_route" && status !== "arrived")) return errorMessage("not_found");
  const { supabase } = await whoami("driver");
  const { error } = await supabase.rpc("driver_advance_order", { p_order: orderId, p_status: status });
  revalidatePath(`/orders/${orderId}`);
  return error ? errorMessage(error) : null;
}

export async function complete(_: FormState, form: FormData): Promise<FormState> {
  const orderId = String(form.get("order") ?? "");
  const year = Number(form.get("birth_year"));
  if (form.get("photo_match") !== "on" || form.get("not_expired") !== "on") {
    return { error: "Confirm the photo matches and the ID isn't expired." };
  }
  if (!UUID.test(orderId) || !Number.isInteger(year) || year < 1900 || year > new Date().getFullYear()) {
    return { error: "Enter the 4-digit birth year printed on the ID." };
  }
  const { supabase } = await whoami("driver");
  const { data, error } = await supabase.rpc("driver_complete_order", { p_order: orderId, p_birth_year: year });
  if (error) return { error: errorMessage(error) };
  const r = data as { ok: boolean; failed?: boolean; attempts_left?: number };
  revalidatePath(`/orders/${orderId}`);
  if (r.ok) return { ok: "Delivered. Hand over the order." };
  if (r.failed) return { error: "ID didn't match three times. The order is marked not delivered — keep the items." };
  return { error: `That doesn't match the verified ID. Do not hand over the order. ${r.attempts_left} tries left.` };
}

export async function fail(_: FormState, form: FormData): Promise<FormState> {
  const orderId = String(form.get("order") ?? "");
  const reason = String(form.get("reason") ?? "").trim().slice(0, 200);
  if (!UUID.test(orderId)) return { error: errorMessage("not_found") };
  const { supabase } = await whoami("driver");
  const { error } = await supabase.rpc("driver_fail_order", { p_order: orderId, p_reason: reason });
  if (error) return { error: errorMessage(error) };
  revalidatePath("/");
  redirect("/");
}
