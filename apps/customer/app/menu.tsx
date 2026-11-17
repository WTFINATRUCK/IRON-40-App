"use client";

import { useState } from "react";
import { categoryLabel, grams, money, type Category } from "@iron40/core/format";
import type { MenuItem } from "./lib";
import { setQty, useCart } from "./cart-store";

const CATS: Category[] = ["flower", "concentrate", "gear"];

export function Menu({ items }: { items: MenuItem[] }) {
  const [cat, setCat] = useState<Category>("flower");
  const cart = useCart();
  const rows = items.filter((i) => i.category === cat);
  const subs = [...new Set(rows.map((r) => r.subcategory))];

  return (
    <div>
      <div className="tabs" role="tablist" aria-label="Menu categories">
        {CATS.map((c) => (
          <button
            key={c}
            role="tab"
            aria-selected={cat === c}
            className={`tab ${cat === c ? "tab-on" : ""}`}
            onClick={() => setCat(c)}
          >
            {categoryLabel[c]}
            <span className="tab-count">{items.filter((i) => i.category === c).length}</span>
          </button>
        ))}
      </div>

      <div role="tabpanel">
        {subs.map((s) => (
          <div key={s} className="menu-group">
            <h2 className="menu-sub">{s}</h2>
            <ul className="menu-list">
              {rows
                .filter((r) => r.subcategory === s)
                .map((p) => {
                  const qty = cart[p.id] ?? 0;
                  return (
                    <li key={p.id} className={`menu-row ${p.in_stock ? "" : "is-out"}`}>
                      <div className="menu-main">
                        <h3>{p.name}</h3>
                        <div className="menu-meta">
                          {p.strain && <span className={`strain strain-${p.strain}`}>{p.strain}</span>}
                          {p.thc_pct != null && <span>THC {Number(p.thc_pct)}%</span>}
                          {p.weight_g != null && <span>{grams(p.weight_g)}</span>}
                        </div>
                        {p.description && <p className="muted small">{p.description}</p>}
                      </div>
                      <div className="menu-buy">
                        <strong className="price">{money(p.price_cents)}</strong>
                        {!p.in_stock ? (
                          <span className="muted small">Out right now</span>
                        ) : qty === 0 ? (
                          <button className="btn btn-small btn-primary" onClick={() => setQty(p.id, 1)}>
                            Add<span className="visually-hidden"> {p.name}</span>
                          </button>
                        ) : (
                          <div className="stepper" aria-label={`${p.name} quantity`}>
                            <button className="btn btn-small" onClick={() => setQty(p.id, qty - 1)} aria-label="Remove one">−</button>
                            <span aria-live="polite">{qty}</span>
                            <button className="btn btn-small" onClick={() => setQty(p.id, qty + 1)} aria-label="Add one" disabled={qty >= 20}>+</button>
                          </div>
                        )}
                      </div>
                    </li>
                  );
                })}
            </ul>
          </div>
        ))}
        {rows.length === 0 && <p className="muted">Nothing in this category yet.</p>}
      </div>
    </div>
  );
}
