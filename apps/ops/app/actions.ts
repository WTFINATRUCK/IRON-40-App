"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { errorMessage } from "@iron40/core/format";
import { passwordSignIn, readCredentials, signOut, siteUrl, type FormState } from "@iron40/core/supabase/auth";
import { safeNext } from "@iron40/core/supabase/proxy";
import { createClient, whoami } from "@iron40/core/supabase/server";
import { requireStaff, UUID } from "./lib";

const s = (f: FormData, k: string, max = 200) => String(f.get(k) ?? "").trim().slice(0, max);
const n = (f: FormData, k: string) => {
  const v = String(f.get(k) ?? "").trim();
  return v === "" ? null : Number(v);
};
const done = (path: string, ok = "Saved."): FormState => {
  revalidatePath(path);
  return { ok };
};
const fail = (e: unknown): FormState => ({ error: errorMessage(e) });

// ---------- auth ----------
export async function signInAction(_: FormState, form: FormData): Promise<FormState> {
  const r = await passwordSignIn("ops", form, [null, "staff"]);
  if (r?.error) return r;
  redirect(safeNext(form.get("next"), "/"));
}

export async function joinAction(_: FormState, form: FormData): Promise<FormState> {
  const creds = readCredentials(form);
  if ("error" in creds) return { error: creds.error };
  const supabase = await createClient("ops");
  const { data, error } = await supabase.auth.signUp({ ...creds, options: { emailRedirectTo: `${siteUrl()}/auth/confirm` } });
  if (error?.status === 429) return { error: "Too many sign-ups right now. Try again in a few minutes." };
  if (data?.session) redirect("/");
  return { ok: "Check your email to confirm, then sign in and enter your invite code." };
}

export async function redeemAction(_: FormState, form: FormData): Promise<FormState> {
  const { supabase, user } = await whoami("ops");
  if (!user) return fail("not_authenticated");
  const { error } = await supabase.rpc("redeem_staff_invite", { p_code: s(form, "code", 20), p_name: s(form, "name", 80) });
  if (error) return fail(error);
  redirect("/");
}

export async function signOutAction() {
  await signOut("ops");
  redirect("/login");
}

// ---------- orders ----------
export async function dispatchAction(form: FormData) {
  const { supabase } = await requireStaff();
  const id = s(form, "order", 36);
  await supabase.rpc("ops_dispatch", { p_order: UUID.test(id) ? id : null });
  revalidatePath("/");
  revalidatePath("/orders");
  if (UUID.test(id)) revalidatePath(`/orders/${id}`);
}

export async function cancelOrderAction(_: FormState, form: FormData): Promise<FormState> {
  const { supabase } = await requireStaff();
  const id = s(form, "order", 36);
  if (!UUID.test(id)) return fail("not_found");
  const { error } = await supabase.rpc("ops_cancel_order", { p_order: id, p_reason: s(form, "reason") });
  return error ? fail(error) : done(`/orders/${id}`, "Order canceled.");
}

// ---------- ID review ----------
export async function reviewAction(_: FormState, form: FormData): Promise<FormState> {
  const { supabase } = await requireStaff();
  const id = s(form, "customer", 36);
  const approve = form.get("decision") === "approve";
  if (!UUID.test(id)) return fail("not_found");
  if (approve && (form.get("matches") !== "on" || form.get("valid") !== "on")) {
    return { error: "Confirm the name/date of birth match and the ID is valid." };
  }
  const { error } = await supabase.rpc("ops_review_customer", {
    p_user: id,
    p_approve: approve,
    p_reason: approve ? null : s(form, "reason"),
  });
  return error ? fail(error) : done("/verifications", approve ? "Approved." : "Rejected.");
}

// ---------- drivers ----------
export async function inviteAction(_: FormState, form: FormData): Promise<FormState> {
  const { supabase } = await requireStaff(["owner", "admin"]);
  const kind = s(form, "kind", 20);
  if (!["driver", "dispatcher", "admin"].includes(kind)) return fail("forbidden");
  const { data, error } = await supabase.rpc("ops_create_invite", { p_kind: kind, p_label: s(form, "label", 80) });
  if (error) return fail(error);
  revalidatePath("/drivers");
  revalidatePath("/settings");
  return { ok: String(data) };
}

export async function revokeInviteAction(form: FormData) {
  const { supabase } = await requireStaff(["owner", "admin"]);
  const id = s(form, "id", 36);
  if (UUID.test(id)) await supabase.rpc("ops_revoke_invite", { p_id: id });
  revalidatePath("/drivers");
  revalidatePath("/settings");
}

export async function driverActiveAction(_: FormState, form: FormData): Promise<FormState> {
  const { supabase } = await requireStaff(["owner", "admin"]);
  const id = s(form, "driver", 36);
  if (!UUID.test(id)) return fail("not_found");
  const { error } = await supabase.rpc("ops_set_driver_active", { p_driver: id, p_active: form.get("active") === "true" });
  return error ? fail(error) : done(`/drivers/${id}`);
}

