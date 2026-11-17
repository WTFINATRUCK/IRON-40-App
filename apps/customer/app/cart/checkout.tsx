"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect } from "react";
import { categoryLabel, grams, money } from "@iron40/core/format";
import type { MenuItem } from "../lib";
import { clearCart, setQty, useCart } from "../cart-store";
import { placeOrder } from "./actions";

type Props = {
  menu: MenuItem[];
  addresses: { id: string; label: string; line1: string; city: string; inZone: boolean }[];
  readiness: "signed_out" | "no_profile" | "not_verified" | "no_address" | "ready";
  open: boolean;
  limits: { minOrder: number; fee: number; maxFlower: number; maxConcentrate: number; excise: number; tax: number };
};

const blockers: Record<Exclude<Props["readiness"], "ready">, { text: string; href: string; cta: string }> = {
  signed_out: { text: "Sign in or create an account to check out.", href: "/login?next=/cart", cta: "Sign in" },
  no_profile: { text: "Add your details and ID before your first order.", href: "/account", cta: "Set up account" },
  not_verified: { text: "Your ID needs to be approved before you can order.", href: "/account", cta: "Check ID status" },
  no_address: { text: "Add a delivery address.", href: "/account", cta: "Add address" },
};

export function Checkout({ menu, addresses, readiness, open, limits }: Props) {
  const cart = useCart();
  const router = useRouter();
  const [state, action, pending] = useActionState(placeOrder, undefined);

  useEffect(() => {
    if (state?.orderId) {
      clearCart();
      router.push(`/orders/${state.orderId}`);
    }
  }, [state, router]);

  const lines = Object.entries(cart)
    .map(([id, qty]) => ({ item: menu.find((m) => m.id === id), id, qty }))
    .filter((l): l is { item: MenuItem; id: string; qty: number } => Boolean(l.item));

  if (lines.length === 0) {
    return (
      <div className="stack">
        <p>Your cart is empty.</p>
        <Link className="btn btn-primary" href="/#menu">Shop the menu</Link>
      </div>
    );
  }

  const sub = lines.reduce((s, l) => s + l.item.price_cents * l.qty, 0);
  const canna = lines.filter((l) => l.item.category !== "gear").reduce((s, l) => s + l.item.price_cents * l.qty, 0);
  const flowerG = lines.filter((l) => l.item.category === "flower").reduce((s, l) => s + Number(l.item.weight_g) * l.qty, 0);
  const concG = lines.filter((l) => l.item.category === "concentrate").reduce((s, l) => s + Number(l.item.weight_g) * l.qty, 0);
  const excise = Math.round(canna * limits.excise);
  const tax = Math.round(sub * limits.tax);
  const total = sub + excise + tax + limits.fee;

  const problems = [
    flowerG > limits.maxFlower && `Flower is limited to ${limits.maxFlower} g per order (you have ${flowerG} g).`,
    concG > limits.maxConcentrate && `Concentrates are limited to ${limits.maxConcentrate} g per order (you have ${concG} g).`,
    sub < limits.minOrder && `The order minimum is ${money(limits.minOrder)}.`,
    lines.some((l) => !l.item.in_stock) && "Remove items that are out of stock.",
    !open && "Delivery is closed right now.",
  ].filter(Boolean) as string[];

  return (
    <div className="checkout-grid">
      <section>
        <ul className="cart-lines">
          {lines.map(({ item, qty }) => (
            <li key={item.id}>
              <div>
                <strong>{item.name}</strong>
                <div className="small muted">
                  {categoryLabel[item.category]} · {item.subcategory}
                  {item.weight_g ? ` · ${grams(item.weight_g)}` : ""}
                  {!item.in_stock && " · out of stock"}
                </div>
              </div>
              <div className="row">
                <div className="stepper">
                  <button className="btn btn-small" onClick={() => setQty(item.id, qty - 1)} aria-label={`Remove one ${item.name}`}>−</button>
                  <span>{qty}</span>
                  <button className="btn btn-small" onClick={() => setQty(item.id, qty + 1)} aria-label={`Add one ${item.name}`} disabled={qty >= 20}>+</button>
                </div>
                <span className="num" style={{ minWidth: "5rem" }}>{money(item.price_cents * qty)}</span>
              </div>
            </li>
          ))}
        </ul>
        <table className="receipt-table totals" style={{ marginTop: "1rem" }}>
          <tbody>
            <tr><td>Subtotal</td><td className="num">{money(sub)}</td></tr>
            {excise > 0 && <tr><td>Cannabis excise tax</td><td className="num">{money(excise)}</td></tr>}
            <tr><td>Sales tax</td><td className="num">{money(tax)}</td></tr>
            <tr><td>Delivery</td><td className="num">{money(limits.fee)}</td></tr>
            <tr className="grand"><td>Estimated total</td><td className="num">{money(total)}</td></tr>
          </tbody>
        </table>
        <p className="small muted">Final prices and taxes are confirmed when you place the order.</p>
      </section>

      <section className="panel stack">
        <h2>Checkout</h2>
        {readiness !== "ready" ? (
          <>
            <p>{blockers[readiness].text}</p>
            <Link className="btn btn-primary" href={blockers[readiness].href}>{blockers[readiness].cta}</Link>
          </>
        ) : (
          <form action={action} className="form">
            <input type="hidden" name="items" value={JSON.stringify(cart)} />
            <fieldset className="stack" style={{ border: 0, padding: 0, margin: 0 }}>
              <legend className="small muted">Deliver to</legend>
              {addresses.map((a, i) => (
                <label key={a.id} className="choice">
                  <input type="radio" name="address" value={a.id} defaultChecked={i === 0 && a.inZone} disabled={!a.inZone} required />
                  <span>
                    <strong>{a.label}</strong> — {a.line1}, {a.city}
                    {!a.inZone && <span className="small muted"> (outside delivery area)</span>}
                  </span>
                </label>
              ))}
            </fieldset>
            <fieldset className="stack" style={{ border: 0, padding: 0, margin: 0 }}>
              <legend className="small muted">Pay at the door</legend>
              <label className="choice"><input type="radio" name="payment" value="cash" defaultChecked /> Cash</label>
              <label className="choice"><input type="radio" name="payment" value="debit_at_door" /> Debit card</label>
            </fieldset>
            <label>
              Note for the driver <span className="hint">optional</span>
              <input name="notes" maxLength={300} />
            </label>
            <p className="small">Have your ID ready. The driver checks it before handing anything over.</p>
            {problems.map((p) => <p key={p} className="notice notice-warn">{p}</p>)}
            {state?.error && <p className="notice notice-error" role="alert">{state.error}</p>}
            <button className="btn btn-primary btn-block" disabled={pending || problems.length > 0}>
              {pending ? "Placing order…" : `Place order · ${money(total)}`}
            </button>
          </form>
        )}
      </section>
    </div>
  );
}
