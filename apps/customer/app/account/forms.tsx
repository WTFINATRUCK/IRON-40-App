"use client";

import { useActionState, useState } from "react";
import { addAddress, saveProfile, submitId } from "./actions";

type State = { error?: string; ok?: string } | undefined;

function Status({ state }: { state: State }) {
  if (state?.error) return <p className="notice notice-error" role="alert">{state.error}</p>;
  if (state?.ok) return <p className="notice" role="status">{state.ok}</p>;
  return null;
}

export function ProfileForm({
  initial,
  locked,
}: {
  initial: { full_name: string; phone: string; dob: string };
  locked: boolean;
}) {
  const [state, action, pending] = useActionState(saveProfile, undefined);
  return (
    <form action={action} className="form">
      <label>
        Full legal name <span className="hint">exactly as it appears on your ID</span>
        <input name="full_name" defaultValue={initial.full_name} required maxLength={80} readOnly={locked} autoComplete="name" />
      </label>
      <div className="field-grid">
        <label>
          Date of birth
          <input name="dob" type="date" defaultValue={initial.dob} required readOnly={locked} autoComplete="bday" />
        </label>
        <label>
          Mobile phone
          <input name="phone" type="tel" defaultValue={initial.phone} required maxLength={20} autoComplete="tel" />
        </label>
      </div>
      {locked && <p className="hint">Name and date of birth are locked after your ID is submitted.</p>}
      <Status state={state} />
      <button className="btn btn-primary" disabled={pending}>{pending ? "Saving…" : "Save profile"}</button>
    </form>
  );
}

export function IdForm() {
  const [state, action, pending] = useActionState(submitId, undefined);
  return (
    <form action={action} className="form">
      <div className="id-photos">
        <label>
          Front of your ID
          <span className="hint"> driver's license, state ID or passport</span>
          <input name="id_front" type="file" accept="image/jpeg,image/png,image/webp" capture="environment" required />
        </label>
        <label>
          A selfie
          <span className="hint"> face clearly visible, good light</span>
          <input name="selfie" type="file" accept="image/jpeg,image/png,image/webp" capture="user" required />
        </label>
      </div>
      <p className="hint">
        Photos are stored privately, seen only by our ID reviewers, and stripped of location data before storage.
      </p>
      <Status state={state} />
      <button className="btn btn-primary" disabled={pending}>{pending ? "Uploading…" : "Submit ID for review"}</button>
    </form>
  );
}

export function AddressForm() {
  const [state, action, pending] = useActionState(addAddress, undefined);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [geoError, setGeoError] = useState<string | null>(null);

  return (
    <form action={action} className="form">
      <div className="field-grid">
        <label>Label<input name="label" placeholder="Home" maxLength={30} /></label>
        <label>Street address<input name="line1" required maxLength={120} autoComplete="address-line1" /></label>
        <label>Apt, suite, floor<input name="line2" maxLength={60} autoComplete="address-line2" /></label>
        <label>City<input name="city" required maxLength={60} autoComplete="address-level2" /></label>
        <label>State<input name="state" required maxLength={2} placeholder="NY" autoComplete="address-level1" /></label>
        <label>ZIP<input name="zip" required maxLength={10} inputMode="numeric" autoComplete="postal-code" /></label>
      </div>
      <label>
        Notes for the driver
        <input name="instructions" maxLength={200} placeholder="Buzzer, gate code, which door" />
      </label>
      <input type="hidden" name="lat" value={coords?.lat ?? ""} />
      <input type="hidden" name="lng" value={coords?.lng ?? ""} />
      <div className="row">
        <button
          type="button"
          className="btn"
          onClick={() => {
            setGeoError(null);
            navigator.geolocation.getCurrentPosition(
              (p) => setCoords({ lat: +p.coords.latitude.toFixed(6), lng: +p.coords.longitude.toFixed(6) }),
              () => setGeoError("Location is blocked. Allow it in your browser settings and try again."),
              { enableHighAccuracy: true, timeout: 15000 },
            );
          }}
        >
          Use my current location
        </button>
        {coords && <span className="small muted">Pinned ✓</span>}
      </div>
      {geoError && <p className="notice notice-warn">{geoError}</p>}
      <Status state={state} />
      <button className="btn btn-primary" disabled={pending || !coords}>{pending ? "Saving…" : "Save address"}</button>
    </form>
  );
}
