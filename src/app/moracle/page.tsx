"use client";
import { useEffect, useState, useRef } from "react";
import { supabase } from "@/utils/supabaseClient";
import Image from "next/image";

const ABSURD_WISHES = [
  "Je te donne la capacité de retrouver n’importe quel objet perdu… en le cherchant bien.",
  "Désormais, tu peux voyager dans le temps… au rythme d’une seconde par seconde.",
  "Tu peux devenir invisible… quand personne ne te regarde.",
  "Tu ne seras plus jamais en retard… à condition de partir hier.",
  "Je fais en sorte que tu ne manques plus jamais de batterie… tant que ton téléphone est éteint.",
  "Tous les feux passeront au vert… quand tu n’es pas pressé.",
  "Tu trouveras toujours des toilettes libres… quand tu n’auras pas besoin d’y aller.",
  "Tu peux parler aux animaux… mais ils ne te répondront pas.",
  "Je t’accorde le pouvoir de marcher sur l’eau… lorsqu’elle est gelée.",
  "Tu n’attraperas plus jamais de rhume… si tu ne sors plus de chez toi.",
  "Je te rends immortel… jusqu’à ta mort.",
  "Désormais, tu gagnes toujours au loto… imaginaire.",
  "Tu auras toujours raison… quand tu parleras tout seul.",
  "Tu pourras résoudre n’importe quel problème mathématique… en regardant la solution.",
  "Je fais en sorte que ton café reste toujours chaud… tant que tu n’y touches pas.",
  "Tu peux lire dans les pensées… des poissons rouges."
];

function getRandomWish() {
  if (Math.random() < 0.25) {
    return { type: "narval", text: "✨ Tu as gagné 1 Narval !" };
  } else {
    const idx = Math.floor(Math.random() * ABSURD_WISHES.length);
    return { type: "text", text: ABSURD_WISHES[idx] };
  }
}

export default function MoraclePage() {
  const [showIntro, setShowIntro] = useState(true);
  const [introMuted, setIntroMuted] = useState(false); // Son activé par défaut
  const [introLoading, setIntroLoading] = useState(true);
  const [introError, setIntroError] = useState<string|null>(null);
  const introVideoRef = useRef<HTMLVideoElement | null>(null);

  // Force play() dès que la vidéo est prête (pour certains navigateurs)
  useEffect(() => {
    if (showIntro && introVideoRef.current && !introMuted) {
      introVideoRef.current.muted = false;
      introVideoRef.current.volume = 1;
      introVideoRef.current.play().catch(()=>{});
    }
  }, [showIntro, introMuted]);

  // Si la vidéo ne démarre pas, afficher un message d’erreur après 6s
  useEffect(() => {
    let timeout: any;
    if (showIntro && introLoading) {
      timeout = setTimeout(() => {
        setIntroError("Impossible de lire la vidéo d’intro. Essayez de recharger la page.");
      }, 6000);
    }
    return () => clearTimeout(timeout);
  }, [showIntro, introLoading]);
  const [user, setUser] = useState<any>(null);
  const [wishes, setWishes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState<{type: string, text: string}|null>(null);
  const [resultId, setResultId] = useState<string|null>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [playing, setPlaying] = useState(false);
  const [showRules, setShowRules] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);

  // Fetch user and wishes
  useEffect(() => {
    const fetchUserAndWishes = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
      if (user) {
        const { data: wishesData } = await supabase
          .from("moracle_wishes")
          .select("*")
          .eq("user_uid", user.id)
          .eq("is_consumed", false)
          .order("created_at", { ascending: true });
        setWishes(wishesData || []);
      }
      setLoading(false);
    };
    fetchUserAndWishes();
  }, []);

  // Fetch history
  useEffect(() => {
    const fetchHistory = async () => {
      const { data: hist } = await supabase
        .from("moracle_wishes")
        .select("created_at, result_type, result_text, user_uid, consumed_at, users: user_uid (pseudo, avatar)")
        .eq("is_consumed", true)
        .order("consumed_at", { ascending: false })
        .limit(20);
      setHistory(hist || []);
    };
    fetchHistory();
  }, [result]);

  // Nouvelle version : consommation atomique du vœu dès le clic
