import Link from "next/link";
import { when } from "@iron40/core/format";
import { qrAction } from "../actions";
import { requireStaff } from "../lib";
import { ActionForm } from "../ui";

export const metadata = { title: "QR & marketing" };

export default async function Marketing() {
  const { supabase, who } = await requireStaff();
  const { data: campaigns } = await supabase
    .from("qr_campaigns")
    .select("code, label, placement, scans, last_scan_at, created_at")
    .order("created_at", { ascending: false });

  return (
    <div className="stack">
      <h1>QR codes</h1>
      <p className="muted">
        Make one code per placement so you can see which spots work. Each scan opens the install page with the right
        steps for the person's phone.
      </p>
      <div className="grid-2">
        <section className="box">
          <table className="table">
            <thead><tr><th>Campaign</th><th className="num">Scans</th><th>Last scan</th></tr></thead>
            <tbody>
              {(campaigns ?? []).map((c) => (
                <tr key={c.code}>
                  <td><Link href={`/marketing/${c.code}`}>{c.label}</Link><div className="small muted">{c.placement}</div></td>
                  <td className="num"><strong>{c.scans}</strong></td>
                  <td className="small">{c.last_scan_at ? when(c.last_scan_at) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!campaigns?.length && <p className="muted">No campaigns yet.</p>}
        </section>
        {who.role !== "dispatcher" && (
          <section className="box">
            <h2>New QR code</h2>
            <ActionForm action={qrAction} submit="Create QR code">
              <label>Campaign name<input name="label" required maxLength={60} placeholder="Smoke shop counter card, Main St" /></label>
              <label>Where it's placed <span className="hint">optional</span><input name="placement" maxLength={120} placeholder="With owner's permission, by the register" /></label>
            </ActionForm>
          </section>
        )}
      </div>
    </div>
  );
}
