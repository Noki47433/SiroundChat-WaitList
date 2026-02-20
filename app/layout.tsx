// Summary: App-wide root layout applying fonts, global styles, and metadata; secondary framework wrapper.
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";


const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap"
});

export const metadata: Metadata = {
  title: "SiroundChat - AI support that feels human",
  description:
    "SiroundChat is the AI chat assistant that helps support teams deliver fast, on-brand answers trained on your docs, tickets, and CRM."
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