const handleWish = async () => {
  if (!user || wishes.length === 0 || playing) return;
  setPlaying(true);
  audioRef.current?.play();
  const wish = wishes[0];
  const tirage = getRandomWish();
  // Debug : log tirage et wish
  console.debug('[MORACLE] Tirage du vœu', { wish, tirage });
  // MAJ immédiate du vœu en base pour éviter l'exploit (reload)
  const { error: consumeError } = await supabase.from("moracle_wishes").update({
    is_consumed: true,
    consumed_at: new Date().toISOString(),
    result_type: tirage.type,
    result_text: tirage.type === "text" ? tirage.text : null
  }).eq("id", wish.id);
  if (consumeError) {
    console.error('[MORACLE] Erreur MAJ vœu', consumeError);
    setPlaying(false);
    return;
  }
  setResult(tirage);
  setResultId(wish.id);
  // Affiche la récompense 6s puis applique les effets (narval, refresh, etc)
  setTimeout(async () => {
    if (tirage.type === "narval") {
        // Incrémente le solde utilisateur côté client
        const { data: userData, error: fetchError } = await supabase
          .from('users')
          .select('solde')
          .eq('uid', user.id)
          .single();
        if (fetchError) {
          console.error('[MORACLE][SOLDE] Erreur récupération solde utilisateur', fetchError);
        }
        if (userData && typeof userData.solde === 'number') {
          const { error: updateError } = await supabase
            .from('users')
            .update({ solde: userData.solde + 1 })
            .eq('uid', user.id);
          if (updateError) {
            console.error('[MORACLE][SOLDE] Erreur update solde utilisateur', updateError);
          } else {
            // Ajoute la transaction Moracle dans l'historique du portefeuille
            const { error: txError } = await supabase.from('transactions').insert({
              type: 'moracle',
              from: null,
              to: user.id,
              montant: 1,
              description: "Moracle t’a envoyé 1 narval",
              date: new Date().toISOString(),
            });
            if (txError) {
              console.error('[MORACLE][TX] Erreur création transaction Moracle', txError);
            }
            // Rafraîchit le user pour afficher le nouveau solde
            const { data: refreshedUser, error: refreshError } = await supabase
              .from('users')
              .select('solde')
              .eq('uid', user.id)
              .single();
            if (!refreshError && refreshedUser) {
              setUser((u: any) => ({ ...u, solde: refreshedUser.solde }));
            }
          }
        }
      }
      setResult(null);
      setResultId(null);
      setPlaying(false);
      // Refresh wishes
      const { data: wishesData } = await supabase
        .from("moracle_wishes")
        .select("*")
        .eq("user_uid", user.id)
        .eq("is_consumed", false)
        .order("created_at", { ascending: true });
      setWishes(wishesData || []);
      // Refresh history
      const { data: hist } = await supabase
        .from("moracle_wishes")
        .select("created_at, result_type, result_text, user_uid, consumed_at, users: user_uid (pseudo, avatar)")
        .eq("is_consumed", true)
        .order("consumed_at", { ascending: false })
        .limit(20);
      setHistory(hist || []);
    }, 6000);
  };

  if (showIntro) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0B0F1C]">
        <video
          ref={introVideoRef}
          src="/moracle.mp4"
          className="w-full h-full object-contain bg-black"
          autoPlay
          muted={introMuted}
          playsInline
          onCanPlay={() => setIntroLoading(false)}
          onEnded={() => setShowIntro(false)}
          style={{ maxWidth: '100vw', maxHeight: '100vh' }}
        />
        {/* Boutons overlay */}
        <button
          className="absolute top-4 right-4 bg-black/60 text-white rounded-full px-5 py-2 text-lg font-bold shadow-lg hover:bg-black/80 transition"
          onClick={() => setShowIntro(false)}
        >
          Passer l'intro
        </button>
        <button
          className="absolute top-4 left-4 bg-black/60 text-white rounded-full px-4 py-2 text-base font-semibold shadow hover:bg-black/80 transition"
          onClick={() => {
            setIntroMuted(false);
            setTimeout(() => {
              if (introVideoRef.current) {
                introVideoRef.current.muted = false;
                introVideoRef.current.volume = 1;
                introVideoRef.current.play().catch(()=>{});
              }
            }, 80);
          }}
        >
          {introMuted ? '🔊 Activer le son' : '🔇 Couper le son'}
        </button>
        {introLoading && !introError && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-2xl text-white font-bold animate-pulse">Chargement…</div>
          </div>
        )}
        {introError && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-xl text-red-300 font-bold bg-black/70 px-6 py-4 rounded-xl">
              {introError}
              <br />
              <button className="mt-4 px-4 py-2 bg-amber-400 text-black rounded font-bold" onClick={() => window.location.reload()}>Recharger</button>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <>
      {/* Bouton info en haut à droite (SVG identique à la page /pinata) */}
      <button
        className="fixed top-4 right-4 z-40 bg-black/60 hover:bg-black/80 text-white rounded-full w-10 h-10 flex items-center justify-center shadow-lg"
        onClick={() => setShowRules(true)}
        aria-label="Afficher les règles Moracle"
      >
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-6 h-6">
          <circle cx="12" cy="12" r="10" stroke="#38bdf8" strokeWidth="2.2" fill="#181F2E" />
          <rect x="11.1" y="7" width="1.8" height="1.8" rx="0.9" fill="#38bdf8" />
          <rect x="11.1" y="10.2" width="1.8" height="6.2" rx="0.9" fill="#38bdf8" />
        </svg>
      </button>

      {/* Modal règles Moracle */}
      {showRules && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80">
          <div className="relative w-full max-w-md mx-auto flex flex-col items-center">
            <button
              className="absolute top-2 right-2 bg-black/60 hover:bg-black/90 text-white rounded-full w-9 h-9 flex items-center justify-center text-2xl font-bold z-10"
              onClick={() => setShowRules(false)}
              aria-label="Fermer les règles"
            >
              ✖️
            </button>
            <img
              src="/reglemoracle.png"
              alt="Règles du Moracle"
              className="w-full max-w-md rounded-xl shadow-xl border border-gray-700 bg-white"
              style={{maxHeight: '85vh', objectFit: 'contain'}}
            />
          </div>
        </div>
      )}

      <div className="min-h-screen bg-[#0B0F1C] py-8 px-3 flex flex-col items-center font-inter">
      <h1 className="text-base sm:text-lg font-extrabold text-amber-400 mb-3 text-center drop-shadow-glow">
        Tes paris ratés ne sont pas totalement perdus…
      </h1>
      <div className="flex flex-col items-center w-full max-w-md mx-auto mb-6">
        <div className="flex flex-col items-center w-full">
          <Image
            src="/moracle.png"
            alt="Moracle, le Génie Déchu"
            width={220}
            height={220}
            className="mx-auto mb-2 rounded-2xl shadow"
            priority
          />
          {loading ? (
            <div className="text-gray-400 mt-4">Chargement…</div>
          ) : wishes.length > 0 ? (
            <>
              <button
                className="mt-4 px-8 py-4 rounded-full bg-orange-500 hover:bg-orange-400 text-white text-xl font-extrabold shadow-lg transition-all duration-150 active:scale-95 drop-shadow-glow"
                onClick={handleWish}
                disabled={playing}
                style={{ minWidth: 200 }}
              >
                ✨ Faire un vœu ({wishes.length})
              </button>
              <audio ref={audioRef} src="/moracle.mp3" preload="auto" />
              {result && resultId === wishes[0]?.id && (
                <div className="mt-8 mb-2 w-full flex justify-center">
                  <div className="bg-[#232B42] rounded-2xl shadow-lg px-6 py-8 text-center max-w-xs animate-fade-in">
                    <div className="text-3xl mb-3">🧞‍♂️</div>
                    <div
                      className="text-lg font-bold text-amber-300 mb-1 animate-moracle-pop"
                      style={{
                        animation: 'moracle-pop 0.7s cubic-bezier(.23,1.17,.45,1.01)',
                        textShadow: '0 0 8px #fbbf24, 0 0 16px #fbbf24, 0 0 2px #fff'
                      }}
                    >
                      {result.text}
                    </div>
                    {result.type === 'text' && (
                      <div className="text-xs text-gray-400 mt-3 italic">Moracle t’a béni d’un pouvoir… discutable.</div>
                    )}
                  </div>
                </div>
              )}
              <style>{`
                @keyframes moracle-pop {
                  0% { transform: scale(0.7); opacity: 0; }
                  60% { transform: scale(1.15); opacity: 1; }
                  80% { transform: scale(0.95); }
                  100% { transform: scale(1); }
                }
              `}</style>
            </>
          ) : (
            <div className="mt-6 text-center text-cyan-200 text-base font-semibold">
              Tu n’as pas de vœu en attente.<br />Perds un pari pour m’invoquer 😈
            </div>
          )}
        </div>
      </div>
      <div className="w-full max-w-md mx-auto mt-6">
        <h2 className="text-lg font-bold text-cyan-300 mb-2">Derniers vœux exaucés</h2>
        <div className="flex flex-col gap-2 max-h-80 overflow-y-auto">
          {history.length === 0 && (
            <div className="text-gray-400 text-center">Aucun vœu exaucé récemment…</div>
          )}
          {history.map((wish, idx) => {
            // Format JJ/MM sans année
            let dateStr = '';
            if (wish.consumed_at) {
              const d = new Date(wish.consumed_at);
              dateStr = d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
            }
            return (
              <div key={wish.consumed_at + wish.user_uid + idx} className="flex items-center gap-2 bg-[#181F2E] rounded-xl px-4 py-3 shadow min-h-[38px]">
                <img
                  src={wish.users?.avatar || "/default-avatar.png"}
                  alt="Avatar Joueur"
                  className="w-7 h-7 aspect-square rounded-full object-cover border border-gray-700"
                />
                <span className="text-xs text-gray-400 ml-1 min-w-[38px] text-center">
                  {dateStr}
                </span>
                <span className="ml-2 text-xs text-amber-300 font-medium break-words whitespace-pre-line min-h-[18px]">
                  {wish.result_type === "narval" ? "+1 Narval" : wish.result_text}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
    </>
  );
}
