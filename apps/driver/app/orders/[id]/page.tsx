import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { StatusPill } from "@iron40/core/components/Brand";
import { categoryLabel, grams, money, statusLabel, type Category, type OrderStatus } from "@iron40/core/format";
import { whoami } from "@iron40/core/supabase/server";
import { DoorCheck, FailForm } from "../../forms";
import { AdvanceButton } from "./advance";

export default async function Job({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const { supabase, user, who } = await whoami("driver");
  if (!user) redirect("/login");
  if (who.kind !== "driver") redirect("/");

  // RLS only returns orders assigned to this driver.
  const { data: o } = await supabase
    .from("orders")
    .select("id, status, customer_name, customer_phone, address, lat, lng, notes, total_cents, payment_method")
    .eq("id", id)
    .eq("driver_id", user.id)
    .maybeSingle();
  if (!o) notFound();
  const { data: items } = await supabase
    .from("order_items")
    .select("id, name, category, weight_g, qty")
    .eq("order_id", id);

  const a = o.address as { line1: string; line2?: string; city: string; state: string; zip: string; instructions?: string };
  const status = o.status as OrderStatus;
  const dest = `${o.lat},${o.lng}`;
  const active = status === "assigned" || status === "en_route" || status === "arrived";

  return (
    <div className="stack">
      <Link href="/" className="small">← All orders</Link>
      <div className="spread">
        <h1 style={{ margin: 0 }}>{o.customer_name}</h1>
        <StatusPill status={status} label={statusLabel[status]} />
      </div>
      <section className="panel stack">
        <div>
          <div className="job-addr">{a.line1}{a.line2 ? `, ${a.line2}` : ""}</div>
          <div className="muted">{a.city}, {a.state} {a.zip}</div>
          {a.instructions && <p className="notice notice-warn" style={{ marginTop: "0.6rem" }}>{a.instructions}</p>}
          {o.notes && <p className="small">Note: {o.notes}</p>}
        </div>
        {active && (
          <div className="map-links">
            <a className="btn" href={`https://maps.apple.com/?daddr=${dest}&dirflg=d`} rel="noopener noreferrer">Apple Maps</a>
            <a className="btn" href={`https://www.google.com/maps/dir/?api=1&destination=${dest}`} rel="noopener noreferrer">Google</a>
            <a className="btn" href={`https://waze.com/ul?ll=${dest}&navigate=yes`} rel="noopener noreferrer">Waze</a>
          </div>
        )}
        {active && <a className="btn btn-block" href={`tel:${o.customer_phone.replace(/[^0-9+]/g, "")}`}>Call customer</a>}
      </section>

      <section className="panel">
        <h2>Hand over</h2>
        <ul className="load">
          {(items ?? []).map((i) => (
            <li key={i.id}>
              <span>{i.name} <span className="small muted">· {categoryLabel[i.category as Category]}{i.weight_g ? ` · ${grams(i.weight_g)}` : ""}</span></span>
              <span className="qty">×{i.qty}</span>
            </li>
          ))}
        </ul>
        <p className="spread" style={{ marginTop: "0.75rem" }}>
          <span>Collect {o.payment_method === "cash" ? "cash" : "by debit card"}</span>
          <strong>{money(o.total_cents)}</strong>
        </p>
      </section>

      <div className="action-bar">
        {status === "assigned" && <AdvanceButton id={o.id} to="en_route" label="Start driving" />}
        {status === "en_route" && <AdvanceButton id={o.id} to="arrived" label="I'm here" />}
        {status === "arrived" && <DoorCheck orderId={o.id} customerName={o.customer_name} />}
        {active && <FailForm orderId={o.id} />}
      </div>
    </div>
  );
}
