"use client";

import Link from "next/link";
import { useCart } from "./cart-store";

export function CartLink() {
  const cart = useCart();
  const count = Object.values(cart).reduce((a, b) => a + b, 0);
  return (
    <Link href="/cart" className="cart-link">
      Cart{count > 0 && <span className="cart-count" aria-label={`${count} items`}>{count}</span>}
    </Link>
  );
}
