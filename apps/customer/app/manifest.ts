import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "wee-d-liver",
    short_name: "wee-d-liver",
    description: "Cannabis delivery from a licensed shop. 21+.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#e4e6e1",
    theme_color: "#23272b",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
