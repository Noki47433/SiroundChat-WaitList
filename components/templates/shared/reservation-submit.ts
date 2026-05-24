"use client";

type ReservationRequestInput = {
  siteId?: string | null;
  slug?: string | null;
  name: string;
  email?: string | null;
  phone?: string | null;
  date: string;
  time: string;
  partySize: string;
  notes?: string | null;
};

export async function submitReservationRequest(input: ReservationRequestInput) {
  const response = await fetch("/api/site/forms/submit", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      siteId: input.siteId ?? undefined,
      slug: input.slug ?? undefined,
      form_type: "reservation",
      payload: {
        name: input.name,
        email: input.email ?? null,
        phone: input.phone ?? null,
        date: input.date,
        time: input.time,
        party_size: input.partySize,
        notes: input.notes ?? null
      }
    })
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(payload?.error ?? "Unable to submit reservation request.");
  }

  return payload;
}
