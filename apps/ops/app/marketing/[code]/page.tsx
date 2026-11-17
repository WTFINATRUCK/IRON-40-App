import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { env } from "@iron40/core/env";
import { requireStaff } from "../../lib";
import { PrintButton } from "./print";

export default async function Campaign({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  if (!/^[a-z0-9]{6,16}$/.test(code)) notFound();
  const { supabase, who } = await requireStaff();
  const [{ data: c }, { data: t }] = await Promise.all([
    supabase.from("qr_campaigns").select("code, label, placement, scans").eq("code", code).maybeSingle(),
    supabase.from("tenants").select("name, license_number, license_state").eq("id", who.tenant_id).single(),
  ]);
  if (!c || !t) notFound();

  const url = `${env.customerUrl}/q/${c.code}`;
  const svg = await QRCode.toString(url, { type: "svg", errorCorrectionLevel: "M", margin: 2, color: { dark: "#23272b", light: "#ffffff" } });
  const dataUrl = `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;

  return (
    <div className="stack">
      <div className="spread no-print">
        <h1 style={{ margin: 0 }}>{c.label}</h1>
        <div className="row">
          <a className="btn" href={dataUrl} download={`wee-d-liver-${c.code}.svg`}>Download QR (SVG)</a>
          <PrintButton />
        </div>
      </div>
      <p className="muted no-print">{c.scans} scans · links to {url}</p>

      <article className="flyer">
        <div className="flyer-head">
          <span className="flyer-word">wee</span>
          <span className="flyer-plate">d</span>
          <span className="flyer-word">liver</span>
        </div>
        <p className="flyer-line">Licensed cannabis delivery. Scan to put us on your home screen.</p>
        <div className="qr-card">
          <img src={dataUrl} alt={`QR code linking to ${url}`} />
          <ol className="flyer-steps">
            <li>Point your camera at the code and tap the link.</li>
            <li><strong>iPhone:</strong> tap Share, then Add to Home Screen.</li>
            <li><strong>Android:</strong> tap Install app, or ⋮ then Add to Home screen.</li>
            <li>Create an account and verify your ID once.</li>
          </ol>
        </div>
        <p className="flyer-legal">
          21+ only. Valid government ID required at delivery. {t.name}, {t.license_state} license {t.license_number}.
          Keep out of reach of children. Do not post on public property.
        </p>
      </article>
    </div>
  );
}
