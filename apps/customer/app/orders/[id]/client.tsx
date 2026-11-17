"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { cancelOrder } from "./actions";

export function Refresher({ every = 15000 }: { every?: number }) {
  const router = useRouter();
  useEffect(() => {
    const t = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, every);
    return () => clearInterval(t);
  }, [router, every]);
  return null;
}

export function CancelButton({ id }: { id: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <div>
      <button
        className="btn btn-danger"
        disabled={pending}
        onClick={() => {
          if (!confirm("Cancel this order?")) return;
          start(async () => setError(await cancelOrder(id)));
        }}
      >
        {pending ? "Canceling…" : "Cancel order"}
      </button>
      {error && <p className="notice notice-error" role="alert">{error}</p>}
    </div>
  );
}
