import Link from "next/link";
import { StatusPill } from "@iron40/core/components/Brand";
import { money, receiptNo, statusLabel, when, type OrderStatus } from "@iron40/core/format";
import { requireStaff } from "../lib";

export const metadata = { title: "Orders" };
const FILTERS = ["all", "queued", "assigned", "en_route", "arrived", "delivered", "failed", "canceled"] as const;

export default async function Orders({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { supabase } = await requireStaff();
  const { status } = await searchParams;
  const filter = FILTERS.includes(status as (typeof FILTERS)[number]) ? status! : "all";
  let q = supabase
    .from("orders")
    .select("id, receipt_no, status, customer_name, driver_name, total_cents, created_at")
    .order("created_at", { ascending: false })
    .limit(200);
  if (filter !== "all") q = q.eq("status", filter);
  const { data: orders } = await q;

  return (
    <div className="stack">
      <h1>Orders</h1>
      <nav className="row small" aria-label="Filter">
        {FILTERS.map((f) => (
          <Link key={f} href={f === "all" ? "/orders" : `/orders?status=${f}`} style={{ fontWeight: f === filter ? 800 : 400 }}>
            {f === "all" ? "All" : statusLabel[f as OrderStatus]}
          </Link>
        ))}
      </nav>
      <div className="box">
        <table className="table">
          <thead><tr><th>Receipt</th><th>Placed</th><th>Status</th><th>Customer</th><th>Driver</th><th className="num">Total</th></tr></thead>
          <tbody>
            {(orders ?? []).map((o) => (
              <tr key={o.id}>
                <td><Link href={`/orders/${o.id}`}>{receiptNo(o.receipt_no)}</Link></td>
                <td className="small">{when(o.created_at)}</td>
                <td><StatusPill status={o.status} label={statusLabel[o.status as OrderStatus]} /></td>
                <td>{o.customer_name}</td>
                <td>{o.driver_name ?? "—"}</td>
                <td className="num">{money(o.total_cents)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!orders?.length && <p className="muted">No orders match.</p>}
      </div>
    </div>
  );
}
