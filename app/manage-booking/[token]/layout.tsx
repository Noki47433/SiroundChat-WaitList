import type { Metadata } from "next";

/**
 * The head for a booking-management page.
 *
 * This URL contains a bearer credential. Anyone holding it can view, move or
 * cancel someone's appointment, which makes three ordinary-looking defaults into
 * real leaks:
 *
 *  · **Referrer.** Following any outward link from this page would send the full
 *    URL — token included — to that site in the `Referer` header. `no-referrer`
 *    stops that at the browser.
 *  · **Indexing.** A link pasted anywhere a crawler can reach it would otherwise
 *    be fetched and indexed, putting a working token in a search result.
 *  · **Titles.** The page title travels further than the page does: browser
 *    history, tab lists, screenshots, analytics. It is deliberately static and
 *    generic here, and the business's own name is set on the client once the
 *    booking has loaded — so the name never has to be resolved from the token
 *    during server rendering, and the token never reaches metadata.
 *
 * The page itself is a client component and cannot export metadata, which is why
 * this layout exists at all.
 */
export const metadata: Metadata = {
  title: "Your booking",
  description: "View, change or cancel your booking.",
  referrer: "no-referrer",
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: { index: false, follow: false }
  }
};

export default function ManageBookingLayout({ children }: { children: React.ReactNode }) {
  return children;
}
