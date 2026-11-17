"use client";

import { useState, useTransition } from "react";
import { advance } from "../../actions";

export function AdvanceButton({ id, to, label }: { id: string; to: "en_route" | "arrived"; label: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <>
      <button className="btn btn-primary btn-block" disabled={pending} onClick={() => start(async () => setError(await advance(id, to)))}>
        {pending ? "…" : label}
      </button>
      {error && <p className="notice notice-error" role="alert">{error}</p>}
    </>
  );
}
