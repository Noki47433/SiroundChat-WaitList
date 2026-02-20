import { requireUser } from "@/lib/auth/require-user";
import { GenerationScreen } from "@/components/generation/GenerationScreen";

export const dynamic = "force-dynamic";

type PageProps = {
  params: { siteId: string };
};

export default async function GenerationPage({ params }: PageProps) {
  await requireUser("/dashboard/builder");
  return <GenerationScreen siteId={params.siteId} />;
}
