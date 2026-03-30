import Script from "next/script";
import HeroShaderGradient from "@/app/_components/HeroShaderGradient";
import { HomeContent } from "@/components/HomeContent";
import { SIROUNDCHAT_DEMO_WIDGET_KEY } from "@/lib/chatbot/siroundchat-demo";

export default function Page() {
  return (
    <>
      <HeroShaderGradient />
      <div className="relative z-10">
        <HomeContent />
      </div>
      <Script
        src={`https://siroundchat.com/api/widget/loader?key=${SIROUNDCHAT_DEMO_WIDGET_KEY}`}
        strategy="afterInteractive"
      />
    </>
  );
}
