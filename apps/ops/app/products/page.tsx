import Link from "next/link";
import { categoryLabel, grams, money, type Category } from "@iron40/core/format";
import { requireStaff } from "../lib";

export const metadata = { title: "Products" };

export default async function Products() {
  const { supabase, who } = await requireStaff();
  const { data: products } = await supabase
    .from("products")
    .select("id, name, category, subcategory, weight_g, thc_pct, price_cents, active")
    .order("category")
    .order("sort");
  return (
    <div className="stack">
      <div className="spread">
        <h1 style={{ margin: 0 }}>Products</h1>
        {who.role !== "dispatcher" && <Link className="btn btn-primary" href="/products/new">Add product</Link>}
      </div>
      <div className="box">
        <table className="table">
          <thead><tr><th>Name</th><th>Category</th><th>Size</th><th>THC</th><th className="num">Price</th><th>Shown</th></tr></thead>
          <tbody>
            {(products ?? []).map((p) => (
              <tr key={p.id}>
                <td>{who.role !== "dispatcher" ? <Link href={`/products/${p.id}`}>{p.name}</Link> : p.name}</td>
                <td className="small">{categoryLabel[p.category as Category]} · {p.subcategory}</td>
                <td className="small">{grams(p.weight_g)}</td>
                <td className="small">{p.thc_pct != null ? `${Number(p.thc_pct)}%` : ""}</td>
                <td className="num">{money(p.price_cents)}</td>
                <td>{p.active ? "Yes" : "Hidden"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
