import { BusinessFaqEditor } from "@/components/website-builder/BusinessFaqEditor";
import { getTenantFromSession } from "@/lib/utils/tenant";

export const dynamic = "force-dynamic";

type WebsiteBuilderPageProps = {
  searchParams?: { topic?: string };
};

export default async function WebsiteBuilderPage({ searchParams }: WebsiteBuilderPageProps) {
  const tenant = await getTenantFromSession();
  const topic = searchParams?.topic ? decodeURIComponent(searchParams.topic) : null;

  if (!tenant.businessId) {
    return (
      <div className="space-y-4">
        <p className="text-xs uppercase tracking-[0.2em] text-white/40">Website Builder</p>
        <h2 className="text-3xl font-semibold">Add FAQ / Info to reduce repeated questions</h2>
        <p className="text-sm text-white/60">Log in to manage your FAQ content.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-white/40">Website Builder</p>
        <h2 className="mt-2 text-3xl font-semibold">Add FAQ / Info to reduce repeated questions</h2>
        <p className="mt-2 text-sm text-white/60">
          Keep answers in one place so your bot can respond instantly and improve conversions.
        </p>
      </div>

      <BusinessFaqEditor businessId={tenant.businessId} topic={topic} />
    </div>
  );
}
