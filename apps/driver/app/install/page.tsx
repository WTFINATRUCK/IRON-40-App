import { headers } from "next/headers";
import { InstallGuide } from "@iron40/core/components/InstallGuide";
import { detectPlatform } from "@iron40/core/install";

export const metadata = { title: "Install" };

export default async function Install() {
  const ua = (await headers()).get("user-agent") ?? "";
  return (
    <div className="stack">
      <h1>Install the driver app</h1>
      <p className="muted">Keep it open while you're online so location updates reach dispatch.</p>
      <InstallGuide appName="wee-d-liver Driver" initialPlatform={detectPlatform(ua)} />
    </div>
  );
}
