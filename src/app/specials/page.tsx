"use client";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";

// À uploader dans /public/specials/pinata-pari-cover.jpg (800x400px conseillé, JPG ou WEBP)
const SPECIALS = [
  {
    slug: "pari-pinata",
    title: "Pari Piñata",
    cover: "/specials/pinata-pari-cover.jpg",
    until: "Disponible jusqu'au 31 juillet",
    description: "Fais péter la piñata et repars avec des narvals.",
    link: "/pinata"
  },
  {
    slug: "moracle-genie",
    title: "🧞‍♂️ Moracle, le Génie Déchu",
    cover: "/specials/moracle-cover.png",
    until: "Disponible jusqu’au 31 juillet",
    description: "Chaque défaite t’offre un vœu… souvent nul, parfois rentable.",
    link: "/moracle"
  }
];

export default function SpecialsPage() {
  const router = useRouter();
  // Handler pour la Piñata : set sessionStorage et navigate
  const handleGoToPinata = (e?: React.MouseEvent) => {
    if (e) e.preventDefault();
    if (typeof window !== "undefined") {
      sessionStorage.setItem("unmuteIntro", "1");
    }
    router.push("/pinata");
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
                onClick={evt.slug === "pari-pinata" ? handleGoToPinata : evt.slug === "moracle-genie" ? () => router.push('/moracle') : undefined}
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
                  onClick={evt.slug === "pari-pinata" ? handleGoToPinata : evt.slug === "moracle-genie" ? () => router.push('/moracle') : undefined}
                  className="inline-block w-fit bg-amber-400 hover:bg-amber-300 text-black font-bold px-5 py-2 rounded-xl shadow-lg transition disabled:opacity-60 text-base"
                >
                  Découvrir
                </button>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
