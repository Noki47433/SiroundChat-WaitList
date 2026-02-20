// Summary: App-wide root layout applying fonts, global styles, and metadata; secondary framework wrapper.
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";


const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap"
});

const googleVerification = "BHFvsACrgww4TItleStGj7tu2SPHj9DqmqEOdCP9BnM";

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
  verification: { google: googleVerification }
};

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`${inter.variable} min-h-screen bg-bg-page text-ink antialiased font-sans`}>
        {children}
      </body>
    </html>
  );
}
