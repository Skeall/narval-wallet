import { createContext, useContext, useRef } from "react";
import React from "react";

const LooseSoundContext = createContext<() => void>(() => {});

export function LooseSoundProvider({ children }: { children: React.ReactNode }) {
  const audioRef = useRef<HTMLAudioElement>(null);

  // Fonction à passer dans le context
  const playLooseSound = () => {
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.volume = 1.0;
      // Debug
      console.log("[LOOSE][CTX] Tentative de play");
      audioRef.current.play()
        .then(() => console.log("[LOOSE][CTX] play() OK"))
        .catch((e) => console.error("[LOOSE][CTX] play() erreur", e));
    }
  };

  return (
    <LooseSoundContext.Provider value={playLooseSound}>
      <audio ref={audioRef} src="/loose.mp3" preload="auto" />
      {children}
    </LooseSoundContext.Provider>
  );
}

export function useLooseSound() {
  return useContext(LooseSoundContext);
}
