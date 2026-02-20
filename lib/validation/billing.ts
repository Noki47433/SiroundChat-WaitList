import { z } from "zod";

export const BillingSessionSchema = z.object({
  plan: z.enum(["local_basic", "pro", "enterprise"]),
  interval: z.enum(["month", "year"]).default("month")
});
