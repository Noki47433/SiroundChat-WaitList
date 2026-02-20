// Summary: Server-side chatbot landing/builder page that preloads user business info for the demo flow; secondary page-level wiring.
import { randomUUID } from "crypto";
import { ChatbotHero } from "@/app/components/chatbot/ChatbotHero";
import { ChatbotPlanAndData } from "@/app/components/chatbot/ChatbotPlanAndData";
import { ChatbotSaasStory } from "@/app/components/chatbot/ChatbotSaasStory";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { ensureBusinessRow } from "@/lib/tenant";
import { getEntitlementAccess } from "@/src/billing/requireEntitlement";
import { UpgradeOverlay } from "@/src/components/billing/UpgradeOverlay";

type BusinessRow = {
  id: string;
  business_name: string | null;
  widget_key: string | null;
};

const generateFallbackUuid = () =>
  "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (char) => {
    const rand = Math.floor(Math.random() * 16);
    const value = char === "x" ? rand : (rand & 0x3) | 0x8;
    return value.toString(16);
  });

const generateWidgetKey = () => {
  try {
    return randomUUID();
  } catch {
    return generateFallbackUuid();
  }
};

export default async function ChatbotBuilderPage() {
  const supabase = getSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  let businessId: string | null = null;
  let businessName: string | null = null;
  let widgetKey: string | null = null;
  let chatbotLocked = false;

  if (user) {
    const tenant = await ensureBusinessRow({ userId: user.id });
    businessId = tenant.businessId || null;

    if (businessId) {
      const access = await getEntitlementAccess("chatbot", businessId);
      chatbotLocked = !access.allowed;
    }

    if (businessId && !chatbotLocked) {
      const { data, error } = await (supabase as any)
        .from("businesses")
        .select("business_name, widget_key")
        .eq("id", businessId)
        .maybeSingle();

      const business = (data ?? null) as Pick<BusinessRow, "business_name" | "widget_key"> | null;
      if (!error && business) {
        businessName = business.business_name ?? null;
        widgetKey = business.widget_key ?? null;
      }

      if (!widgetKey) {
        const generatedKey = generateWidgetKey();
        const { error: updateError } = await (supabase as any)
          .from("businesses")
          .update({ widget_key: generatedKey })
          .eq("id", businessId);
        if (!updateError) {
          widgetKey = generatedKey;
        }
      }
    }
  }

  const showMissingBusiness = !!user && !businessId;

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-white">
      <ChatbotHero />
      {showMissingBusiness ? (
        <div className="mx-auto max-w-4xl px-6 py-4 text-sm text-slate-300">
          No business found yet. Create one to continue the setup.
        </div>
      ) : null}
      {chatbotLocked ? (
        <div className="mx-auto w-full max-w-5xl px-6 py-8">
          <UpgradeOverlay
            entitlementKey="chatbot"
            title="Upgrade plan to unlock Chatbot Builder"
            description="Chatbot builder and deployment are available on plans that include chatbot access."
          >
            <div className="h-[340px] rounded-2xl border border-white/10 bg-slate-900/70" />
          </UpgradeOverlay>
        </div>
      ) : (
        <ChatbotPlanAndData
          businessId={businessId}
          businessName={businessName}
          widgetKey={widgetKey}
          isLoggedIn={!!user}
        />
      )}
      <ChatbotSaasStory />
    </main>
  );
}
