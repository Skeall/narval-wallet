"use client";
import React, { useEffect, useMemo, useRef, useState } from "react";

interface Props {
  size?: number; // px
  src: string;
  progress: number; // 0..100
  ringColor?: string; // default theme color
  onClick?: () => void;
}

// debug: Avatar with circular XP progress ring
export default function XPRingAvatar({ size = 52, src, progress, ringColor = "#04A7B6", onClick }: Props) {
  const radius = useMemo(() => (size / 2) - 3, [size]);
  const circumference = useMemo(() => 2 * Math.PI * radius, [radius]);
  const clamped = Math.min(100, Math.max(0, Math.round(progress)));
  const dash = (clamped / 100) * circumference;
  const imgSize = size - 8; // leave room for ring stroke
  const ringRef = useRef<SVGCircleElement | null>(null);
  const prevProgressRef = useRef<number>(clamped);
  const [pulse, setPulse] = useState(false);

  useEffect(() => {
    // smooth transition (easing)
    if (ringRef.current) {
      try { ringRef.current.style.transition = "stroke-dasharray 700ms cubic-bezier(.22,.61,.36,1)"; } catch {}
    }
  }, []);

  useEffect(() => {
    // micro-pulse only when progress increases
    const prev = prevProgressRef.current;
    if (clamped > prev) {
      try { console.debug('[XPRingAvatar] progress up', { prev, next: clamped }); } catch {}
      setPulse(true);
      const t = setTimeout(() => setPulse(false), 220);
      return () => clearTimeout(t);
    }
    prevProgressRef.current = clamped;
  }, [clamped]);

  return (
    <div
      className="relative flex items-center justify-center"
      style={{ width: size, height: size, transform: pulse ? 'scale(1.04)' : 'scale(1)', transition: 'transform 180ms ease-out' }}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      aria-label="Avatar – progression XP"
    >
      <svg width={size} height={size} className="absolute top-0 left-0">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="#1f2a44"
          strokeWidth={4}
          fill="none"
        />
        <circle
          ref={ringRef}
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={ringColor}
          strokeWidth={4}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={`${dash} ${circumference - dash}`}
          transform={`rotate(-90 ${size/2} ${size/2})`}
        />
      </svg>
      <img
        src={src}
        alt="avatar"
        className="rounded-full object-cover border-2 border-[#232B42] shadow"
        style={{ width: imgSize, height: imgSize }}
        draggable={false}
      />
    </div>
  );
}
