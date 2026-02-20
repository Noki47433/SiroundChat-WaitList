"use client";

import { useEffect, useState } from "react";

// IMPORTANT: this file is client-only, so importing is safe here.
import { ShaderGradientCanvas, ShaderGradient } from "@shadergradient/react";

export default function HeroShaderGradientClient() {
  // Avoid hydration weirdness: render only after mount.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

<div className="fixed inset-0 -z-10 pointer-events-none opacity-10">
  <ShaderGradientCanvas style={{ width: "100%", height: "100%" }}>
    <ShaderGradient />
  </ShaderGradientCanvas>
</div>

  return (
    // This layer MUST NOT affect layout: absolute + inset-0 + z-0.
    
    <div aria-hidden className="absolute inset-0 z-0 pointer-events-none">
      <ShaderGradientCanvas
        // force full-bleed canvas
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
        fov={45}
        pixelDensity={1}
      >
        <ShaderGradient
          animate="on"
          brightness={1.1}
          cAzimuthAngle={0}
          cDistance={7.1}
          cPolarAngle={140}
          cameraZoom={13.5}
          color1="#ffffff"
          color2="#ffbb00"
          color3="#0700ff"
          envPreset="city"
          grain="off"
          lightType="3d"
          reflection={0.1}
          shader="defaults"
          type="sphere"
          uAmplitude={1.4}
          uDensity={2.1}
          uFrequency={5.5}
          uSpeed={0.1}
          uStrength={1.4}
          wireframe={false}
          zoomOut={false}
        />
      </ShaderGradientCanvas>

      {/* ONE global readability wash over the whole hero (optional) */}
      <div className="absolute inset-0 bg-white/10" />
    </div>
  );
}

