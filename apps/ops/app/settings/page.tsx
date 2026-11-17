import { when } from "@iron40/core/format";
import { inviteAction, revokeInviteAction, settingsAction } from "../actions";
import { requireStaff } from "../lib";
import { ActionForm } from "../ui";

export const metadata = { title: "Settings" };

export default async function Settings() {
  const { supabase, who } = await requireStaff(["owner", "admin"]);
  const [{ data: t }, { data: staff }, { data: invites }] = await Promise.all([
    supabase.from("tenants").select("*").eq("id", who.tenant_id).single(),
    supabase.from("staff").select("user_id, name, role, created_at").order("created_at"),
    supabase.from("invites").select("id, label, kind, expires_at").neq("kind", "driver").is("used_at", null).gt("expires_at", new Date().toISOString()),
  ]);
  if (!t) return null;

  return (
    <div className="stack">
      <h1>Settings</h1>
      <div className="grid-2">
        <section className="box">
          <h2>Store and compliance</h2>
          <ActionForm action={settingsAction} submit="Save settings">
            <label>Store name<input name="name" required maxLength={80} defaultValue={t.name} /></label>
            <div className="field-grid">
              <label>License number<input name="license_number" required maxLength={60} defaultValue={t.license_number} /></label>
              <label>License state<input name="license_state" required maxLength={2} defaultValue={t.license_state} /></label>
              <label>Time zone<input name="timezone" required defaultValue={t.timezone} /></label>
              <label>Opens (hour, 0–23)<input name="open_hour" type="number" min={0} max={23} required defaultValue={t.open_hour} /></label>
              <label>Closes (hour, 1–24)<input name="close_hour" type="number" min={1} max={24} required defaultValue={t.close_hour} /></label>
              <label>Cannabis excise (%)<input name="excise_pct" type="number" step="0.01" min={0} max={100} required defaultValue={(Number(t.excise_rate) * 100).toFixed(2)} /></label>
              <label>Sales tax (%)<input name="sales_tax_pct" type="number" step="0.01" min={0} max={100} required defaultValue={(Number(t.sales_tax_rate) * 100).toFixed(2)} /></label>
              <label>Delivery fee ($)<input name="delivery_fee" type="number" step="0.01" min={0} required defaultValue={(t.delivery_fee_cents / 100).toFixed(2)} /></label>
              <label>Order minimum ($)<input name="min_order" type="number" step="0.01" min={0} required defaultValue={(t.min_order_cents / 100).toFixed(2)} /></label>
              <label>Max flower per order (g)<input name="max_flower_g" type="number" step="0.01" min={0.1} required defaultValue={t.max_flower_g} /></label>
              <label>Max concentrate per order (g)<input name="max_concentrate_g" type="number" step="0.01" min={0.1} required defaultValue={t.max_concentrate_g} /></label>
            </div>
            <p className="small muted">Set these to your state's rules. They're enforced in the database on every order.</p>
          </ActionForm>
        </section>
        <section className="box stack">
          <h2>Staff</h2>
          <table className="table">
            <tbody>
              {(staff ?? []).map((s) => <tr key={s.user_id}><td>{s.name || "—"}</td><td>{s.role}</td><td className="small">{when(s.created_at)}</td></tr>)}
            </tbody>
          </table>
          <h3>Invite staff</h3>
          <ActionForm action={inviteAction} submit="Create invite code" showOkAsCode>
            <label>Role
              <select name="kind">
                <option value="dispatcher">Dispatcher — orders, ID review, loading vehicles</option>
                {who.role === "owner" && <option value="admin">Admin — everything except inviting admins</option>}
              </select>
            </label>
            <label>Who is it for?<input name="label" maxLength={80} /></label>
          </ActionForm>
          {invites && invites.length > 0 && (
            <ul className="small">
              {invites.map((i) => (
                <li key={i.id} className="spread">
                  <span>{i.kind}: {i.label || "Unlabeled"} · expires {when(i.expires_at)}</span>
                  <form action={revokeInviteAction}><input type="hidden" name="id" value={i.id} /><button className="btn btn-small btn-danger">Revoke</button></form>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
