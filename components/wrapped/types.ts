export type WrappedPostAction =
  | { type: "leads" }
  | { type: "reservations" }
  | { type: "conversations" }
  | { type: "conversation"; id: string }
  | { type: "analytics" }
  | { type: "settings" }
  | { type: "impact-details" };
