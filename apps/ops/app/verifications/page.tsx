import { when } from "@iron40/core/format";
import { reviewAction } from "../actions";
import { requireStaff } from "../lib";
import { ActionForm, AutoRefresh } from "../ui";

export const metadata = { title: "ID review" };

function age(dob: string) {
  const d = new Date(dob);
  const now = new Date();
  let a = now.getFullYear() - d.getFullYear();
  if (now.getMonth() < d.getMonth() || (now.getMonth() === d.getMonth() && now.getDate() < d.getDate())) a--;
  return a;
}

export default async function Verifications() {
  const { supabase } = await requireStaff();
  const { data: pending } = await supabase
    .from("customers")
    .select("user_id, full_name, dob, phone, id_front_path, selfie_path, submitted_at")
    .eq("id_status", "pending")
    .order("submitted_at")
    .limit(20);

  // Short-lived signed links (2 minutes), generated with the reviewer's own session; storage RLS limits them to this operator.
  const bucket = supabase.storage.from("id-docs");
  const rows = await Promise.all(
    (pending ?? []).map(async (c) => {
      const paths = [c.id_front_path, c.selfie_path].filter(Boolean) as string[];
      const { data } = await bucket.createSignedUrls(paths, 120);
      return { ...c, front: data?.[0]?.signedUrl, selfie: data?.[1]?.signedUrl };
    }),
  );

  return (
    <div className="stack">
      <AutoRefresh every={60000} />
      <h1>ID review</h1>
      <p className="muted">
        Approve only if the name and date of birth on the ID match the profile exactly, the ID is unexpired, and the
        selfie is the same person.
      </p>
      {rows.length === 0 && <p className="box">Nothing waiting. New submissions appear here.</p>}
      {rows.map((c) => (
        <section key={c.user_id} className="box id-review">
          <figure style={{ margin: 0 }}>
            {c.front ? <img src={c.front} alt={`ID for ${c.full_name}`} referrerPolicy="no-referrer" /> : <p>Missing</p>}
            <figcaption className="small muted">ID front</figcaption>
          </figure>
          <figure style={{ margin: 0 }}>
            {c.selfie ? <img src={c.selfie} alt={`Selfie for ${c.full_name}`} referrerPolicy="no-referrer" /> : <p>Missing</p>}
            <figcaption className="small muted">Selfie</figcaption>
          </figure>
          <div className="stack">
            <div>
              <h2 style={{ marginBottom: "0.2rem" }}>{c.full_name}</h2>
              <div>Born {c.dob} · <strong>{age(c.dob)} years old</strong></div>
              <div className="small muted">Submitted {when(c.submitted_at)}</div>
            </div>
            <ActionForm action={reviewAction} submit="Approve">
              <input type="hidden" name="customer" value={c.user_id} />
              <input type="hidden" name="decision" value="approve" />
              <label className="choice"><input type="checkbox" name="matches" required /> Name and date of birth match the ID</label>
              <label className="choice"><input type="checkbox" name="valid" required /> ID is unexpired and the selfie matches</label>
            </ActionForm>
            <ActionForm action={reviewAction} submit="Reject" danger>
              <input type="hidden" name="customer" value={c.user_id} />
              <input type="hidden" name="decision" value="reject" />
              <label>
                Reason the customer will see
                <select name="reason" required defaultValue="">
                  <option value="" disabled>Choose one</option>
                  <option>Photo is blurry or cut off</option>
                  <option>ID is expired</option>
                  <option>Name or date of birth doesn't match your profile</option>
                  <option>Selfie doesn't match the ID</option>
                  <option>Not an accepted form of ID</option>
                </select>
              </label>
            </ActionForm>
          </div>
        </section>
      ))}
    </div>
  );
}
