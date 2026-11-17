import Link from "next/link";
import { redirect } from "next/navigation";
import { StatusPill } from "@iron40/core/components/Brand";
import { money, receiptNo, statusLabel, type OrderStatus } from "@iron40/core/format";
import { whoami } from "@iron40/core/supabase/server";
import { dispatchAction, redeemAction, signOutAction } from "./actions";
import { ago } from "./lib";
import { ActionForm, AutoRefresh } from "./ui";

export default async function Live() {
  const { supabase, user, who } = await whoami("ops");
  if (!user) redirect("/login");
  if (who.kind === null) {
    return (
      <div className="stack" style={{ maxWidth: 520 }}>
        <h1>Enter your staff invite code</h1>
        <ActionForm action={redeemAction} submit="Join">
          <label>Invite code<input name="code" required autoComplete="off" maxLength={20} /></label>
          <label>Your name<input name="name" required maxLength={80} /></label>
        </ActionForm>
        <form action={signOutAction}><button className="btn btn-small">Sign out</button></form>
      </div>
    );
  }
  if (who.kind !== "staff") {
    return (
      <div className="stack">
        <h1>Wrong app for this account</h1>
        <form action={signOutAction}><button className="btn">Sign out</button></form>
      </div>
    );
  }

  const [{ data: orders }, { count: pendingIds }, { data: drivers }] = await Promise.all([
    supabase
      .from("orders")
      .select("id, receipt_no, status, customer_name, address, driver_name, total_cents, created_at")
      .in("status", ["queued", "assigned", "en_route", "arrived"])
      .order("created_at"),
    supabase.from("customers").select("user_id", { count: "exact", head: true }).eq("id_status", "pending"),
    supabase.from("drivers").select("user_id, display_name, status, last_seen_at, active").eq("active", true).order("display_name"),
  ]);

  const queued = (orders ?? []).filter((o) => o.status === "queued");
  const fresh = (iso: string | null) => iso && Date.now() - new Date(iso).getTime() < 180000;
  const online = (drivers ?? []).filter((d) => d.status === "online" && fresh(d.last_seen_at));

  return (
    <div>
      <AutoRefresh every={15000} />
      <div className="spread"><h1>Live board</h1>
        {queued.length > 0 && (
          <form action={dispatchAction}><button className="btn btn-primary">Retry dispatch for {queued.length} queued</button></form>
        )}
      </div>
      <div className="kpis">
        <div className={`kpi ${queued.length ? "hot" : ""}`}><strong>{queued.length}</strong>Waiting for a driver</div>
        <div className="kpi"><strong>{(orders?.length ?? 0) - queued.length}</strong>Out for delivery</div>
        <Link href="/verifications" className={`kpi ${pendingIds ? "hot" : ""}`}><strong>{pendingIds ?? 0}</strong>IDs to review</Link>
        <Link href="/drivers" className="kpi"><strong>{online.length}</strong>Drivers online</Link>
      </div>

      <div className="grid-2">
        <section className="box">
          <h2>Active orders</h2>
          {!orders?.length ? <p className="muted">No active orders.</p> : (
            <table className="table">
              <thead><tr><th>Receipt</th><th>Status</th><th>Customer</th><th>Driver</th><th>Age</th><th className="num">Total</th></tr></thead>
              <tbody>
                {orders.map((o) => {
                  const mins = Math.round((Date.now() - new Date(o.created_at).getTime()) / 60000);
                  return (
                    <tr key={o.id}>
                      <td><Link href={`/orders/${o.id}`}>{receiptNo(o.receipt_no)}</Link></td>
                      <td><StatusPill status={o.status} label={statusLabel[o.status as OrderStatus]} /></td>
                      <td>{o.customer_name}<div className="small muted">{(o.address as { city: string }).city}</div></td>
                      <td>{o.driver_name ?? "—"}</td>
                      <td style={{ color: mins >= 40 ? "var(--rust)" : undefined, fontWeight: mins >= 40 ? 800 : 400 }}>{mins} min</td>
                      <td className="num">{money(o.total_cents)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </section>
        <section className="box">
          <h2>Drivers</h2>
          {!drivers?.length ? <p className="muted">No drivers yet. <Link href="/drivers">Invite one</Link>.</p> : (
            <table className="table">
              <thead><tr><th>Driver</th><th>Status</th><th>Last ping</th></tr></thead>
              <tbody>
                {drivers.map((d) => {
                  const on = d.status === "online" && fresh(d.last_seen_at);
                  return (
                    <tr key={d.user_id}>
                      <td><Link href={`/drivers/${d.user_id}`}>{d.display_name}</Link></td>
                      <td><StatusPill status={on ? "online" : "offline"} label={on ? "Online" : d.status === "online" ? "No signal" : "Offline"} /></td>
                      <td className="small">{ago(d.last_seen_at)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </section>
      </div>
    </div>
  );
}
