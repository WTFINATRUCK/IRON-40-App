"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { complete, fail, ping, redeemAction, setOnline } from "./actions";

type State = { error?: string; ok?: string } | undefined;

function Msg({ state }: { state: State }) {
  if (state?.error) return <p className="notice notice-error" role="alert">{state.error}</p>;
  if (state?.ok) return <p className="notice" role="status">{state.ok}</p>;
  return null;
}

export function RedeemForm() {
  const [state, action, pending] = useActionState(redeemAction, undefined);
  return (
    <form action={action} className="form">
      <label>Invite code<input name="code" required placeholder="XXXX-XXXX-XXXX" autoCapitalize="characters" autoComplete="off" maxLength={20} /></label>
      <label>First name customers see<input name="name" required maxLength={40} autoComplete="given-name" /></label>
      <label>Mobile phone<input name="phone" type="tel" required maxLength={20} autoComplete="tel" /></label>
      <label>Vehicle <span className="hint">color and model, so customers can spot you</span><input name="vehicle" maxLength={80} /></label>
      <Msg state={state} />
      <button className="btn btn-primary" disabled={pending}>{pending ? "Checking…" : "Join"}</button>
    </form>
  );
}

function getPosition(): Promise<GeolocationPosition> {
  return new Promise((res, rej) =>
    navigator.geolocation.getCurrentPosition(res, rej, { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 }),
  );
}

// Online/offline switch. While online, sends the phone's location every 45 s (only while the app is open)
// and refreshes the job list so newly dispatched orders appear.
export function ShiftSwitch({ online }: { online: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const last = useRef(0);

  useEffect(() => {
    if (!online) return;
    const tick = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const p = await getPosition();
        if (Date.now() - last.current > 40000) {
          last.current = Date.now();
          await ping(p.coords.latitude, p.coords.longitude);
        }
      } catch {
        setError("Location is off. Orders won't come in until it's back on.");
      }
      router.refresh();
    };
    tick();
    const t = setInterval(tick, 45000);
    return () => clearInterval(t);
  }, [online, router]);

  return (
    <div className="stack">
      <div className={`shift ${online ? "is-online" : ""}`}>
        <div>
          <div className="shift-state">{online ? "Online" : "Offline"}</div>
          <div className="small muted">{online ? "You'll get orders you have stock for." : "Go online to receive orders."}</div>
        </div>
        <button
          className={`btn switch ${online ? "" : "btn-primary"}`}
          disabled={pending}
          onClick={() =>
            start(async () => {
              setError(null);
              if (online) {
                setError(await setOnline(false));
                return;
              }
              try {
                const p = await getPosition();
                setError(await setOnline(true, p.coords.latitude, p.coords.longitude));
              } catch {
                setError("Allow location access to go online.");
              }
            })
          }
        >
          {pending ? "…" : online ? "Go offline" : "Go online"}
        </button>
      </div>
      {error && <p className="notice notice-error" role="alert">{error}</p>}
    </div>
  );
}

export function DoorCheck({ orderId, customerName }: { orderId: string; customerName: string }) {
  const [state, action, pending] = useActionState(complete, undefined);
  return (
    <form action={action} className="door form">
      <h2>Check ID before handing over</h2>
      <p>
        Ask for a government photo ID. The name must be <strong>{customerName}</strong>.
      </p>
      <input type="hidden" name="order" value={orderId} />
      <label className="choice"><input type="checkbox" name="photo_match" required /> Photo matches the person at the door</label>
      <label className="choice"><input type="checkbox" name="not_expired" required /> ID is not expired</label>
      <label>
        Birth year printed on the ID
        <input name="birth_year" inputMode="numeric" pattern="[0-9]{4}" maxLength={4} required className="big-num" autoComplete="off" />
      </label>
      <Msg state={state} />
      <button className="btn btn-primary btn-block" disabled={pending || Boolean(state?.ok)}>
        {pending ? "Checking…" : "Confirm ID and complete"}
      </button>
    </form>
  );
}

export function FailForm({ orderId }: { orderId: string }) {
  const [state, action, pending] = useActionState(fail, undefined);
  return (
    <details>
      <summary className="btn btn-danger btn-block">Can't deliver</summary>
      <form action={action} className="form" style={{ marginTop: "0.75rem" }}>
        <input type="hidden" name="order" value={orderId} />
        <label>
          What happened?
          <select name="reason" required defaultValue="">
            <option value="" disabled>Choose one</option>
            <option>No valid ID</option>
            <option>Customer appears intoxicated</option>
            <option>Customer not home / no answer</option>
            <option>Person appears under 21</option>
            <option>Unsafe location</option>
            <option>Vehicle problem</option>
          </select>
        </label>
        <Msg state={state} />
        <button className="btn btn-danger" disabled={pending}>Mark not delivered</button>
      </form>
    </details>
  );
}
