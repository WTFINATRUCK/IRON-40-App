import { notFound, redirect } from "next/navigation";
import { Receipt, type ReceiptItem, type ReceiptOrder } from "@iron40/core/components/Receipt";
import { ACTIVE, statusLabel, type OrderStatus } from "@iron40/core/format";
import { whoami } from "@iron40/core/supabase/server";
import { getTenant } from "../../lib";
import { CancelButton, Refresher } from "./client";

const STEPS: OrderStatus[] = ["queued", "assigned", "en_route", "arrived", "delivered"];

export default async function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const { supabase, user } = await whoami("customer");
  if (!user) redirect(`/login?next=/orders/${id}`);

  // RLS returns nothing unless this order belongs to the signed-in customer.
  const { data: order } = await supabase
    .from("orders")
    .select(
      "id, receipt_no, status, driver_name, created_at, delivered_at, payment_method, subtotal_cents, cannabis_subtotal_cents, excise_cents, sales_tax_cents, delivery_fee_cents, total_cents, failed_reason, cancel_reason",
    )
    .eq("id", id)
    .maybeSingle();
  if (!order) notFound();
  const { data: items } = await supabase
    .from("order_items")
    .select("id, name, category, subcategory, weight_g, unit_price_cents, qty, line_total_cents")
    .eq("order_id", id);
  const tenant = await getTenant();

  const status = order.status as OrderStatus;
  const active = ACTIVE.includes(status);
  const reached = STEPS.indexOf(status);
  const minutes = Math.floor((Date.now() - new Date(order.created_at).getTime()) / 60000);

  return (
    <div className="wrap page stack">
      {active && <Refresher />}
      <h1>{statusLabel[status]}</h1>
      <div className="track">
        <div className="stack">
          {active ? (
            <div className="clock" aria-live="polite">
              <div className="clock-plate">{Math.max(0, 40 - minutes)}</div>
              <div>
                <strong>{minutes < 40 ? "minutes left on the 40" : "Running a little behind"}</strong>
                <div className="small" style={{ color: "#cfd3cc" }}>
                  {order.driver_name ? `${order.driver_name} is bringing your order.` : "Matching you with the nearest driver who has your items."}
                </div>
              </div>
            </div>
          ) : status === "failed" ? (
            <p className="notice notice-error">{order.failed_reason ?? "The order couldn't be delivered."}</p>
          ) : status === "canceled" ? (
            <p className="notice notice-warn">This order was canceled{order.cancel_reason === "customer" ? " by you" : ""}.</p>
          ) : null}

          {status !== "failed" && status !== "canceled" && (
            <ol className="timeline">
              {STEPS.map((s, i) => (
                <li key={s} className={i <= reached ? "done" : ""}>{statusLabel[s]}</li>
              ))}
            </ol>
          )}
          {active && <p className="small">Have your ID ready. The driver checks it before handing anything over.</p>}
          {(status === "queued" || status === "assigned") && <CancelButton id={order.id} />}
        </div>
        <Receipt order={order as ReceiptOrder} items={(items ?? []) as ReceiptItem[]} tenant={tenant} />
      </div>
    </div>
  );
}
