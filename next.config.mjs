// P0 SEC-3: enforced baseline security headers.
//
// This baseline is intentionally scoped to directives that are safe to enforce app-wide
// without breaking Next.js inline hydration scripts, the embeddable widget (which must be
// framed on customer sites), or the Paysera billing redirect:
//   - object-src 'none'  → blocks <object>/<embed>/<applet> injection
//   - base-uri 'self'    → blocks <base> tag hijacking of relative URLs
// It deliberately does NOT set a `script-src`/`default-src` (which would require a per-request
// nonce architecture in middleware and a full authed-app + published-site + widget regression
// before it could be enforced). That strict script policy is the documented follow-up.
//
// Framing: the widget/embed/published-site routes MUST remain cross-origin embeddable, so
// frame protection is applied only to the app's own sensitive surfaces via X-Frame-Options.
const BASELINE_CSP = "object-src 'none'; base-uri 'self'";

const BASELINE_SECURITY_HEADERS = [
  { key: "Content-Security-Policy", value: BASELINE_CSP },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" }
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // P0 COST-1: enable the instrumentation hook so the shared rate-limit backend can be activated
  // at server startup (see instrumentation.ts).
  experimental: { instrumentationHook: true },
  transpilePackages: [
    "@shadergradient/react",
    "@react-three/fiber",
    "three",
    "three-stdlib",
    "camera-controls"
  ],
  async headers() {
    return [
      {
        // Applies to every route. Safe, non-script directives only.
        source: "/:path*",
        headers: BASELINE_SECURITY_HEADERS
      },
      {
        // Clickjacking protection for the authenticated app surfaces only.
        // (Excludes /embed, /s/*, /api/embed, /api/widget so the widget can be framed.)
        source: "/dashboard/:path*",
        headers: [{ key: "X-Frame-Options", value: "DENY" }]
      },
      {
        source: "/admin/:path*",
        headers: [{ key: "X-Frame-Options", value: "DENY" }]
      }
    ];
  }
};

export default nextConfig;
