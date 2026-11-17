import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "IRON 40 Driver",
    short_name: "40 Driver",
    description: "Driver app for IRON 40.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#1a1d20",
    theme_color: "#23272b",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
