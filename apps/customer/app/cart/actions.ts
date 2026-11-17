"use server";

import { errorMessage } from "@iron40/core/format";
import { whoami } from "@iron40/core/supabase/server";

export type CheckoutState = { error?: string; orderId?: string } | undefined;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export async function placeOrder(_: CheckoutState, form: FormData): Promise<CheckoutState> {
  const { supabase, user, who } = await whoami("customer");
  if (!user) return { error: "Sign in to check out." };
  if (who.kind !== "customer") return { error: "Finish your account setup first." };

  const address = String(form.get("address") ?? "");
  const payment = String(form.get("payment") ?? "");
  const notes = String(form.get("notes") ?? "").slice(0, 300);
  if (!UUID.test(address)) return { error: errorMessage("invalid_address") };
  if (payment !== "cash" && payment !== "debit_at_door") return { error: "Choose how you'll pay." };

  let items: { product_id: string; qty: number }[];
  try {
    const raw = JSON.parse(String(form.get("items") ?? "{}")) as Record<string, unknown>;
    items = Object.entries(raw)
      .filter(([id, q]) => UUID.test(id) && Number.isInteger(q) && (q as number) >= 1 && (q as number) <= 20)
      .map(([product_id, qty]) => ({ product_id, qty: qty as number }));
  } catch {
    return { error: errorMessage("invalid_cart") };
  }
  if (items.length === 0 || items.length > 30) return { error: errorMessage("invalid_cart") };

  const { data, error } = await supabase.rpc("place_order", {
    p_address_id: address,
    p_items: items,
    p_payment: payment,
    p_notes: notes,
  });
  if (error) return { error: errorMessage(error) };
  return { orderId: (data as { id: string }).id };
}
