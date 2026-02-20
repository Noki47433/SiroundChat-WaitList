import dynamic from "next/dynamic";

// SSR-safe wrapper: never imports @shadergradient/react on the server.
const HeroShaderGradientClient = dynamic(() => import("./HeroShaderGradient.client"), {
  ssr: false,
});

export default function HeroShaderGradient() {
  return <HeroShaderGradientClient />;
}
