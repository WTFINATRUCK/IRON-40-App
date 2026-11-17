import { notFound } from "next/navigation";
import { productAction } from "../../actions";
import { requireStaff, UUID } from "../../lib";
import { ActionForm } from "../../ui";

export default async function ProductEdit({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase } = await requireStaff(["owner", "admin"]);
  const isNew = id === "new";
  if (!isNew && !UUID.test(id)) notFound();
  const { data: p } = isNew ? { data: null } : await supabase.from("products").select("*").eq("id", id).maybeSingle();
  if (!isNew && !p) notFound();

  return (
    <div className="stack">
      <h1>{isNew ? "Add product" : p!.name}</h1>
      <section className="box">
        <ActionForm action={productAction} submit={isNew ? "Add product" : "Save product"}>
          <input type="hidden" name="id" value={p?.id ?? ""} />
          <div className="field-grid">
            <label>Category
              <select name="category" defaultValue={p?.category ?? "flower"}>
                <option value="flower">Flower</option>
                <option value="concentrate">Concentrate</option>
                <option value="gear">Gear (ash trays, rolling trays, grinders, lighters)</option>
              </select>
            </label>
            <label>Type <span className="hint">e.g. Eighth, Live resin, Grinder</span><input name="subcategory" required maxLength={40} defaultValue={p?.subcategory ?? ""} /></label>
          </div>
          <label>Name<input name="name" required maxLength={80} defaultValue={p?.name ?? ""} /></label>
          <label>Description<textarea name="description" maxLength={400} rows={3} defaultValue={p?.description ?? ""} /></label>
          <div className="field-grid">
            <label>Price ($)<input name="price" type="number" step="0.01" min="0.01" required defaultValue={p ? (p.price_cents / 100).toFixed(2) : ""} /></label>
            <label>Weight (g) <span className="hint">cannabis only</span><input name="weight_g" type="number" step="0.01" min="0" defaultValue={p?.weight_g ?? ""} /></label>
            <label>THC % <span className="hint">cannabis only</span><input name="thc_pct" type="number" step="0.1" min="0" max="100" defaultValue={p?.thc_pct ?? ""} /></label>
            <label>Strain
              <select name="strain" defaultValue={p?.strain ?? ""}>
                <option value="">—</option><option value="indica">Indica</option><option value="sativa">Sativa</option><option value="hybrid">Hybrid</option>
              </select>
            </label>
            <label>Sort order<input name="sort" type="number" defaultValue={p?.sort ?? 100} /></label>
          </div>
          <label className="choice"><input type="checkbox" name="active" defaultChecked={p?.active ?? true} /> Show on the menu</label>
        </ActionForm>
      </section>
    </div>
  );
}
