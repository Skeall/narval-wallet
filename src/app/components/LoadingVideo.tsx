"use client";
import React, { useEffect, useRef } from "react";

// debug: reusable loading video component (plays /loading.mp4 looped)
export default function LoadingVideo({ label = "" }: { label?: string }) {
  const vidRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    try {
      // attempt autoplay in user gesture context is not required for muted videos
      vidRef.current?.play().catch(() => {});
      console.debug("[LoadingVideo] mounted", { label });
    } catch (e) {
      console.debug("[LoadingVideo] play() failed", e);
    }
  }, [label]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0B0F1C] text-white">
      <video
        ref={vidRef}
        src="/loading.mp4"
        muted
        loop
        playsInline
        autoPlay
        className="w-[32.5vw] max-w-[190px] rounded-2xl shadow-2xl pointer-events-none select-none"
        aria-label={label || "Chargement en cours"}
      />
    </div>
  );
}
