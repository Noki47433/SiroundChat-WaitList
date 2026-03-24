import { redirect } from "next/navigation";

export default function DashboardBillingSuccessRedirect() {
  redirect("/billing/success");
}
