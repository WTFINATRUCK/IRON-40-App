import Link from "next/link";
import { redirect } from "next/navigation";
import { StatusPill } from "@iron40/core/components/Brand";
import { categoryLabel, statusLabel, type Category, type OrderStatus } from "@iron40/core/format";
import { whoami } from "@iron40/core/supabase/server";
import { signOutAction } from "./actions";
import { RedeemForm, ShiftSwitch } from "./forms";

export default async function Home() {
  const { supabase, user, who } = await whoami("driver");
  if (!user) redirect("/login");

  if (who.kind === null) {
    return (
      <div className="stack">
        <h1>Enter your invite code</h1>
        <p className="muted">Your dispatcher creates a one-time code that expires after 48 hours.</p>
        <RedeemForm />
        <form action={signOutAction}><button className="btn btn-small">Sign out</button></form>
      </div>
    );
  }
  if (who.kind !== "driver") {
    return (
      <div className="stack">
        <h1>Wrong app for this account</h1>
        <p>This account isn't a driver account.</p>
        <form action={signOutAction}><button className="btn">Sign out</button></form>
      </div>
    );
  }
  if (!who.active) {
    return (
      <div className="stack">
        <h1>Account paused</h1>
        <p>Your dispatcher has paused this driver account. Contact them to get back on the road.</p>
        <form action={signOutAction}><button className="btn">Sign out</button></form>
      </div>
    );
  }

  const [{ data: me }, { data: jobs }, { data: load }] = await Promise.all([
    supabase.from("drivers").select("status, vehicle").eq("user_id", user.id).single(),
    supabase
      .from("orders")
      .select("id, status, customer_name, address, created_at")
      .eq("driver_id", user.id)
      .in("status", ["assigned", "en_route", "arrived"])
      .order("assigned_at"),
    supabase.from("driver_inventory").select("qty, products(name, category, subcategory)").eq("driver_id", user.id),
  ]);

  type LoadRow = { qty: number; products: { name: string; category: Category; subcategory: string } | null };
  const rows = ((load ?? []) as unknown as LoadRow[]).filter((r) => r.products).sort((a, b) => b.qty - a.qty);

  return (
    <div className="stack">
      <div className="spread">
        <h1 style={{ margin: 0 }}>Hi, {who.name}</h1>
        <form action={signOutAction}><button className="btn btn-small">Sign out</button></form>
      </div>
      <ShiftSwitch online={me?.status === "online"} />

      <section>
        <h2>Your orders</h2>
        {!jobs?.length ? (
          <p className="muted">No orders yet. New ones show up here automatically.</p>
        ) : (
          jobs.map((j) => {
            const a = j.address as { line1: string; line2?: string; city: string };
            return (
              <Link key={j.id} href={`/orders/${j.id}`} className="job">
                <div className="job-top">
                  <StatusPill status={j.status} label={statusLabel[j.status as OrderStatus]} />
                  <span className="small muted">{j.customer_name}</span>
                </div>
                <div className="job-addr">{a.line1}{a.line2 ? `, ${a.line2}` : ""}</div>
                <div className="small muted">{a.city}</div>
              </Link>
            );
          })
        )}
      </section>

      <section>
        <h2>In your vehicle</h2>
        {rows.length === 0 ? (
          <p className="muted">Nothing loaded. Ask dispatch to load stock to your vehicle.</p>
        ) : (
          <ul className="load">
            {rows.map((r) => (
              <li key={r.products!.name}>
                <span>
                  {r.products!.name} <span className="small muted">· {categoryLabel[r.products!.category]}</span>
                </span>
                <span className={r.qty ? "qty" : "zero"}>{r.qty}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
      <p className="small"><Link href="/install">Add this app to your home screen</Link></p>
    </div>
  );
}
