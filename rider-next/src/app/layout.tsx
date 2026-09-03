import type { Metadata, Viewport } from "next";
import { Unbounded, Commissioner, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";

const display = Unbounded({ subsets: ["cyrillic", "latin"], weight: ["600", "700"], variable: "--font-display-src", display: "swap" });
const body = Commissioner({ subsets: ["cyrillic", "latin"], weight: ["400", "500", "600", "700"], variable: "--font-body-src", display: "swap" });
const mono = IBM_Plex_Mono({ subsets: ["cyrillic", "latin"], weight: ["400", "500", "600"], variable: "--font-mono-src", display: "swap" });

export const metadata: Metadata = {
  title: "Райдер",
  description: "Облік прокату звуку та світла: замовлення, окупність, календар",
  appleWebApp: { capable: true, title: "Райдер", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#eceeeb" },
    { media: "(prefers-color-scheme: dark)", color: "#0e100f" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="uk" className={`${display.variable} ${body.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
