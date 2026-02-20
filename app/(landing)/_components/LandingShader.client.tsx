"use client";

import dynamic from "next/dynamic";

const HeroShaderGradient = dynamic(() => import("@/app/_components/HeroShaderGradient"), {
  ssr: false,
});

export default function LandingShader() {
  return <HeroShaderGradient />;
}