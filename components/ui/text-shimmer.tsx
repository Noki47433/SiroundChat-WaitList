'use client';

import React, { useMemo } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils/cn";

interface TextShimmerProps {
  children: string;
  as?: React.ElementType;
  className?: string;
  duration?: number;
  spread?: number;
  style?: React.CSSProperties;
}

export function TextShimmer({
  children,
  as: Component = "p",
  className,
  duration = 2,
  spread = 2,
  style
}: TextShimmerProps) {
  const MotionComponent = motion(Component as any) as any;

  const dynamicSpread = useMemo(() => children.length * spread, [children, spread]);

  return (
    <MotionComponent
      className={cn(
        "relative inline-block bg-[length:250%_100%,auto] bg-clip-text text-transparent [--base-color:#8b93a7] [--base-gradient-color:#ffffff]",
        "[--bg:linear-gradient(90deg,#0000_calc(50%-var(--spread)),var(--base-gradient-color),#0000_calc(50%+var(--spread)))] [background-repeat:no-repeat,padding-box]",
        className
      )}
      initial={{ backgroundPosition: "100% center" }}
      animate={{ backgroundPosition: "0% center" }}
      transition={{
        repeat: Infinity,
        duration,
        ease: "linear"
      }}
      style={{
        "--spread": `${dynamicSpread}px`,
        backgroundImage: "var(--bg), linear-gradient(var(--base-color), var(--base-color))",
        ...style
      } as React.CSSProperties}
    >
      {children}
    </MotionComponent>
  );
}
