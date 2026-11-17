import { locationAction } from "../actions";
import { requireStaff } from "../lib";
import { ActionForm, LocateButton } from "../ui";

export const metadata = { title: "Hubs" };

export default async function Locations() {
  const { supabase } = await requireStaff(["owner", "admin"]);
  const { data: locations } = await supabase.from("locations").select("*").order("name");
  return (
    <div className="stack">
      <h1>Hubs and delivery areas</h1>
      <p className="muted">
        Customers can order only inside a hub's radius. Hub addresses and coordinates are never shown to customers.
      </p>
      {[...(locations ?? []), null].map((l) => (
        <section key={l?.id ?? "new"} className="box">
          <h2>{l ? l.name : "Add a hub"}</h2>
          <ActionForm action={locationAction} submit={l ? "Save hub" : "Add hub"}>
            <input type="hidden" name="id" value={l?.id ?? ""} />
            <div className="field-grid">
              <label>Name<input name="name" required maxLength={80} defaultValue={l?.name ?? ""} /></label>
              <label>Address<input name="address" required maxLength={200} defaultValue={l?.address ?? ""} /></label>
              <label>Delivery radius (km)<input name="radius_km" type="number" step="0.5" min={1} max={150} required defaultValue={l?.radius_km ?? 15} /></label>
            </div>
            <LocateButton lat={l?.lat} lng={l?.lng} />
            <label className="choice"><input type="checkbox" name="active" defaultChecked={l?.active ?? true} /> Accepting orders</label>
          </ActionForm>
        </section>
      ))}
    </div>
  );
}
