"use client";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";

export interface NewsItem {
  id: string;
  title: string;
  description: string;
  image_url?: string | null;
  created_at: string; // ISO
}

interface Props {
  items: NewsItem[];
  open: boolean;
  onClose: () => void;
}

export default function NewsModal({ items, open, onClose }: Props) {
  // debug: local UI state for carousel index
  const [index, setIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canShow = open && items.length > 0;

  useEffect(() => {
    // debug: reset index when items or open changes
    setIndex(0);
  }, [open, items.length]);

  const next = useCallback(() => {
    setIndex((i) => (i + 1) % items.length);
  }, [items.length]);
  const prev = useCallback(() => {
    setIndex((i) => (i - 1 + items.length) % items.length);
  }, [items.length]);

  // Touch/swipe handlers
  useEffect(() => {
    if (!containerRef.current) return;
    const el = containerRef.current;
    let startX = 0;
    let isDown = false;
    const onTouchStart = (e: TouchEvent) => {
      isDown = true;
      startX = e.touches[0].clientX;
    };
    const onTouchEnd = (e: TouchEvent) => {
      if (!isDown) return;
      isDown = false;
      const endX = e.changedTouches[0].clientX;
      const delta = endX - startX;
      // debug: basic threshold
      if (delta > 40) prev();
      if (delta < -40) next();
    };
    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchend", onTouchEnd, { passive: true });
    return () => {
      el.removeEventListener("touchstart", onTouchStart as any);
      el.removeEventListener("touchend", onTouchEnd as any);
    };
  }, [next, prev]);

  const current = items[index];

  if (!canShow) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm"
      aria-modal="true"
      role="dialog"
    >
      <div
        ref={containerRef}
        className="relative w-[92%] max-w-[420px] bg-[#171C2B] text-white rounded-3xl shadow-2xl p-4 sm:p-5 border border-[#232B42]"
      >
        {/* Close button - debug: bumped visibility (size, contrast, outline) */}
        <button
          aria-label="Fermer"
          className="absolute right-3 top-3 z-10 w-10 h-10 rounded-full flex items-center justify-center
                     bg-sky-600 text-black hover:bg-sky-500 active:bg-sky-400
                     shadow-[0_8px_24px_rgba(0,0,0,0.45)] ring-2 ring-sky-300/80"
          onClick={onClose}
        >
          <span className="text-lg font-extrabold">×</span>
        </button>

        {/* Arrows */}
        {items.length > 1 && (
          <>
            <button
              aria-label="Précédent"
              className="absolute left-2 top-1/2 -translate-y-1/2 text-sky-400 hover:text-sky-300 text-2xl"
              onClick={prev}
            >
              ‹
            </button>
            <button
              aria-label="Suivant"
              className="absolute right-2 top-1/2 -translate-y-1/2 text-sky-400 hover:text-sky-300 text-2xl"
              onClick={next}
            >
              ›
            </button>
          </>
        )}

        {/* Card content */}
        <div className="flex flex-col items-stretch">
          {current?.image_url ? (
            <div className="relative w-full rounded-2xl overflow-hidden mb-3 bg-[#0B0F1C]" style={{ aspectRatio: "4/3" }}>
              {/* debug: use next/image for perf */}
              <Image src={current.image_url} alt={current.title} fill className="object-cover" />
            </div>
          ) : null}

          <h2 className="text-2xl font-extrabold text-sky-300 mb-2 drop-shadow-glow">
            {current?.title}
          </h2>
          <p className="text-gray-300 text-sm leading-relaxed whitespace-pre-line">
            {current?.description}
          </p>

          {/* Dots */}
          {items.length > 1 && (
            <div className="flex items-center justify-center gap-2 mt-4">
              {items.map((_, i) => (
                <span
                  key={i}
                  className={`w-2 h-2 rounded-full ${i === index ? "bg-sky-400" : "bg-gray-600"}`}
                />)
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
