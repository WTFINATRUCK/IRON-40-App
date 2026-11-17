import { notFound } from "next/navigation";
import { StatusPill } from "@iron40/core/components/Brand";
import { Receipt, type ReceiptItem, type ReceiptOrder } from "@iron40/core/components/Receipt";
import { ACTIVE, statusLabel, when, type OrderStatus } from "@iron40/core/format";
import { cancelOrderAction, dispatchAction } from "../../actions";
import { requireStaff, UUID } from "../../lib";
import { ActionForm } from "../../ui";

export default async function OrderDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const { supabase, who } = await requireStaff();
  const [{ data: o }, { data: items }, { data: events }, { data: tenant }] = await Promise.all([
    supabase.from("orders").select("*").eq("id", id).maybeSingle(),
    supabase.from("order_items").select("id, name, category, subcategory, weight_g, unit_price_cents, qty, line_total_cents").eq("order_id", id),
    supabase.from("order_events").select("id, event, detail, created_at").eq("order_id", id).order("created_at"),
    supabase.from("tenants").select("name, license_number, license_state, timezone").eq("id", who.tenant_id).single(),
  ]);
  if (!o || !tenant) notFound();
  const status = o.status as OrderStatus;
  const a = o.address as { line1: string; line2?: string; city: string; state: string; zip: string; instructions?: string };

  return (
    <div className="stack">
      <div className="spread">
        <h1 style={{ margin: 0 }}>{o.customer_name}</h1>
        <StatusPill status={status} label={statusLabel[status]} />
      </div>
      <div className="grid-2">
        <div className="stack">
          <section className="box">
            <h2>Delivery</h2>
            <p>{a.line1}{a.line2 ? `, ${a.line2}` : ""}, {a.city}, {a.state} {a.zip}</p>
            {a.instructions && <p className="small">Instructions: {a.instructions}</p>}
            {o.notes && <p className="small">Customer note: {o.notes}</p>}
            <p className="small">Phone: {o.customer_phone} · Driver: {o.driver_name ?? "not assigned"}</p>
            {o.failed_reason && <p className="notice notice-error">Not delivered: {o.failed_reason}</p>}
            {o.cancel_reason && <p className="notice notice-warn">Canceled: {o.cancel_reason}</p>}
          </section>
          {status === "queued" && (
            <form action={dispatchAction}>
              <input type="hidden" name="order" value={o.id} />
              <button className="btn btn-primary">Retry dispatch</button>
            </form>
          )}
          {ACTIVE.includes(status) && (
            <section className="box">
              <h2>Cancel order</h2>
              <ActionForm action={cancelOrderAction} submit="Cancel order" danger confirmText="Cancel this order? Reserved stock goes back to the vehicle.">
                <input type="hidden" name="order" value={o.id} />
                <label>Reason<input name="reason" required minLength={3} maxLength={200} /></label>
              </ActionForm>
            </section>
          )}
          <section className="box">
            <h2>History</h2>
            <table className="table">
              <tbody>
                {(events ?? []).map((e) => (
                  <tr key={e.id}><td className="small">{when(e.created_at, tenant.timezone)}</td><td>{e.event.replace(/_/g, " ")}</td></tr>
                ))}
              </tbody>
            </table>
          </section>
        </div>
        <Receipt order={o as ReceiptOrder} items={(items ?? []) as ReceiptItem[]} tenant={tenant} />
      </div>
    </div>
  );
}
