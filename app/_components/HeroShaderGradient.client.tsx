"use client";

import { useEffect, useState } from "react";

export default function HeroShaderGradientClient() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return (
    <div aria-hidden className="hero-flow pointer-events-none fixed inset-0 z-0 overflow-hidden">
      <div className="hero-flow__base" />
      <div className="hero-flow__mid" />
      <div className="hero-flow__bottom" />
      <div className="hero-flow__top" />
      <div className="hero-flow__fade" />

      <style jsx>{`
        .hero-flow__base,
        .hero-flow__mid,
        .hero-flow__bottom,
        .hero-flow__top {
          will-change: transform;
        }

        .hero-flow__base {
          position: absolute;
          left: -30vw;
          right: 33vw;
          top: -20vh;
          bottom: -26vh;
          border-radius: 52% 48% 48% 52% / 58% 42% 60% 40%;
          background:
            radial-gradient(
              ellipse at 42% 44%,
              #fff866 0%,
              #ffe100 34%,
              #ffd000 62%,
              rgba(255, 201, 0, 0.88) 76%,
              rgba(255, 201, 0, 0) 88%
            );
          animation: flowBase 4.6s ease-in-out infinite alternate;
        }

        .hero-flow__mid {
          position: absolute;
          left: -20vw;
          top: 42vh;
          width: 90vw;
          height: 82vh;
          border-radius: 58% 42% 48% 52% / 52% 50% 50% 48%;
          background:
            radial-gradient(
              ellipse at 38% 52%,
              rgba(255, 214, 72, 0.96) 0%,
              rgba(255, 185, 8, 0.92) 52%,
              rgba(255, 185, 8, 0) 78%
            );
          animation: flowMid 3.8s ease-in-out infinite;
        }

        .hero-flow__bottom {
          position: absolute;
          left: 20vw;
          top: 70vh;
          width: 60vh;
          height: 60vh;
          border-radius: 9999px;
          background:
            radial-gradient(
              circle,
              rgba(255, 246, 80, 0.98) 0%,
              rgba(255, 221, 0, 0.94) 58%,
              rgba(255, 221, 0, 0) 82%
            );
          animation: flowBottom 3.1s ease-in-out infinite alternate;
        }

        .hero-flow__top {
          position: absolute;
          left: 0;
          top: 0;
          width: 78vw;
          height: 24vh;
          clip-path: polygon(0 0, 100% 0, 88% 100%, 0 100%);
          background: linear-gradient(
            180deg,
            rgba(255, 221, 0, 0.9) 0%,
            rgba(255, 221, 0, 0.72) 62%,
            rgba(255, 221, 0, 0) 100%
          );
          animation: flowTop 5s ease-in-out infinite alternate;
        }

        .hero-flow__fade {
          position: absolute;
          inset: 0;
          background: linear-gradient(
            90deg,
            rgba(255, 252, 240, 0) 0%,
            rgba(255, 252, 240, 0) 58%,
            rgba(255, 252, 240, 0.78) 78%,
            rgba(255, 252, 240, 0.97) 90%,
            rgba(255, 252, 240, 1) 100%
          );
        }

        @keyframes flowBase {
          0% {
            transform: translate3d(-3vw, -2vh, 0) scale(0.98) rotate(-2.4deg);
          }
          50% {
            transform: translate3d(2vw, 1vh, 0) scale(1.02) rotate(1.8deg);
          }
          100% {
            transform: translate3d(3vw, 2.4vh, 0) scale(1.01) rotate(2.5deg);
          }
        }

        @keyframes flowMid {
          0% {
            transform: translate3d(2.8vw, -1.4vh, 0) scale(1.02) rotate(1.8deg);
          }
          50% {
            transform: translate3d(-3.4vw, 2vh, 0) scale(0.97) rotate(-2.2deg);
          }
          100% {
            transform: translate3d(2.6vw, -1.6vh, 0) scale(1.03) rotate(2deg);
          }
        }

        @keyframes flowBottom {
          0% {
            transform: translate3d(-2.6vw, 1.2vh, 0) scale(0.95);
          }
          50% {
            transform: translate3d(2.4vw, -1.4vh, 0) scale(1.08);
          }
          100% {
            transform: translate3d(-2vw, -1.1vh, 0) scale(1.01);
          }
        }

        @keyframes flowTop {
          0% {
            transform: translate3d(-1.4vw, 0, 0) scaleX(0.98);
          }
          100% {
            transform: translate3d(1.8vw, 0.6vh, 0) scaleX(1.02);
          }
        }
      `}</style>
    </div>
  );
}
