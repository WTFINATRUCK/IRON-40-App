"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState } from "react";

type State = { error?: string; ok?: string } | undefined;

export function ActionForm({
  action,
  submit,
  children,
  className = "form",
  danger,
  confirmText,
  showOkAsCode,
}: {
  action: (prev: State, form: FormData) => Promise<State>;
  submit: string;
  children?: React.ReactNode;
  className?: string;
  danger?: boolean;
  confirmText?: string;
  showOkAsCode?: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  return (
    <form
      action={formAction}
      className={className}
      onSubmit={(e) => {
        if (confirmText && !confirm(confirmText)) e.preventDefault();
      }}
    >
      {children}
      {state?.error && <p className="notice notice-error" role="alert">{state.error}</p>}
      {state?.ok &&
        (showOkAsCode ? (
          <div className="notice" role="status">
            <div className="small">Share this code once. It expires in 48 hours and can't be shown again.</div>
            <code className="invite-code">{state.ok}</code>
          </div>
        ) : (
          <p className="notice" role="status">{state.ok}</p>
        ))}
      <button className={`btn ${danger ? "btn-danger" : "btn-primary"}`} disabled={pending}>
        {pending ? "Working…" : submit}
      </button>
    </form>
  );
}

export function LocateButton({ latName = "lat", lngName = "lng", lat, lng }: { latName?: string; lngName?: string; lat?: number; lng?: number }) {
  const [c, setC] = useState<{ lat?: number; lng?: number }>({ lat, lng });
  return (
    <div className="field-grid">
      <label>Latitude<input name={latName} value={c.lat ?? ""} onChange={(e) => setC({ ...c, lat: Number(e.target.value) })} inputMode="decimal" required /></label>
      <label>Longitude<input name={lngName} value={c.lng ?? ""} onChange={(e) => setC({ ...c, lng: Number(e.target.value) })} inputMode="decimal" required /></label>
      <div style={{ alignSelf: "end" }}>
        <button
          type="button"
          className="btn"
          onClick={() =>
            navigator.geolocation.getCurrentPosition((p) =>
              setC({ lat: +p.coords.latitude.toFixed(6), lng: +p.coords.longitude.toFixed(6) }),
            )
          }
        >
          Use my location
        </button>
      </div>
    </div>
  );
}

export function AutoRefresh({ every = 20000 }: { every?: number }) {
  const router = useRouter();
  useEffect(() => {
    const t = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, every);
    return () => clearInterval(t);
  }, [every, router]);
  return null;
}
