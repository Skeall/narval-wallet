"use client";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

// À uploader dans /public/specials/pinata-pari-cover.jpg (800x400px conseillé, JPG ou WEBP)
const SPECIALS = [
  {
    slug: "pari-pinata",
    title: "Pari Piñata",
    cover: "/specials/pinata-pari-cover.jpg",
    // debug: updated availability date to 31 décembre (per request)
    until: "Disponible jusqu'au 31 décembre",
    description: "Fais péter la piñata et repars avec des narvals.",
    link: "/pinata"
  },
  {
    slug: "moracle-genie",
    title: "🧞‍♂️ Moracle, le Génie Déchu",
    cover: "/specials/moracle-cover.png",
    // debug: updated availability date to 31 décembre (per request)
    until: "Disponible jusqu’au 31 décembre",
    description: "Chaque défaite t’offre un vœu… souvent nul, parfois rentable.",
    link: "/moracle"
  }
  ,
  {
    slug: "valise",
    title: "Prépare ta valise",
    cover: "/specials/valise-cover.png",
    until: "Disponible jusqu’au 24 février",
    description: "Complète ta valise avant le départ et gagne des Narvals.",
    link: "/valise"
  }
];

export default function SpecialsPage() {
  const router = useRouter();
  const [showValiseIntro, setShowValiseIntro] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const handleSkipValiseIntro = () => {
    try {
      const v = videoRef.current;
      if (v) {
        v.pause();
        v.removeAttribute('src');
        v.load();
      }
    } catch {}
    setShowValiseIntro(false);
    try { router.replace('/valise'); } catch { window.location.href = '/valise'; }
  };
  // Handler pour la Piñata : set sessionStorage et navigate
  const handleGoToPinata = (e?: React.MouseEvent) => {
    if (e) e.preventDefault();
    if (typeof window !== "undefined") {
      sessionStorage.setItem("unmuteIntro", "1");
    }
    router.push("/pinata");
  };
  // Handler pour Valise : jouer intro avec son puis naviguer
  const handleGoToValise = (e?: React.MouseEvent) => {
    if (e) e.preventDefault();
    try {
      if (videoRef.current) {
        videoRef.current.muted = false;
        videoRef.current.volume = 1.0;
        videoRef.current.currentTime = 0;
        // lancer la lecture dans le contexte du clic
        videoRef.current.play()
          .then(() => {
            setShowValiseIntro(true);
          })
          .catch((err) => {
            console.debug('[Specials][valise intro] play() blocked, navigating directly', err);
            router.push('/valise');
          });
      } else {
        router.push('/valise');
      }
    } catch (err) {
      router.push('/valise');
    }
  };
  return (
    <div className="min-h-screen bg-[#0B0F1C] py-6 px-3 sm:px-0 flex flex-col items-center">
      <h1 className="text-xl sm:text-2xl font-extrabold text-amber-400 mb-7 text-center drop-shadow-glow flex items-center gap-1">
        <span>🎯</span> Jeux & défis du moment
      </h1>
      <div className="w-full max-w-xl flex flex-col gap-7">
        {SPECIALS.map(evt => (
          <div key={evt.slug} className="bg-[#181F2E] rounded-2xl shadow-xl border border-[#232B42] overflow-hidden group transition-all duration-200">
            {evt.link ? (
              <button
                type="button"
                onClick={
                  evt.slug === "pari-pinata"
                    ? handleGoToPinata
                    : evt.slug === "moracle-genie"
                      ? () => router.push('/moracle')
                      : evt.slug === "valise"
                        ? handleGoToValise
                        : undefined
                }
                className="block relative w-full focus:outline-none"
                style={{ aspectRatio: '2/1' }}
                tabIndex={0}
              >
                <Image
                  src={evt.cover}
                  alt={evt.title}
                  fill
                  className="object-cover group-hover:scale-[1.035] transition-transform duration-200 cursor-pointer"
                  sizes="(max-width: 640px) 100vw, 800px"
                  priority={true}
                />
              </button>
            ) : (
              <div className="relative w-full" style={{ aspectRatio: '2/1' }}>
                <Image
                  src={evt.cover}
                  alt={evt.title}
                  fill
                  className="object-cover opacity-80 grayscale"
                  sizes="(max-width: 640px) 100vw, 800px"
                  priority={true}
                />
              </div>
            )}
            <div className="p-4 flex flex-col gap-2">
              <div className="flex items-center justify-between mb-1">
                <h2 className="text-xl font-bold text-white drop-shadow-glow">{evt.title}</h2>
                <span className="text-xs text-cyan-300 font-semibold whitespace-nowrap">{evt.until}</span>
              </div>
              <p className="text-gray-300 text-sm mb-2">{evt.description}</p>
              {evt.link ? (
                <button
                  type="button"
                  onClick={
                    evt.slug === "pari-pinata"
                      ? handleGoToPinata
                      : evt.slug === "moracle-genie"
                        ? () => router.push('/moracle')
                        : evt.slug === "valise"
                          ? handleGoToValise
                          : undefined
                  }
                  className="inline-block w-fit bg-amber-400 hover:bg-amber-300 text-black font-bold px-5 py-2 rounded-xl shadow-lg transition disabled:opacity-60 text-base"
                >
                  Découvrir
                </button>
              ) : null}
            </div>
          </div>
        ))}
        {/* Valise intro overlay (toujours monté pour conserver le contexte de lecture) */}
        <div
          className={showValiseIntro ? "fixed inset-0 z-[9999] bg-black/95 flex items-center justify-center" : "fixed inset-0 z-[9999] bg-black/95 items-center justify-center hidden"}
          onClick={() => { console.debug('[Specials][valise intro] overlay click -> skip'); handleSkipValiseIntro(); }}
        >
          <button
            type="button"
            className="absolute top-3 right-3 z-10 px-3 py-1.5 rounded-full bg-white/15 hover:bg-white/25 text-white text-xs border border-white/20"
            onClick={(e) => { e.stopPropagation(); handleSkipValiseIntro(); }}
            onMouseDown={(e) => { e.stopPropagation(); handleSkipValiseIntro(); }}
            onTouchEnd={handleSkipValiseIntro}
          >
            Passer l'intro
          </button>
          <video
            ref={videoRef}
            src="/valise.mp4"
            className="w-[92vw] max-w-[700px] rounded-2xl shadow-2xl pointer-events-none"
            preload="auto"
            playsInline
            onEnded={() => { setShowValiseIntro(false); router.push('/valise'); }}
          />
        </div>
      </div>
    </div>
  );
}
