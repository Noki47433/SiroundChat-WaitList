import type { ReactNode } from "react";
import { requireUser } from "@/lib/auth/require-user";

export const dynamic = "force-dynamic";

export default async function BuildLayout({ children }: { children: ReactNode }) {
  await requireUser("/build/chatbot");
  return <>{children}</>;
}
