import { categoryLabel, type Category } from "@iron40/core/format";
import { stockAction } from "../actions";
import { requireStaff } from "../lib";
import { ActionForm } from "../ui";

export const metadata = { title: "Inventory" };

export default async function Inventory() {
  const { supabase, who } = await requireStaff();
  const canEdit = who.role !== "dispatcher";
  const [{ data: locations }, { data: products }, { data: stock }, { data: vehicles }] = await Promise.all([
    supabase.from("locations").select("id, name").order("name"),
    supabase.from("products").select("id, name, category, active").order("category").order("sort"),
    supabase.from("location_inventory").select("location_id, product_id, qty"),
    supabase.from("driver_inventory").select("product_id, qty"),
  ]);
  const at = new Map((stock ?? []).map((s) => [`${s.location_id}:${s.product_id}`, s.qty]));
  const onRoad = new Map<string, number>();
  for (const v of vehicles ?? []) onRoad.set(v.product_id, (onRoad.get(v.product_id) ?? 0) + v.qty);

  return (
    <div className="stack">
      <h1>Inventory</h1>
      <p className="muted">Hub counts are editable here. Stock in vehicles changes only through loads, unloads and deliveries.</p>
      <div className="box">
        <table className="table">
          <thead>
            <tr><th>Product</th><th>Category</th>{(locations ?? []).map((l) => <th key={l.id}>{l.name}</th>)}<th className="num">In vehicles</th></tr>
          </thead>
          <tbody>
            {(products ?? []).map((p) => (
              <tr key={p.id} style={{ opacity: p.active ? 1 : 0.5 }}>
                <td>{p.name}</td>
                <td className="small">{categoryLabel[p.category as Category]}</td>
                {(locations ?? []).map((l) => (
                  <td key={l.id}>
                    {canEdit ? (
                      <ActionForm action={stockAction} submit="Set" className="inline-form">
                        <input type="hidden" name="location" value={l.id} />
                        <input type="hidden" name="product" value={p.id} />
                        <input name="qty" type="number" min={0} max={100000} defaultValue={at.get(`${l.id}:${p.id}`) ?? 0} aria-label={`${p.name} at ${l.name}`} />
                      </ActionForm>
                    ) : (
                      at.get(`${l.id}:${p.id}`) ?? 0
                    )}
                  </td>
                ))}
                <td className="num">{onRoad.get(p.id) ?? 0}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
