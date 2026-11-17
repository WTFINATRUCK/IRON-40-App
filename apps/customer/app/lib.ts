import "server-only";
import { cache } from "react";
import { env } from "@iron40/core/env";
import { createClient } from "@iron40/core/supabase/server";
import type { Category } from "@iron40/core/format";

export type Tenant = {
  id: string;
  slug: string;
  name: string;
  license_number: string;
  license_state: string;
  timezone: string;
  open_hour: number;
  close_hour: number;
  delivery_fee_cents: number;
  min_order_cents: number;
  max_flower_g: number;
  max_concentrate_g: number;
  excise_rate: number;
  sales_tax_rate: number;
};

export type MenuItem = {
  id: string;
  category: Category;
  subcategory: string;
  name: string;
  description: string;
  strain: string | null;
  thc_pct: number | null;
  weight_g: number | null;
  price_cents: number;
  in_stock: boolean;
};

export const getTenant = cache(async (): Promise<Tenant> => {
  const supabase = await createClient("customer");
  const { data, error } = await supabase
    .from("tenants")
    .select(
      "id, slug, name, license_number, license_state, timezone, open_hour, close_hour, delivery_fee_cents, min_order_cents, max_flower_g, max_concentrate_g, excise_rate, sales_tax_rate",
    )
    .eq("slug", env.tenantSlug)
    .single();
  if (error || !data) throw new Error("Store not configured");
  return data as Tenant;
});

export const getMenu = cache(async (): Promise<MenuItem[]> => {
  const supabase = await createClient("customer");
  const { data } = await supabase.rpc("get_menu", { p_tenant_slug: env.tenantSlug });
  return (data ?? []) as MenuItem[];
});

export function hourLabel(h: number) {
  if (h === 0 || h === 24) return "midnight";
  if (h === 12) return "noon";
  return h < 12 ? `${h} am` : `${h - 12} pm`;
}

export function isOpen(t: Tenant) {
  const hour = Number(
    new Intl.DateTimeFormat("en-US", { hour: "numeric", hourCycle: "h23", timeZone: t.timezone }).format(new Date()),
  );
  return hour >= t.open_hour && hour < t.close_hour;
}
