import type { Metadata, Viewport } from "next";
import { Geist, Outfit } from "next/font/google";
import { AuthProvider } from "@/lib/auth-context";
import { Analytics } from "@/components/analytics";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import "./globals.css";

const geist = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
  display: "swap",
  weight: ["600", "700", "800"],
});

export const metadata: Metadata = {
  title: {
    default: "VenueBook — Book the KNCHS Gymnasium & AVR",
    template: "%s · VenueBook",
  },
  description:
    "Reserve the KNCHS Gymnasium or AVR in seconds. Check live availability, send your request for approval, and track every reservation in one place.",
  applicationName: "VenueBook",
  keywords: ["KNCHS", "VenueBook", "gymnasium booking", "AVR reservation", "Koronadal"],
  authors: [{ name: "VenueBook" }],
  openGraph: {
    title: "VenueBook",
    description: "Your Space, Your Schedule. Book the KNCHS Gymnasium or AVR with ease.",
    type: "website",
    siteName: "VenueBook",
  },
};

export const viewport: Viewport = {
  themeColor: "#7a1935",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${geist.variable} ${outfit.variable}`}>
      <body className="min-h-screen bg-cream-100 font-sans text-neutral-800 antialiased">
        <AuthProvider>
          <Analytics />
          <div className="flex min-h-screen flex-col">
            <SiteHeader />
            <main className="flex-1">{children}</main>
            <SiteFooter />
          </div>
        </AuthProvider>
      </body>
    </html>
  );
}