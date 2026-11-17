import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import "@fontsource-variable/archivo/wdth.css";
import "@iron40/core/styles.css";
import "./globals.css";
import { Brand } from "@iron40/core/components/Brand";
import { ServiceWorker } from "@iron40/core/components/ServiceWorker";
import { whoami } from "@iron40/core/supabase/server";
import { signOutAction } from "./actions";

export const metadata: Metadata = {
  title: { default: "wee-d-liver Ops", template: "%s · wee-d-liver Ops" },
  robots: { index: false, follow: false },
  icons: { icon: "/icons/icon-192.png", apple: "/icons/apple-touch-icon.png" },
};
export const viewport: Viewport = { themeColor: "#23272b", width: "device-width", initialScale: 1 };

const NAV = [
  ["/", "Live"],
  ["/orders", "Orders"],
  ["/verifications", "ID review"],
  ["/drivers", "Drivers"],
  ["/inventory", "Inventory"],
  ["/products", "Products"],
  ["/locations", "Hubs"],
  ["/marketing", "QR & marketing"],
  ["/settings", "Settings"],
  ["/audit", "Audit log"],
] as const;

export default async function Layout({ children }: { children: React.ReactNode }) {
  await headers();
  const { who } = await whoami("ops");
  const staff = who.kind === "staff";
  return (
    <html lang="en">
      <body>
        <div className={staff ? "shell" : "shell-bare"}>
          <aside className="side">
            <Link href="/" className="brand-link"><Brand suffix="Ops" /></Link>
            {staff && (
              <>
                <nav aria-label="Ops">
                  {NAV.map(([href, label]) => (
                    <Link key={href} href={href}>{label}</Link>
                  ))}
                </nav>
                <div className="side-foot small">
                  <div>{who.name || "Staff"} · {who.role}</div>
                  <form action={signOutAction}><button className="btn btn-small">Sign out</button></form>
                </div>
              </>
            )}
          </aside>
          <main className="content">{children}</main>
        </div>
        <ServiceWorker />
      </body>
    </html>
  );
}
