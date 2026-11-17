import { whoami } from "@iron40/core/supabase/server";
import { getMenu, getTenant, isOpen } from "../lib";
import { Checkout } from "./checkout";

export const metadata = { title: "Cart" };

export default async function CartPage() {
  const [{ supabase, user, who }, tenant, menu] = await Promise.all([whoami("customer"), getTenant(), getMenu()]);

  let addresses: { id: string; label: string; line1: string; city: string; inZone: boolean }[] = [];
  if (user && who.kind === "customer") {
    const { data } = await supabase.from("addresses").select("id, label, line1, city").order("created_at");
    addresses = await Promise.all(
      (data ?? []).map(async (a) => ({
        ...a,
        inZone: Boolean((await supabase.rpc("address_in_zone", { p_id: a.id })).data),
      })),
    );
  }

  const readiness = !user
    ? "signed_out"
    : who.kind !== "customer"
      ? "no_profile"
      : who.id_status !== "approved"
        ? "not_verified"
        : addresses.length === 0
          ? "no_address"
          : "ready";

  return (
    <div className="wrap page">
      <h1>Your cart</h1>
      <Checkout
        menu={menu}
        addresses={addresses}
        readiness={readiness}
        open={isOpen(tenant)}
        limits={{
          minOrder: tenant.min_order_cents,
          fee: tenant.delivery_fee_cents,
          maxFlower: Number(tenant.max_flower_g),
          maxConcentrate: Number(tenant.max_concentrate_g),
          excise: Number(tenant.excise_rate),
          tax: Number(tenant.sales_tax_rate),
        }}
      />
    </div>
  );
}
