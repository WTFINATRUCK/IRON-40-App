"use server";

import { randomBytes } from "node:crypto";
import sharp from "sharp";
import { revalidatePath } from "next/cache";
import { env } from "@iron40/core/env";
import { errorMessage } from "@iron40/core/format";
import type { FormState } from "@iron40/core/supabase/auth";
import { whoami } from "@iron40/core/supabase/server";

const str = (f: FormData, k: string, max: number) => String(f.get(k) ?? "").trim().slice(0, max);

export async function saveProfile(_: FormState, form: FormData): Promise<FormState> {
  const { supabase, user, who } = await whoami("customer");
  if (!user) return { error: "Sign in to continue." };
  if (who.kind !== null && who.kind !== "customer") return { error: "This account can't be used here." };
  const full_name = str(form, "full_name", 80);
  const phone = str(form, "phone", 20);
  const dob = str(form, "dob", 10);
  if (full_name.length < 2) return { error: "Enter your full name as it appears on your ID." };
  if (!/^\+?[0-9 ()-]{7,20}$/.test(phone)) return { error: "Enter a valid phone number." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dob)) return { error: "Enter your date of birth." };
  const { error } = await supabase.rpc("upsert_customer_profile", {
    p_tenant_slug: env.tenantSlug,
    p_full_name: full_name,
    p_phone: phone,
    p_dob: dob,
  });
  if (error) return { error: errorMessage(error) };
  revalidatePath("/account");
  return { ok: "Saved." };
}

const MAX_BYTES = 8 * 1024 * 1024;

// Checks the real file signature (not the browser-supplied type), then re-encodes to a clean JPEG.
// Re-encoding strips EXIF (including GPS location) and anything hidden in the original file.
async function cleanImage(file: FormDataEntryValue | null): Promise<Buffer | null> {
  if (!(file instanceof File) || file.size === 0 || file.size > MAX_BYTES) return null;
  const buf = Buffer.from(await file.arrayBuffer());
  const jpeg = buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
  const png = buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  const webp = buf.subarray(0, 4).toString("ascii") === "RIFF" && buf.subarray(8, 12).toString("ascii") === "WEBP";
  if (!jpeg && !png && !webp) return null;
  try {
    return await sharp(buf, { limitInputPixels: 50_000_000, failOn: "error" })
      .rotate()
      .resize({ width: 2000, height: 2000, fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 85 })
      .toBuffer();
  } catch {
    return null;
  }
}

export async function submitId(_: FormState, form: FormData): Promise<FormState> {
  const { supabase, user, who } = await whoami("customer");
  if (!user || who.kind !== "customer") return { error: "Save your profile first." };
  if (who.id_status !== "unsubmitted" && who.id_status !== "rejected") return { error: errorMessage("already_submitted") };

  const [front, selfie] = await Promise.all([cleanImage(form.get("id_front")), cleanImage(form.get("selfie"))]);
  if (!front || !selfie) return { error: errorMessage("invalid_upload") };

  const folder = `${who.tenant_id}/${user.id}`;
  const frontPath = `${folder}/${randomBytes(12).toString("hex")}.jpg`;
  const selfiePath = `${folder}/${randomBytes(12).toString("hex")}.jpg`;
  const bucket = supabase.storage.from("id-docs");
  const opts = { contentType: "image/jpeg", upsert: false, cacheControl: "0" };
  const [a, b] = await Promise.all([bucket.upload(frontPath, front, opts), bucket.upload(selfiePath, selfie, opts)]);
  if (a.error || b.error) return { error: errorMessage("invalid_upload") };

  const { error } = await supabase.rpc("submit_id_verification", { p_front_path: frontPath, p_selfie_path: selfiePath });
  if (error) return { error: errorMessage(error) };
  revalidatePath("/account");
  return { ok: "ID submitted. We'll review it shortly." };
}

export async function addAddress(_: FormState, form: FormData): Promise<FormState> {
  const { supabase, user, who } = await whoami("customer");
  if (!user || who.kind !== "customer") return { error: "Save your profile first." };
  const lat = Number(form.get("lat"));
  const lng = Number(form.get("lng"));
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180 || (lat === 0 && lng === 0)) {
    return { error: "Tap “Use my current location” while you're at this address so the driver can find you." };
  }
  const state = str(form, "state", 2).toUpperCase();
  const zip = str(form, "zip", 10);
  if (!/^[A-Z]{2}$/.test(state)) return { error: "Use the 2-letter state code." };
  if (!/^\d{5}(-\d{4})?$/.test(zip)) return { error: "Enter a valid ZIP code." };
  const { data, error } = await supabase.rpc("save_address", {
    p_label: str(form, "label", 30),
    p_line1: str(form, "line1", 120),
    p_line2: str(form, "line2", 60),
    p_city: str(form, "city", 60),
    p_state: state,
    p_zip: zip,
    p_lat: lat,
    p_lng: lng,
    p_instructions: str(form, "instructions", 200),
  });
  if (error) return { error: error.code === "23514" ? "Check the address fields and try again." : errorMessage(error) };
  revalidatePath("/account");
  return (data as { in_zone: boolean }).in_zone
    ? { ok: "Address saved." }
    : { ok: "Address saved, but it's outside our delivery area right now." };
}

export async function deleteAddress(form: FormData) {
  const { supabase, user } = await whoami("customer");
  const id = String(form.get("id") ?? "");
  if (!user || !/^[0-9a-f-]{36}$/.test(id)) return;
  await supabase.rpc("delete_address", { p_id: id });
  revalidatePath("/account");
}
