import type { AppProps } from "next/app";
import { Inter } from "next/font/google";
import "../app/globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap"
});

export default function App({ Component, pageProps }: AppProps) {
  return (
    <div className={`${inter.variable} min-h-screen bg-bg-page text-ink antialiased`}>
      <Component {...pageProps} />
    </div>
  );
}
