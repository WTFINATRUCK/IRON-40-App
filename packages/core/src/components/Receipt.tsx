import { categoryLabel, grams, money, receiptNo, when, type Category } from "../format";

export type ReceiptOrder = {
  receipt_no: number;
  created_at: string;
  delivered_at: string | null;
  status: string;
  payment_method: "cash" | "debit_at_door";
  subtotal_cents: number;
  cannabis_subtotal_cents: number;
  excise_cents: number;
  sales_tax_cents: number;
  delivery_fee_cents: number;
  total_cents: number;
  customer_name?: string;
  address?: { line1: string; line2?: string; city: string; state: string; zip: string };
};

export type ReceiptItem = {
  id: string;
  name: string;
  category: Category;
  subcategory: string;
  weight_g: number | null;
  unit_price_cents: number;
  qty: number;
  line_total_cents: number;
};

export type ReceiptTenant = { name: string; license_number: string; license_state: string; timezone: string };

// The receipt lists exactly what was sold, grouped by category, with cannabis taxes shown separately.
export function Receipt({ order, items, tenant }: { order: ReceiptOrder; items: ReceiptItem[]; tenant: ReceiptTenant }) {
  const groups = (["flower", "concentrate", "gear"] as Category[])
    .map((c) => ({ c, rows: items.filter((i) => i.category === c) }))
    .filter((g) => g.rows.length);

  return (
    <section className="receipt" aria-label="Receipt">
      <header className="receipt-head">
        <div>
          <strong>{tenant.name}</strong>
          <div className="muted small">
            Licensed cannabis retailer · {tenant.license_state} license {tenant.license_number}
          </div>
        </div>
        <div className="receipt-no">
          <div className="small muted">Receipt</div>
          <strong className="mono-num">{receiptNo(order.receipt_no)}</strong>
        </div>
      </header>
      <div className="small muted">
        Ordered {when(order.created_at, tenant.timezone)}
        {order.delivered_at ? ` · Delivered ${when(order.delivered_at, tenant.timezone)}` : ""}
      </div>

      {groups.map(({ c, rows }) => (
        <table key={c} className="receipt-table">
          <caption>{categoryLabel[c]}</caption>
          <tbody>
            {rows.map((i) => (
              <tr key={i.id}>
                <td>
                  {i.name}
                  <div className="small muted">
                    {i.subcategory}
                    {i.weight_g ? ` · ${grams(i.weight_g)}` : ""} · {i.qty} × {money(i.unit_price_cents)}
                  </div>
                </td>
                <td className="num">{money(i.line_total_cents)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ))}

      <table className="receipt-table totals">
        <tbody>
          <tr><td>Subtotal</td><td className="num">{money(order.subtotal_cents)}</td></tr>
          {order.excise_cents > 0 && (
            <tr><td>Cannabis excise tax (on {money(order.cannabis_subtotal_cents)})</td><td className="num">{money(order.excise_cents)}</td></tr>
          )}
          <tr><td>Sales tax</td><td className="num">{money(order.sales_tax_cents)}</td></tr>
          <tr><td>Delivery</td><td className="num">{money(order.delivery_fee_cents)}</td></tr>
          <tr className="grand"><td>Total</td><td className="num">{money(order.total_cents)}</td></tr>
        </tbody>
      </table>
      <p className="small muted">
        Paid {order.payment_method === "cash" ? "in cash" : "by debit card"} at delivery. ID checked at the door. For
        use only by adults 21 and older. Keep out of reach of children.
      </p>
    </section>
  );
}
