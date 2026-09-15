import type { Metadata, Viewport } from "next";
import "@fontsource-variable/manrope";
import "@fontsource-variable/space-grotesk";
import "./globals.css";
import "./visual-upgrade.css";
import "./cinematic.css";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://github.com/sumaharpelluri2027-tech/portfolio";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: "Sumahar Pelluri — Systems Builder", template: "%s — Sumahar Pelluri" },
  description: "I turn messy manual processes into intelligent systems across AI, data, operations, product, and automation.",
  keywords: ["Sumahar Pelluri", "Systems Builder", "AI automation", "Data operations", "Product strategy", "Founder’s Office"],
  authors: [{ name: "Sumahar Pelluri" }],
  creator: "Sumahar Pelluri",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    title: "Sumahar Pelluri — Systems Builder",
    description: "Messy process in. Intelligent system out.",
    url: "/",
    siteName: "Sumahar Pelluri",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "Sumahar Pelluri — Systems Builder" }]
  },
  twitter: { card: "summary_large_image", title: "Sumahar Pelluri — Systems Builder", description: "Messy process in. Intelligent system out.", images: ["/og.png"] },
  icons: { icon: "/favicon.svg" }
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: [{ media: "(prefers-color-scheme: dark)", color: "#0b0d0f" }, { media: "(prefers-color-scheme: light)", color: "#f4f2ec" }] };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en" suppressHydrationWarning><body>{children}</body></html>;
}
