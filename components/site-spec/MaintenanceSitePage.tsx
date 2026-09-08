/**
 * The holding page a website shows in `maintenance` public mode.
 *
 * Stage 3D's rollback drill took the canary's website to a 404. Nothing was lost
 * — every version and pointer survived — but for the duration of the drill the
 * customer's website was simply gone, and a 404 is what a website looks like
 * when it has been deleted. An operator should be able to take a site out of
 * service for ten minutes without that being indistinguishable, to a visitor or
 * to a search engine, from going out of business.
 *
 * So this page exists, and the rules it follows are all about honesty:
 *
 *  · It is served **200**, not 404 and not 503-as-a-page. The business exists.
 *  · Every word of substance on it comes from **canonical Business data** — the
 *    name, address and phone the business itself maintains. Nothing here is
 *    generated, nothing is remembered from the Site Spec, and there is no model
 *    anywhere near it.
 *  · It shows **no times**. A holding page is displayed precisely when we are
 *    least sure the booking runtime is healthy, so offering a slot would be the
 *    one thing worse than being briefly unavailable.
 *  · It gives the visitor the two things that still work: the phone number and
 *    the address.
 *
 * It is a server component with inline styles and no client JavaScript, because
 * the whole point is that it works when other things do not.
 */

export type MaintenanceSite = {
  businessName: string;
  phone: string | null;
  address: string | null;
};

export function MaintenanceSitePage({ site }: { site: MaintenanceSite }) {
  return (
    <main
      style={{
        minHeight: "100dvh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "32px 20px",
        background: "#f7f7f5",
        color: "#1b1b1a",
        fontFamily:
          "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"
      }}
    >
      <div style={{ width: "100%", maxWidth: 480, textAlign: "center" }}>
        <h1 style={{ fontSize: "clamp(24px, 6vw, 34px)", lineHeight: 1.2, margin: "0 0 14px" }}>
          {site.businessName}
        </h1>

        <p style={{ fontSize: 17, lineHeight: 1.55, margin: "0 0 28px", color: "#4a4a47" }}>
          Our website is temporarily unavailable while we make an update. We are still open — please
          get in touch and we will help you directly.
        </p>

        {site.phone || site.address ? (
          <div
            style={{
              background: "#ffffff",
              border: "1px solid #e4e4e0",
              borderRadius: 14,
              padding: "20px 22px",
              textAlign: "left"
            }}
          >
            {site.phone ? (
              <p style={{ margin: site.address ? "0 0 14px" : 0, fontSize: 16 }}>
                <span style={{ display: "block", fontSize: 13, color: "#77776f", marginBottom: 3 }}>
                  Phone
                </span>
                <a href={`tel:${site.phone.replace(/\s+/g, "")}`} style={{ color: "#1b1b1a" }}>
                  {site.phone}
                </a>
              </p>
            ) : null}

            {site.address ? (
              <p style={{ margin: 0, fontSize: 16 }}>
                <span style={{ display: "block", fontSize: 13, color: "#77776f", marginBottom: 3 }}>
                  Address
                </span>
                {site.address}
              </p>
            ) : null}
          </div>
        ) : null}

        <p style={{ fontSize: 13, color: "#8a8a82", margin: "26px 0 0" }}>
          Thank you for your patience.
        </p>
      </div>
    </main>
  );
}
