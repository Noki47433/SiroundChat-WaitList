// Summary: App-wide root layout applying fonts, global styles, and metadata; secondary framework wrapper.
import type { Metadata } from "next";
import Script from "next/script";
import {
  Cormorant_Garamond,
  Inter,
  Manrope,
  Playfair_Display,
  Plus_Jakarta_Sans,
  Sora,
  Space_Grotesk
} from "next/font/google";
import { Suspense } from "react";
import GoogleAnalytics from "./components/GoogleAnalyticsClient";
import "./globals.css";


const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap"
});

const sora = Sora({ subsets: ["latin"], variable: "--font-sora", display: "swap" });
const manrope = Manrope({ subsets: ["latin"], variable: "--font-manrope", display: "swap" });
const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space-grotesk",
  display: "swap"
});
const playfair = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-playfair",
  display: "swap"
});
const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-jakarta",
  display: "swap"
});
const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-cormorant",
  display: "swap"
});

const googleVerification = "BHFvsACrgww4TItleStGj7tu2SPHj9DqmqEOdCP9BnM";
const GA_ID = process.env.NEXT_PUBLIC_GA_ID;

export const metadata: Metadata = {
  metadataBase: new URL("https://siroundchat.com"),
  title: {
    default: "SiroundChat — AI Chatbot for Leads & Bookings",
    template: "%s — SiroundChat"
  },
  description:
    "SiroundChat helps businesses capture leads, answer questions, and increase bookings with an AI-powered chat system.",
  alternates: {
    canonical: "/"
  },
  openGraph: {
    title: "SiroundChat — AI Chatbot for Leads & Bookings",
    description:
      "SiroundChat helps businesses capture leads, answer questions, and increase bookings with an AI-powered chat system.",
    url: "https://siroundchat.com",
    siteName: "SiroundChat",
    type: "website",
    images: ["/og-image.png"]
  },
  twitter: {
    card: "summary_large_image",
    title: "SiroundChat — AI Chatbot for Leads & Bookings",
    description:
      "SiroundChat helps businesses capture leads, answer questions, and increase bookings with an AI-powered chat system.",
    images: ["/og-image.png"]
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true
    }
  },
  verification: { google: googleVerification },
  other: {
    "verify-paysera": "e57ddd313672437b7412647ce176205b"
  }
};

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body
        className={`${inter.variable} ${sora.variable} ${manrope.variable} ${spaceGrotesk.variable} ${playfair.variable} ${plusJakartaSans.variable} ${cormorant.variable} min-h-screen bg-bg-page text-ink antialiased`}
        style={{ fontFamily: "var(--font-inter), system-ui, sans-serif" }}
      >
        {GA_ID ? (
          <>
            <Script
              async
              src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
              strategy="afterInteractive"
            />
            <Script id="ga-init" strategy="afterInteractive">
              {`window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
window.gtag = gtag;
gtag('js', new Date());
gtag('config', '${GA_ID}');`}
            </Script>
            <Suspense fallback={null}>
              <GoogleAnalytics />
            </Suspense>
          </>
        ) : null}
        {children}
      </body>
    </html>
  );
}
