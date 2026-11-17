import Link from "next/link";
import { StatusPill } from "@iron40/core/components/Brand";
import { when } from "@iron40/core/format";
import { inviteAction, revokeInviteAction } from "../actions";
import { ago, requireStaff } from "../lib";
import { ActionForm } from "../ui";

export const metadata = { title: "Drivers" };

export default async function Drivers() {
  const { supabase, who } = await requireStaff();
  const canInvite = who.role === "owner" || who.role === "admin";
  const [{ data: drivers }, { data: invites }] = await Promise.all([
    supabase.from("drivers").select("user_id, display_name, phone, vehicle, status, last_seen_at, active").order("display_name"),
    canInvite
      ? supabase.from("invites").select("id, label, kind, expires_at, used_at").eq("kind", "driver").is("used_at", null).gt("expires_at", new Date().toISOString())
      : Promise.resolve({ data: [] as { id: string; label: string; expires_at: string }[] }),
  ]);

  return (
    <div className="stack">
      <h1>Drivers</h1>
      <div className="grid-2">
        <section className="box">
          <table className="table">
            <thead><tr><th>Driver</th><th>Vehicle</th><th>Status</th><th>Last ping</th></tr></thead>
            <tbody>
              {(drivers ?? []).map((d) => (
                <tr key={d.user_id}>
                  <td><Link href={`/drivers/${d.user_id}`}>{d.display_name}</Link><div className="small muted">{d.phone}</div></td>
                  <td className="small">{d.vehicle}</td>
                  <td>{d.active ? <StatusPill status={d.status} label={d.status === "online" ? "Online" : "Offline"} /> : <StatusPill status="canceled" label="Paused" />}</td>
                  <td className="small">{ago(d.last_seen_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!drivers?.length && <p className="muted">No drivers yet.</p>}
        </section>
        {canInvite && (
          <section className="box stack">
            <h2>Invite a driver</h2>
            <p className="small muted">
              Drivers can't sign up on their own. Create a one-time code, give it to the driver in person, and they enter
              it in the driver app after creating their account.
            </p>
            <ActionForm action={inviteAction} submit="Create invite code" showOkAsCode>
              <input type="hidden" name="kind" value="driver" />
              <label>Who is it for?<input name="label" placeholder="e.g. Marcus, Tuesday hire" maxLength={80} /></label>
            </ActionForm>
            {invites && invites.length > 0 && (
              <>
                <h3>Open invites</h3>
                <ul className="small">
                  {invites.map((i) => (
                    <li key={i.id} className="spread">
                      <span>{i.label || "Unlabeled"} · expires {when(i.expires_at)}</span>
                      <form action={revokeInviteAction}><input type="hidden" name="id" value={i.id} /><button className="btn btn-small btn-danger">Revoke</button></form>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </section>
        )}
      </div>
    </div>
  );
}
