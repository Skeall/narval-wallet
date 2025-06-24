import { createContext, useContext, useRef } from "react";
import React from "react";

const VictorySoundContext = createContext<() => void>(() => {});

export function VictorySoundProvider({ children }: { children: React.ReactNode }) {
  const audioRef = useRef<HTMLAudioElement>(null);

  // Fonction à passer dans le context
  const playVictorySound = () => {
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.volume = 1.0;
      // Debug
      console.log("[VICTORY][CTX] Tentative de play");
      audioRef.current.play()
        .then(() => console.log("[VICTORY][CTX] play() OK"))
        .catch((e) => console.error("[VICTORY][CTX] play() erreur", e));
    }
  };

  return (
    <VictorySoundContext.Provider value={playVictorySound}>
      <audio ref={audioRef} src="/victory.mp3" preload="auto" />
      {children}
    </VictorySoundContext.Provider>
  );
}

export function useVictorySound() {
  return useContext(VictorySoundContext);
}
