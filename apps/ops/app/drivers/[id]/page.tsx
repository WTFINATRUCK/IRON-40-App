import { notFound } from "next/navigation";
import { StatusPill } from "@iron40/core/components/Brand";
import { categoryLabel, type Category } from "@iron40/core/format";
import { driverActiveAction, transferAction } from "../../actions";
import { ago, requireStaff, UUID } from "../../lib";
import { ActionForm } from "../../ui";

export default async function Driver({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const { supabase, who } = await requireStaff();
  const [{ data: d }, { data: load }, { data: products }, { data: locations }] = await Promise.all([
    supabase.from("drivers").select("user_id, display_name, phone, vehicle, status, last_seen_at, active, max_active_orders").eq("user_id", id).maybeSingle(),
    supabase.from("driver_inventory").select("product_id, qty").eq("driver_id", id),
    supabase.from("products").select("id, name, category").order("category").order("sort"),
    supabase.from("locations").select("id, name").eq("active", true).order("name"),
  ]);
  if (!d) notFound();
  const qty = new Map((load ?? []).map((l) => [l.product_id, l.qty]));
  const canAdmin = who.role === "owner" || who.role === "admin";

  return (
    <div className="stack">
      <div className="spread">
        <h1 style={{ margin: 0 }}>{d.display_name}</h1>
        {d.active ? <StatusPill status={d.status} label={d.status === "online" ? "Online" : "Offline"} /> : <StatusPill status="canceled" label="Paused" />}
      </div>
      <p className="muted">{d.phone} · {d.vehicle || "No vehicle listed"} · last ping {ago(d.last_seen_at)} · up to {d.max_active_orders} orders at once</p>

      <div className="grid-2">
        <section className="box">
          <h2>In the vehicle</h2>
          <table className="table">
            <thead><tr><th>Product</th><th>Category</th><th className="num">Qty</th></tr></thead>
            <tbody>
              {(products ?? []).map((p) => (
                <tr key={p.id}>
                  <td>{p.name}</td>
                  <td className="small">{categoryLabel[p.category as Category]}</td>
                  <td className="num"><strong>{qty.get(p.id) ?? 0}</strong></td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
        <div className="stack">
          <section className="box">
            <h2>Load or unload stock</h2>
            <p className="small muted">Moves units between a hub and this vehicle. Every move is written to the audit log.</p>
            <ActionForm action={transferAction} submit="Move stock">
              <input type="hidden" name="driver" value={d.user_id} />
              <div className="field-grid">
                <label>Direction
                  <select name="direction"><option value="load">Load into vehicle</option><option value="unload">Return to hub</option></select>
                </label>
                <label>Hub
                  <select name="location" required>{(locations ?? []).map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</select>
                </label>
              </div>
              <label>Product
                <select name="product" required>
                  {(products ?? []).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </label>
              <label>Units<input name="qty" type="number" min={1} max={1000} required /></label>
            </ActionForm>
          </section>
          {canAdmin && (
            <section className="box">
              <h2>{d.active ? "Pause driver" : "Reactivate driver"}</h2>
              <ActionForm action={driverActiveAction} submit={d.active ? "Pause" : "Reactivate"} danger={d.active}>
                <input type="hidden" name="driver" value={d.user_id} />
                <input type="hidden" name="active" value={d.active ? "false" : "true"} />
                <p className="small muted">{d.active ? "Paused drivers go offline and can't receive orders." : "They can go online again."}</p>
              </ActionForm>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
