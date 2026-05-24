"use client";

import Image, { type ImageProps } from "next/image";
import { useEffect, useRef, useState } from "react";

type FadeImageProps = Omit<ImageProps, "onLoad"> & {
  alt: string;
  fadeDelay?: number;
};

export function FadeImage({ className, fadeDelay = 0, alt, ...props }: FadeImageProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);
  const isRemoteSrc = typeof props.src === "string" && /^https?:\/\//i.test(props.src);

  useEffect(() => {
    if (isRemoteSrc) {
      setIsVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        const timeout = window.setTimeout(() => setIsVisible(true), fadeDelay);
        observer.disconnect();
        return () => window.clearTimeout(timeout);
      },
      { threshold: 0.1, rootMargin: "50px" }
    );

    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [fadeDelay, isRemoteSrc]);

  return (
    <div ref={ref} className="relative h-full w-full">
      <Image
        {...props}
        alt={alt}
        unoptimized={isRemoteSrc}
        loading={isRemoteSrc ? "eager" : props.loading}
        className={`${className ?? ""} transition-all duration-700 ease-out ${
          isVisible && isLoaded ? "scale-100 opacity-100" : "scale-[1.02] opacity-0"
        }`}
        onLoad={() => setIsLoaded(true)}
      />
    </div>
  );
}
