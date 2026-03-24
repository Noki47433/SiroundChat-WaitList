import { redirect } from "next/navigation";

export default function DashboardBillingCancelRedirect() {
  redirect("/billing/cancel");
}
