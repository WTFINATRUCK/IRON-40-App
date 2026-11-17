import Link from "next/link";
import { redirect } from "next/navigation";
import { StatusPill } from "@iron40/core/components/Brand";
import { money, receiptNo, statusLabel, when, type OrderStatus } from "@iron40/core/format";
import { whoami } from "@iron40/core/supabase/server";
import { getTenant } from "../lib";

export const metadata = { title: "Orders" };

export default async function Orders() {
  const { supabase, user } = await whoami("customer");
  if (!user) redirect("/login?next=/orders");
  const tenant = await getTenant();
  const { data: orders } = await supabase
    .from("orders")
    .select("id, receipt_no, status, total_cents, created_at")
    .eq("customer_id", user.id)
    .order("created_at", { ascending: false })
    .limit(50);

  return (
    <div className="wrap page stack">
      <h1>Orders</h1>
      {!orders?.length ? (
        <p>
          No orders yet. <Link href="/#menu">Shop the menu</Link>
        </p>
      ) : (
        <table className="table">
          <thead><tr><th>Receipt</th><th>Placed</th><th>Status</th><th className="num">Total</th></tr></thead>
          <tbody>
            {orders.map((o) => (
              <tr key={o.id}>
                <td><Link href={`/orders/${o.id}`}>{receiptNo(o.receipt_no)}</Link></td>
                <td>{when(o.created_at, tenant.timezone)}</td>
                <td><StatusPill status={o.status} label={statusLabel[o.status as OrderStatus]} /></td>
                <td className="num">{money(o.total_cents)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
