import { when } from "@iron40/core/format";
import { requireStaff } from "../lib";

export const metadata = { title: "Audit log" };

export default async function Audit() {
  const { supabase } = await requireStaff(["owner", "admin"]);
  const [{ data: rows }, { data: staff }] = await Promise.all([
    supabase.from("audit_log").select("id, actor, action, detail, created_at").order("created_at", { ascending: false }).limit(300),
    supabase.from("staff").select("user_id, name"),
  ]);
  const names = new Map((staff ?? []).map((s) => [s.user_id, s.name]));
  return (
    <div className="stack">
      <h1>Audit log</h1>
      <p className="muted">Every staff action that changes stock, prices, IDs, drivers or settings. Entries can't be edited or deleted from the app.</p>
      <div className="box">
        <table className="table">
          <thead><tr><th>When</th><th>Who</th><th>Action</th><th>Detail</th></tr></thead>
          <tbody>
            {(rows ?? []).map((r) => (
              <tr key={r.id}>
                <td className="small">{when(r.created_at)}</td>
                <td className="small">{(r.actor && names.get(r.actor)) || "Driver / system"}</td>
                <td>{r.action.replace(/_/g, " ")}</td>
                <td className="small"><code>{JSON.stringify(r.detail)}</code></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
