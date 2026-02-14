"use client";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

// À uploader dans /public/specials/pinata-pari-cover.jpg (800x400px conseillé, JPG ou WEBP)
const SPECIALS = [
  // Mettre l'événement Trésor en premier (actif)
  {
    slug: "chasse-tresor",
    title: "Chasse au Trésor",
    cover: "/specials/tresor-cover.png",
    until: "Disponible jusqu'au 1er juin",
    description: "Un trésor est caché, aide Jack à le trouver avant les autres.",
    link: "/specials/tresor"
  },
  // Mettre l'événement Valise en premier
  {
    slug: "valise",
    title: "Prépare ta valise",
    cover: "/specials/valise-cover.png",
    until: "Disponible jusqu’au 24 février",
    description: "Complète ta valise avant le départ et gagne des Narvals.",
    link: "/valise"
  },
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
  // debug: weather widget state (Sousse at 15:00)
  type WeatherInfo = { temp: number; code: number; emoji: string; label: string; time: string };
  const [valiseWeather, setValiseWeather] = useState<WeatherInfo | null>(null);

  const mapWeather = (code: number) => {
    if (code === 0) return { emoji: '☀️', label: 'Ensoleillé' };
    if ([1,2,3].includes(code)) return { emoji: '⛅', label: 'Nuageux' };
    if ([45,48].includes(code)) return { emoji: '🌫️', label: 'Brouillard' };
    if ([51,53,55,56,57].includes(code)) return { emoji: '🌦️', label: 'Bruine' };
    if ([61,63,65].includes(code)) return { emoji: '🌧️', label: 'Pluie' };
    if ([66,67].includes(code)) return { emoji: '🌧️', label: 'Pluie gelée' };
    if ([71,73,75,77].includes(code)) return { emoji: '🌨️', label: 'Neige' };
    if ([80,81,82].includes(code)) return { emoji: '🌦️', label: 'Averses' };
    if ([85,86].includes(code)) return { emoji: '🌨️', label: 'Averses de neige' };
    if ([95,96,99].includes(code)) return { emoji: '⛈️', label: 'Orage' };
    return { emoji: '🌤️', label: 'Variable' };
  };

  useEffect(() => {
    const run = async () => {
      try {
        const today = new Date();
        const dayStr = today.toISOString().slice(0,10);
        const key = `valise_weather_${dayStr}`;
        const cached = typeof window !== 'undefined' ? localStorage.getItem(key) : null;
        if (cached) {
          console.debug('[Specials][weather] cache hit');
          setValiseWeather(JSON.parse(cached));
          return;
        }
        const lat = 35.8256; // Sousse
        const lon = 10.6411;
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&hourly=temperature_2m,weather_code&timezone=auto`;
        console.debug('[Specials][weather] fetch', url);
        const res = await fetch(url, { cache: 'no-store' });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const json = await res.json();
        const times: string[] = json?.hourly?.time || [];
        const temps: number[] = json?.hourly?.temperature_2m || [];
        const codes: number[] = json?.hourly?.weather_code || [];
        let idx = times.findIndex(t => t.startsWith(dayStr) && t.includes('T15:00'));
        if (idx === -1) {
          idx = times.findIndex(t => t.startsWith(dayStr) && t.includes('T14:00'));
          if (idx === -1) idx = times.findIndex(t => t.startsWith(dayStr) && t.includes('T16:00'));
          if (idx === -1) idx = times.findIndex(t => t.startsWith(dayStr));
        }
        if (idx >= 0) {
          const code = Number(codes[idx] ?? 0);
          const { emoji, label } = mapWeather(code);
          const info: WeatherInfo = { temp: Number(temps[idx] ?? 0), code, emoji, label, time: (times[idx] || '').slice(11,16) };
          setValiseWeather(info);
          try { localStorage.setItem(key, JSON.stringify(info)); } catch {}
        }
      } catch (e) {
        console.error('[Specials][weather] error', e);
      }
    };
    run();
  }, []);
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
    } catch {
      router.push('/valise');
    }
  };
  return (
    <div className="min-h-screen bg-[#0B0F1C] py-6 px-3 sm:px-0 flex flex-col items-center">
      <h1 className="text-xl sm:text-2xl font-extrabold text-amber-400 mb-7 text-center drop-shadow-glow flex items-center gap-1">
        <span>🎯</span> Jeux & défis du moment
      </h1>
      <div className="w-full max-w-xl flex flex-col gap-7">
        {SPECIALS.map(evt => {
          const expired = (evt.slug === 'pari-pinata' || evt.slug === 'moracle-genie') && (new Date() >= new Date('2026-01-01'));
          return (
            <div key={evt.slug} className="bg-[#181F2E] rounded-2xl shadow-xl border border-[#232B42] overflow-hidden group transition-all duration-200">
              {evt.link && !expired ? (
                <button
                  type="button"
                  onClick={
                    evt.slug === "pari-pinata"
                      ? handleGoToPinata
                      : evt.slug === "moracle-genie"
                        ? () => router.push('/moracle')
                        : evt.slug === "chasse-tresor"
                          ? () => router.push('/specials/tresor')
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
                  {evt.slug === 'valise' && (
                    <div className="absolute top-2 right-2 z-10 inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-black/45 backdrop-blur-sm border border-white/20 text-white">
                      <span className="text-base" aria-hidden>{valiseWeather?.emoji || '🌤️'}</span>
                      <span className="text-sm font-semibold">{valiseWeather ? `${Math.round(valiseWeather.temp)}°C` : '…'}</span>
                      <span className="text-xs text-cyan-200/90">{valiseWeather?.label || 'Météo'}</span>
                    </div>
                  )}
                </button>
              ) : (
                <div className="relative w-full" style={{ aspectRatio: '2/1' }}>
                  <Image
                    src={evt.cover}
                    alt={evt.title}
                    fill
                    className="object-cover grayscale opacity-80"
                    sizes="(max-width: 640px) 100vw, 800px"
                    priority={true}
                  />
                  <div className="absolute top-2 left-2 z-10 px-2.5 py-1 rounded-full bg-black/60 border border-white/20 text-white text-xs font-semibold">
                    Terminé
                  </div>
                </div>
              )}
              <div className="p-4 flex flex-col gap-2">
                <div className="flex items-center justify-between mb-1">
                  <h2 className="text-xl font-bold text-white drop-shadow-glow">{evt.title}</h2>
                  <span className="text-xs text-cyan-300 font-semibold whitespace-nowrap">{expired ? 'Revient bientôt' : evt.until}</span>
                </div>
                <p className="text-gray-300 text-sm mb-2">{evt.description}</p>
                {evt.link && !expired ? (
                  <button
                    type="button"
                    onClick={
                      evt.slug === "pari-pinata"
                        ? handleGoToPinata
                        : evt.slug === "moracle-genie"
                          ? () => router.push('/moracle')
                          : evt.slug === "chasse-tresor"
                            ? () => router.push('/specials/tresor')
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
          );
        })}
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
            Passer l&apos;intro
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
