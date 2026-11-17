import { redirect } from "next/navigation";
import { StatusPill } from "@iron40/core/components/Brand";
import { whoami } from "@iron40/core/supabase/server";
import { signOutAction } from "../auth-actions";
import { deleteAddress } from "./actions";
import { AddressForm, IdForm, ProfileForm } from "./forms";

export const metadata = { title: "Account" };

const idCopy = {
  unsubmitted: { label: "Not submitted", text: "Add a photo of your ID and a selfie. You only do this once." },
  pending: { label: "In review", text: "We're checking your ID. This usually takes a few minutes during open hours." },
  approved: { label: "Approved", text: "You're verified. Bring the same ID to the door." },
  rejected: { label: "Not approved", text: "Your ID couldn't be approved. Check the reason and submit new photos." },
} as const;

export default async function Account() {
  const { supabase, user, who } = await whoami("customer");
  if (!user) redirect("/login?next=/account");
  if (who.kind !== null && who.kind !== "customer") {
    return (
      <div className="wrap page">
        <h1>Wrong app for this account</h1>
        <p>This email is set up for a different IRON 40 app. Sign out and use a separate email to shop.</p>
        <form action={signOutAction}><button className="btn">Sign out</button></form>
      </div>
    );
  }

  const { data: me } = await supabase
    .from("customers")
    .select("full_name, phone, dob, id_status, rejection_reason")
    .eq("user_id", user.id)
    .maybeSingle();
  const { data: addresses } = await supabase
    .from("addresses")
    .select("id, label, line1, line2, city, state, zip")
    .order("created_at");

  const status = (me?.id_status ?? "unsubmitted") as keyof typeof idCopy;

  return (
    <div className="wrap page stack">
      <div className="spread">
        <h1>Account</h1>
        <form action={signOutAction}><button className="btn btn-small">Sign out</button></form>
      </div>
      <p className="muted small">{user.email}</p>

      <section className="panel stack">
        <h2>1. Your details</h2>
        <ProfileForm
          initial={{ full_name: me?.full_name ?? "", phone: me?.phone ?? "", dob: me?.dob ?? "" }}
          locked={status === "pending" || status === "approved"}
        />
      </section>

      <section className="panel stack">
        <div className="spread">
          <h2>2. ID verification</h2>
          <StatusPill status={status} label={idCopy[status].label} />
        </div>
        <p>{idCopy[status].text}</p>
        {status === "rejected" && me?.rejection_reason && (
          <p className="notice notice-error">Reason: {me.rejection_reason}</p>
        )}
        {!me ? (
          <p className="muted">Save your details first.</p>
        ) : (
          (status === "unsubmitted" || status === "rejected") && <IdForm />
        )}
      </section>

      <section className="panel stack">
        <h2>3. Delivery addresses</h2>
        {addresses && addresses.length > 0 && (
          <ul className="address-list">
            {addresses.map((a) => (
              <li key={a.id}>
                <span>
                  <strong>{a.label}</strong> — {a.line1}
                  {a.line2 ? `, ${a.line2}` : ""}, {a.city}, {a.state} {a.zip}
                </span>
                <form action={deleteAddress}>
                  <input type="hidden" name="id" value={a.id} />
                  <button className="btn btn-small btn-danger">Delete</button>
                </form>
              </li>
            ))}
          </ul>
        )}
        {me ? <AddressForm /> : <p className="muted">Save your details first.</p>}
      </section>
    </div>
  );
}
