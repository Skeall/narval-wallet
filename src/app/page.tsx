"use client";
import { useEffect, useRef, useState } from "react";

// debug: transition page — joue le trailer v2 puis redirige vers la nouvelle app
const NEW_APP_URL = "https://narvalapp.netlify.app/";

export default function Home() {
  const vidRef = useRef<HTMLVideoElement | null>(null);
  // debug: track si la vidéo est terminée pour afficher le CTA
  const [videoEnded, setVideoEnded] = useState(false);
  // debug: track si la vidéo a commencé (pour masquer le bouton "play" fallback)
  const [videoStarted, setVideoStarted] = useState(false);

  useEffect(() => {
    // debug: tente l'autoplay (muted requis sur mobile pour autoplay)
    const vid = vidRef.current;
    if (vid) {
      vid.play().then(() => {
        console.debug("[Trailer] autoplay OK");
        setVideoStarted(true);
      }).catch((err) => {
        console.debug("[Trailer] autoplay bloqué, l'utilisateur devra cliquer", err);
      });
    }
  }, []);

  // debug: gère la fin de la vidéo
  const handleVideoEnd = () => {
    console.debug("[Trailer] vidéo terminée → affichage CTA");
    setVideoEnded(true);
  };

  // debug: fallback si autoplay bloqué — l'utilisateur clique pour lancer
  const handleManualPlay = () => {
    const vid = vidRef.current;
    if (vid) {
      vid.muted = false;
      vid.play().then(() => {
        console.debug("[Trailer] lecture manuelle OK");
        setVideoStarted(true);
      }).catch((err) => {
        console.debug("[Trailer] lecture manuelle échouée", err);
      });
    }
  };

  // debug: permet de skip la vidéo et aller direct au CTA
  const handleSkip = () => {
    const vid = vidRef.current;
    if (vid) {
      vid.pause();
    }
    setVideoEnded(true);
  };

  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center bg-[#0B0F1C] text-white overflow-hidden">
      {/* Vidéo trailer */}
      {!videoEnded && (
        <>
          <video
            ref={vidRef}
            src="/narval-trailer-v2.mp4"
            playsInline
            autoPlay
            muted
            onEnded={handleVideoEnd}
            onPlay={() => setVideoStarted(true)}
            onClick={handleManualPlay}
            className="w-full h-full object-contain cursor-pointer"
            style={{ maxHeight: "85vh" }}
          />

          {/* debug: bouton play fallback si autoplay bloqué */}
          {!videoStarted && (
            <button
              onClick={handleManualPlay}
              className="absolute inset-0 flex items-center justify-center bg-black/40 z-10"
            >
              <div className="w-20 h-20 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center border-2 border-white/40 hover:bg-white/30 transition">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="white">
                  <path d="M8 5v14l11-7z" />
                </svg>
              </div>
            </button>
          )}

          {/* debug: bouton skip en bas à droite */}
          {videoStarted && (
            <button
              onClick={handleSkip}
              className="absolute bottom-8 right-6 z-20 px-4 py-2 text-sm text-white/60 hover:text-white border border-white/20 hover:border-white/50 rounded-full backdrop-blur-sm transition"
            >
              Passer ›
            </button>
          )}
        </>
      )}

      {/* CTA après la vidéo */}
      {videoEnded && (
        <div className="flex flex-col items-center justify-center gap-8 px-6 animate-fade-in">
          {/* debug: titre d'accroche */}
          <div className="text-center">
            <h1
              className="text-4xl md:text-5xl font-extrabold tracking-tight mb-3"
              style={{ letterSpacing: "-1.5px" }}
            >
              Narval v2
            </h1>
            <p className="text-lg text-gray-300 max-w-xs mx-auto">
              L&apos;app a été refaite de zéro. C&apos;est plus beau, plus rapide, plus fun.
            </p>
          </div>

          {/* debug: bouton principal vers la nouvelle app */}
          <a
            href={NEW_APP_URL}
            className="inline-flex items-center gap-3 px-8 py-4 bg-sky-500 hover:bg-sky-400 text-white font-bold text-lg rounded-2xl shadow-lg shadow-sky-500/30 hover:shadow-sky-400/40 transition-all active:scale-95"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            Découvrir la nouvelle version
          </a>

          {/* debug: lien pour revoir le trailer */}
          <button
            onClick={() => {
              setVideoEnded(false);
              setVideoStarted(false);
              setTimeout(() => {
                const vid = vidRef.current;
                if (vid) {
                  vid.currentTime = 0;
                  vid.muted = true;
                  vid.play().then(() => setVideoStarted(true)).catch(() => {});
                }
              }, 100);
            }}
            className="text-sm text-white/40 hover:text-white/70 underline underline-offset-4 transition"
          >
            Revoir le trailer
          </button>
        </div>
      )}
    </div>
  );
}
