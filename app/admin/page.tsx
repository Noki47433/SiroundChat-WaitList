import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin/guards";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  await requireAdmin("/admin");
  redirect("/admin/businesses");
}