export async function transferAction(_: FormState, form: FormData): Promise<FormState> {
  const { supabase } = await requireStaff();
  const driver = s(form, "driver", 36);
  const location = s(form, "location", 36);
  const product = s(form, "product", 36);
  const qty = Math.trunc(Number(form.get("qty")));
  const dir = form.get("direction") === "unload" ? -1 : 1;
  if (![driver, location, product].every((x) => UUID.test(x))) return fail("not_found");
  if (!Number.isFinite(qty) || qty <= 0 || qty > 1000) return fail("invalid_qty");
  const { error } = await supabase.rpc("ops_transfer_stock", {
    p_driver: driver,
    p_location: location,
    p_product: product,
    p_qty: qty * dir,
  });
  return error ? fail(error) : done(`/drivers/${driver}`, dir > 0 ? "Loaded." : "Unloaded.");
}

// ---------- catalog & stock ----------
export async function productAction(_: FormState, form: FormData): Promise<FormState> {
  const { supabase } = await requireStaff(["owner", "admin"]);
  const id = s(form, "id", 36);
  const category = s(form, "category", 20);
  if (!["flower", "concentrate", "gear"].includes(category)) return { error: "Choose a category." };
  const price = Math.round(Number(form.get("price")) * 100);
  if (!Number.isFinite(price) || price <= 0) return { error: "Enter a price." };
  const isGear = category === "gear";
  const { data, error } = await supabase.rpc("ops_upsert_product", {
    p_id: UUID.test(id) ? id : null,
    p_category: category,
    p_subcategory: s(form, "subcategory", 40),
    p_name: s(form, "name", 80),
    p_description: s(form, "description", 400),
    p_strain: isGear ? null : s(form, "strain", 10) || null,
    p_thc_pct: isGear ? null : n(form, "thc_pct"),
    p_weight_g: isGear ? null : n(form, "weight_g"),
    p_price_cents: price,
    p_sort: n(form, "sort") ?? 100,
    p_active: form.get("active") === "on",
  });
  if (error) return { error: error.code === "23514" ? "Check the fields: cannabis needs a weight, gear can't have THC." : errorMessage(error) };
  revalidatePath("/products");
  redirect(`/products/${data}`);
}

export async function stockAction(_: FormState, form: FormData): Promise<FormState> {
  const { supabase } = await requireStaff(["owner", "admin"]);
  const location = s(form, "location", 36);
  const product = s(form, "product", 36);
  const qty = Math.trunc(Number(form.get("qty")));
  if (!UUID.test(location) || !UUID.test(product)) return fail("not_found");
  const { error } = await supabase.rpc("ops_set_location_stock", { p_location: location, p_product: product, p_qty: qty });
  return error ? fail(error) : done("/inventory", "Updated.");
}

export async function locationAction(_: FormState, form: FormData): Promise<FormState> {
  const { supabase } = await requireStaff(["owner", "admin"]);
  const id = s(form, "id", 36);
  const lat = n(form, "lat");
  const lng = n(form, "lng");
  const radius = n(form, "radius_km");
  if (lat == null || lng == null || Math.abs(lat) > 90 || Math.abs(lng) > 180) return { error: "Set the hub's coordinates." };
  if (radius == null || radius < 1 || radius > 150) return { error: "Delivery radius is 1 to 150 km." };
  const { error } = await supabase.rpc("ops_upsert_location", {
    p_id: UUID.test(id) ? id : null,
    p_name: s(form, "name", 80),
    p_address: s(form, "address", 200),
    p_lat: lat,
    p_lng: lng,
    p_radius_km: radius,
    p_active: form.get("active") === "on",
  });
  return error ? fail(error) : done("/locations");
}

// ---------- marketing ----------
export async function qrAction(_: FormState, form: FormData): Promise<FormState> {
  const { supabase } = await requireStaff(["owner", "admin"]);
  const label = s(form, "label", 60);
  if (label.length < 2) return { error: "Name the campaign, e.g. “Laundromat flyer, 5th Ave”." };
  const { data, error } = await supabase.rpc("ops_create_qr", { p_label: label, p_placement: s(form, "placement", 120) });
  if (error) return fail(error);
  revalidatePath("/marketing");
  redirect(`/marketing/${data}`);
}

// ---------- settings ----------
export async function settingsAction(_: FormState, form: FormData): Promise<FormState> {
  const { supabase } = await requireStaff(["owner", "admin"]);
  const pct = (k: string) => Number(form.get(k)) / 100;
  const { error } = await supabase.rpc("ops_update_settings", {
    p_name: s(form, "name", 80),
    p_license_number: s(form, "license_number", 60),
    p_license_state: s(form, "license_state", 2),
    p_timezone: s(form, "timezone", 60),
    p_open_hour: Number(form.get("open_hour")),
    p_close_hour: Number(form.get("close_hour")),
    p_excise_rate: pct("excise_pct"),
    p_sales_tax_rate: pct("sales_tax_pct"),
    p_delivery_fee_cents: Math.round(Number(form.get("delivery_fee")) * 100),
    p_min_order_cents: Math.round(Number(form.get("min_order")) * 100),
    p_max_flower_g: Number(form.get("max_flower_g")),
    p_max_concentrate_g: Number(form.get("max_concentrate_g")),
  });
  if (error) return { error: error.code === "23514" ? "One of the values is out of range." : errorMessage(error) };
  return done("/settings");
}
