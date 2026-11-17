"use server";

import { revalidatePath } from "next/cache";
import { errorMessage } from "@iron40/core/format";
import { whoami } from "@iron40/core/supabase/server";

export async function cancelOrder(id: string): Promise<string | null> {
  if (!/^[0-9a-f-]{36}$/.test(id)) return errorMessage("not_found");
  const { supabase, user } = await whoami("customer");
  if (!user) return errorMessage("not_authenticated");
  const { error } = await supabase.rpc("cancel_order", { p_order: id });
  if (error) return errorMessage(error);
  revalidatePath(`/orders/${id}`);
  return null;
}
