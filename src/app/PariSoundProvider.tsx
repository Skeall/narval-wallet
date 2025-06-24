import { createContext, useContext, useRef } from "react";
import React from "react";

const PariSoundContext = createContext<() => void>(() => {});

export function PariSoundProvider({ children }: { children: React.ReactNode }) {
  const audioRef = useRef<HTMLAudioElement>(null);

  const playPariSound = () => {
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.volume = 1.0;
      console.log("[PARI][CTX] Tentative de play");
      audioRef.current.play()
        .then(() => console.log("[PARI][CTX] play() OK"))
        .catch((e) => console.error("[PARI][CTX] play() erreur", e));
    }
  };

  return (
    <PariSoundContext.Provider value={playPariSound}>
      <audio ref={audioRef} src="/pari.mp3" preload="auto" />
      {children}
    </PariSoundContext.Provider>
  );
}

export function usePariSound() {
  return useContext(PariSoundContext);
}
