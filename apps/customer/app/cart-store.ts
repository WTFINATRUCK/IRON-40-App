"use client";

import { useSyncExternalStore } from "react";

// The cart only holds product ids and quantities. Prices and totals are always recomputed on the server.
export type Cart = Record<string, number>;
const KEY = "i40_cart";
const listeners = new Set<() => void>();
let cache: Cart | null = null;

function read(): Cart {
  if (cache) return cache;
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? "{}");
    const clean: Cart = {};
    for (const [k, v] of Object.entries(raw)) {
      if (/^[0-9a-f-]{36}$/.test(k) && Number.isInteger(v) && (v as number) > 0 && (v as number) <= 20) clean[k] = v as number;
    }
    cache = clean;
  } catch {
    cache = {};
  }
  return cache;
}

function write(next: Cart) {
  cache = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {}
  listeners.forEach((l) => l());
}

const EMPTY: Cart = {};
export function useCart(): Cart {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      const onStorage = (e: StorageEvent) => {
        if (e.key === KEY) {
          cache = null;
          l();
        }
      };
      window.addEventListener("storage", onStorage);
      return () => {
        listeners.delete(l);
        window.removeEventListener("storage", onStorage);
      };
    },
    read,
    () => EMPTY,
  );
}

export function setQty(id: string, qty: number) {
  const next = { ...read() };
  if (qty <= 0) delete next[id];
  else next[id] = Math.min(20, qty);
  write(next);
}

export function clearCart() {
  write({});
}
