"use client";
import React from "react";
import { usePathname } from "next/navigation";

// debug: simple wrapper to animate page entries on route change
export default function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  // Key by pathname to re-mount on navigation and play the enter animation
  return (
    <div key={pathname} className="page-fade-slide-enter">
      {children}
    </div>
  );
}
