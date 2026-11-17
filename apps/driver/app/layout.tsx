import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import "@fontsource-variable/archivo/wdth.css";
import "@iron40/core/styles.css";
import "./globals.css";
import { Brand } from "@iron40/core/components/Brand";
import { ServiceWorker } from "@iron40/core/components/ServiceWorker";

export const metadata: Metadata = {
  title: { default: "wee-d-liver Driver", template: "%s · wee-d-liver Driver" },
  robots: { index: false, follow: false },
  appleWebApp: { capable: true, title: "wee-d Driver", statusBarStyle: "black-translucent" },
  icons: { icon: "/icons/icon-192.png", apple: "/icons/apple-touch-icon.png" },
};

export const viewport: Viewport = { themeColor: "#1a1d20", width: "device-width", initialScale: 1, viewportFit: "cover" };

export default async function Layout({ children }: { children: React.ReactNode }) {
  await headers();
  return (
    <html lang="en">
      <body data-theme="night">
        <header className="dtop">
          <Link href="/" className="brand-link"><Brand suffix="Driver" /></Link>
        </header>
        <main className="dmain">{children}</main>
        <ServiceWorker />
      </body>
    </html>
  );
}
