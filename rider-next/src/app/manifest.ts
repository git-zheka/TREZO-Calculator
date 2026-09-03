import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Райдер — облік прокату",
    short_name: "Райдер",
    description: "Замовлення, обладнання, окупність і календар зайнятості",
    start_url: "/",
    display: "standalone",
    background_color: "#eceeeb",
    theme_color: "#a75708",
    lang: "uk",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
