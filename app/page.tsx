import Script from "next/script";
import HeroShaderGradient from "@/app/_components/HeroShaderGradient";
import { HomeContent } from "@/components/HomeContent";

export default function Page() {
  return (
    <>
      <HeroShaderGradient />
      <div className="relative z-10">
        <HomeContent />
      </div>
      <Script
        src="https://siroundchat.com/api/widget/loader?key=7ab3238d-0f3d-432a-bf25-543e96247f33"
        strategy="afterInteractive"
      />
    </>
  );
}
