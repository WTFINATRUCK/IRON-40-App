import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import "@fontsource-variable/archivo/wdth.css";
import "@iron40/core/styles.css";
import "./globals.css";
import { Brand } from "@iron40/core/components/Brand";
import { ServiceWorker } from "@iron40/core/components/ServiceWorker";
import { getTenant, hourLabel } from "./lib";
import { AgeGate } from "./age-gate";
import { CartLink } from "./cart-link";

export const metadata: Metadata = {
  title: { default: "IRON 40 — cannabis delivery", template: "%s · IRON 40" },
  description: "Flower, concentrates and gear from a licensed shop, delivered. 21+ with valid ID.",
  appleWebApp: { capable: true, title: "IRON 40", statusBarStyle: "default" },
  icons: { icon: "/icons/icon-192.png", apple: "/icons/apple-touch-icon.png" },
};

export const viewport: Viewport = { themeColor: "#23272b", width: "device-width", initialScale: 1 };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  await headers(); // per-request rendering so the CSP nonce reaches every script
  const tenant = await getTenant();
  return (
    <html lang="en">
      <body>
        <a className="visually-hidden" href="#main">Skip to content</a>
        <header className="top">
          <div className="wrap spread">
            <Link href="/" className="brand-link"><Brand /></Link>
            <nav className="row nav" aria-label="Main">
              <Link href="/orders">Orders</Link>
              <Link href="/account">Account</Link>
              <CartLink />
            </nav>
          </div>
        </header>
        <main id="main">{children}</main>
        <footer className="foot">
          <div className="wrap small">
            <p>
              {tenant.name} is a licensed cannabis retailer ({tenant.license_state} license {tenant.license_number}).
              Delivery {hourLabel(tenant.open_hour)} to {hourLabel(tenant.close_hour)}. Adults 21 and older only; a valid
              government ID is checked at the door. Keep cannabis away from children and pets. Don't drive high.
            </p>
            <p className="row">
              <Link href="/install">Add to home screen</Link>
            </p>
          </div>
        </footer>
        <AgeGate />
        <ServiceWorker />
      </body>
    </html>
  );
}
