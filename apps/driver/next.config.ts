import type { NextConfig } from "next";
import path from "node:path";

const security = [
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
  { key: "X-Robots-Tag", value: "noindex, nofollow" },
  {
    key: "Permissions-Policy",
    value: "geolocation=(self), camera=(), microphone=(), payment=(), usb=(), browsing-topics=()",
  },
];

const config: NextConfig = {
  transpilePackages: ["@iron40/core"],
  poweredByHeader: false,
  reactStrictMode: true,
  productionBrowserSourceMaps: false,
  outputFileTracingRoot: path.join(__dirname, "../.."),
  turbopack: { root: path.join(__dirname, "../..") },
  experimental: { serverActions: { bodySizeLimit: "1mb" } },
  async headers() {
    return [
      { source: "/:path*", headers: security },
      { source: "/sw.js", headers: [{ key: "Cache-Control", value: "no-cache" }, { key: "Service-Worker-Allowed", value: "/" }] },
    ];
  },
};

export default config;
