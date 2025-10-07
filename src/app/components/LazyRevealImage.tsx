"use client";
import React, { useEffect, useRef, useState } from "react";

// Lightweight lazy image with IntersectionObserver + blur/fade-in effect.
// Rules applied: Debug logs & comments; Simple solutions.
export default function LazyRevealImage({
  src,
  alt,
  className,
  imgClassName,
  sizes,
  onClick,
  title,
}: {
  src: string;
  alt: string;
  className?: string; // wrapper class
  imgClassName?: string; // image class
  sizes?: string;
  onClick?: () => void;
  title?: string;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!ref.current) return;
    // Observe visibility near viewport to anticipate loading (200px margin)
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsVisible(true);
            observer.disconnect();
          }
        });
      },
      { root: null, rootMargin: "200px", threshold: 0.01 }
    );
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} className={className} onClick={onClick} title={title}>
      {/* Placeholder shimmer while not visible yet */}
      {!isVisible && (
        <div className="w-full h-full bg-[#111827] animate-pulse rounded-[4px]" aria-hidden />
      )}
      {/* Real image mounts only when visible */}
      {isVisible && (
        <>
          <img
            src={src}
            alt={alt}
            loading="lazy"
            decoding="async"
            fetchPriority="low"
            sizes={sizes}
            onLoad={() => setLoaded(true)}
            className={
              (imgClassName || "") +
              " " +
              // Start blurred + slightly scaled and transparent, then reveal
              (loaded
                ? "opacity-100 blur-0 scale-100"
                : "opacity-0 blur-sm scale-[1.02]") +
              " transition-[opacity,filter,transform] duration-500 ease-out w-full h-full object-cover"
            }
            draggable={false}
          />
          {/* Soft overlay until loaded for nicer blend */}
          {!loaded && (
            <div className="absolute inset-0 bg-gradient-to-br from-[#0b0f1c] via-transparent to-[#0b0f1c] opacity-40 pointer-events-none" />
          )}
        </>
      )}
    </div>
  );
}
