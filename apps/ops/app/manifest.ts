import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "IRON 40 Ops",
    short_name: "40 Ops",
    description: "Operator console for IRON 40.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#f4f5f1",
    theme_color: "#23272b",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
