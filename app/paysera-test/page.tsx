"use client";

import { useState } from "react";

type CreateCheckoutResponse = {
  url?: string;
  error?: string;
};

export default function Page() {
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    if (loading) return;

    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/paysera/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: 2900 })
      });

      const data = (await response.json().catch(() => null)) as CreateCheckoutResponse | null;

      if (data?.url) {
        window.location.href = data.url;
        return;
      }

      setError(data?.error || "Unable to create checkout.");
    } catch {
      setError("Unable to create checkout.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        fontFamily: "system-ui, sans-serif",
        padding: "24px"
      }}
    >
      <div style={{ textAlign: "center" }}>
        <button
          type="button"
          onClick={handleClick}
          disabled={loading}
          style={{
            padding: "12px 16px",
            border: "1px solid #d1d5db",
            borderRadius: "8px",
            background: "#111827",
            color: "#ffffff",
            cursor: loading ? "not-allowed" : "pointer"
          }}
        >
          {loading ? "Loading..." : "Test Paysera Checkout"}
        </button>
        {error ? <p style={{ marginTop: "12px", color: "#b91c1c" }}>{error}</p> : null}
      </div>
    </main>
  );
}
