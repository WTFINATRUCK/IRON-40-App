import { headers } from "next/headers";
import { InstallGuide } from "@iron40/core/components/InstallGuide";
import { detectPlatform } from "@iron40/core/install";

export const metadata = { title: "Add to home screen" };

export default async function Install() {
  const ua = (await headers()).get("user-agent") ?? "";
  return (
    <div className="wrap page stack">
      <h1>Put wee-d-liver on your phone</h1>
      <p className="muted">
        No app store needed. It opens full-screen like any other app and keeps you signed in.
      </p>
      <section className="panel">
        <InstallGuide appName="wee-d-liver" initialPlatform={detectPlatform(ua)} />
      </section>
    </div>
  );
}
