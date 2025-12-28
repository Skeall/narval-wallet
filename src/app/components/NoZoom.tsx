"use client";
import { useEffect } from "react";

export default function NoZoom() {
  useEffect(() => {
    const metaViewport = document.querySelector(
      'meta[name="viewport"]'
    ) as HTMLMetaElement | null;

    const setNoZoomViewport = () => {
      if (!metaViewport) return;
      const base =
        "width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover";
      if (metaViewport.content !== base) {
        metaViewport.setAttribute("content", base);
        console.debug("[NoZoom] viewport updated to block zoom");
      }
    };

    setNoZoomViewport();

    let lastTouchEnd = 0;

    const onGesture = (e: Event) => {
      e.preventDefault();
      setNoZoomViewport();
      console.debug("[NoZoom] gesture prevented");
    };

    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey) {
        e.preventDefault();
        console.debug("[NoZoom] ctrl+wheel prevented");
      }
    };

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length > 1) {
        e.preventDefault();
        console.debug("[NoZoom] pinch touch prevented");
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length > 1) {
        e.preventDefault();
      }
    };

    const onTouchEnd = (e: TouchEvent) => {
      const now = Date.now();
      if (now - lastTouchEnd <= 300) {
        e.preventDefault();
        console.debug("[NoZoom] double-tap prevented");
      }
      lastTouchEnd = now;
    };

    const onDblClick = (e: MouseEvent) => {
      e.preventDefault();
      console.debug("[NoZoom] dblclick prevented");
    };

    // iOS Safari
    document.addEventListener("gesturestart", onGesture as EventListener, { passive: false } as any);
    document.addEventListener("gesturechange", onGesture as EventListener, { passive: false } as any);
    document.addEventListener("gestureend", onGesture as EventListener, { passive: false } as any);
    // Desktop pinch (trackpad)
    window.addEventListener("wheel", onWheel, { passive: false });
    // Touch gestures
    document.addEventListener("touchstart", onTouchStart, { passive: false });
    document.addEventListener("touchmove", onTouchMove, { passive: false });
    document.addEventListener("touchend", onTouchEnd, { passive: false });
    // Double click zoom (some browsers)
    document.addEventListener("dblclick", onDblClick, { passive: false });

    return () => {
      document.removeEventListener("gesturestart", onGesture as EventListener);
      document.removeEventListener("gesturechange", onGesture as EventListener);
      document.removeEventListener("gestureend", onGesture as EventListener);
      window.removeEventListener("wheel", onWheel as EventListener);
      document.removeEventListener("touchstart", onTouchStart as EventListener);
      document.removeEventListener("touchmove", onTouchMove as EventListener);
      document.removeEventListener("touchend", onTouchEnd as EventListener);
      document.removeEventListener("dblclick", onDblClick as EventListener);
    };
  }, []);

  return null;
}
