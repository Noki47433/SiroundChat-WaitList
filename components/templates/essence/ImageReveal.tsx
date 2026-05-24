"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";

type ImageRevealProps = {
  src: string;
  alt: string;
  fill?: boolean;
  priority?: boolean;
  className?: string;
  sizes?: string;
  delay?: number;
  width?: number;
  height?: number;
};

export function ImageReveal({
  src,
  alt,
  fill = true,
  priority = false,
  className = "",
  sizes,
  delay = 0,
  width,
  height
}: ImageRevealProps) {
  const [isVisible, setIsVisible] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        setIsVisible(true);
        observer.disconnect();
      },
      { threshold: 0.1 }
    );

    if (containerRef.current) observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={containerRef}
      className="relative overflow-hidden"
      style={{
        width: fill ? "100%" : width,
        height: fill ? "100%" : height
      }}
    >
      {fill ? (
        <Image src={src} alt={alt} fill priority={priority} className={className} sizes={sizes} unoptimized={/^https?:\/\//i.test(src)} />
      ) : (
        <Image
          src={src}
          alt={alt}
          width={width}
          height={height}
          priority={priority}
          className={className}
          sizes={sizes}
          unoptimized={/^https?:\/\//i.test(src)}
        />
      )}

      <div
        className="absolute inset-0"
        style={{
          transform: isVisible ? "translateY(-100%)" : "translateY(0)",
          transition: `transform 1.2s cubic-bezier(0.77, 0, 0.175, 1) ${delay}ms`,
          zIndex: 10,
          backgroundColor: "var(--essence-bg)"
        }}
      />

      <div
        className="absolute inset-0"
        style={{
          transform: isVisible ? "translateY(-100%)" : "translateY(0)",
          transition: `transform 1s cubic-bezier(0.77, 0, 0.175, 1) ${delay + 100}ms`,
          zIndex: 9,
          backgroundColor: "var(--site-accent-soft)"
        }}
      />
    </div>
  );
}
