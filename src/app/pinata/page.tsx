"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/utils/supabaseClient";

interface Pinata {
  pinata_id: string;
  pv_total: number;
  pv_restants: number;
  date_creation: string;
  joueur_gagnant_id: string | null;
  joueur_gagnant_pseudo: string | null;
  nombre_total_de_coups: number | null;
  statut: string;
}

interface PinataHit {
  id: string;
  user_id: string;
  pinata_id: string;
  timestamp: string;
  user: {
    pseudo: string;
    avatar: string | null;
    uid: string;
  };
}

import { useRef } from "react";
import LiveCountdown from "../components/LiveCountdown";

export default function PinataPage() {
  // ...
  const [debugInfo, setDebugInfo] = useState<any>(null);
  const router = useRouter();
  const [showIntro, setShowIntro] = useState(true);
  const [introLoading, setIntroLoading] = useState(true);
  const [introError, setIntroError] = useState<string|null>(null);
  const [introMuted, setIntroMuted] = useState(true);
  const introVideoRef = useRef<HTMLVideoElement | null>(null);
  const [showInfo, setShowInfo] = useState(false);
  const [pinata, setPinata] = useState<Pinata | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [hitAvailable, setHitAvailable] = useState<boolean | null>(null);
  const [hitLoading, setHitLoading] = useState<boolean>(true);
  const [hitMsg, setHitMsg] = useState<string>("");
  const [funnyMsg, setFunnyMsg] = useState<string>("");
  const [hits, setHits] = useState<PinataHit[]>([]);
  const [totalHits, setTotalHits] = useState<number>(0);
  const [lastReward, setLastReward] = useState<number | null>(null);

  // Hydration fix
  const [isClient, setIsClient] = useState(false);
  useEffect(() => { setIsClient(true); }, []);

  // Dès que la piñata est terminée, récupère le montant de la récompense versée
  useEffect(() => {
    const fetchReward = async () => {
      if (
        pinata &&
        pinata.statut === 'terminee' &&
        pinata.joueur_gagnant_id
      ) {
        // On va chercher la transaction de reward correspondante
        const { data, error } = await supabase
          .from('transactions')
          .select('montant')
          .eq('type', 'pinata')
          .eq('to', pinata.joueur_gagnant_id)
          .order('date', { ascending: false })
          .limit(1)
          .single();
        if (!error && data && typeof data.montant === 'number') {
          setLastReward(data.montant);
        }
      }
    };
    fetchReward();
  }, [pinata]);
  // Unmute intro si flag sessionStorage présent
  useEffect(() => {
    if (showIntro && typeof window !== 'undefined') {
      const shouldUnmute = sessionStorage.getItem("unmuteIntro") === "1";
      if (shouldUnmute) {
        setIntroMuted(false);
        setTimeout(() => {
          if (introVideoRef.current) {
            introVideoRef.current.muted = false;
            introVideoRef.current.volume = 1;
            introVideoRef.current.play().catch(()=>{});
          }
          sessionStorage.removeItem("unmuteIntro");
        }, 100);
      }
    }
  }, [showIntro]);

  // Auto-création de piñata à minuit si aucune active
  useEffect(() => {
    const checkAndCreatePinata = async () => {
      const { data: lastPinata, error } = await supabase
        .from('pinata')
        .select('*')
        .order('date_creation', { ascending: false })
        .limit(1)
        .single();
      if (error) return;
      const now = new Date();
      const todayStr = now.toISOString().slice(0, 10);
      if (
        (!lastPinata || lastPinata.statut === 'terminee') &&
        (!lastPinata || lastPinata.date_creation.slice(0, 10) !== todayStr)
      ) {
        await supabase.from('pinata').insert([
          {
            pv_total: 10,
            pv_restants: 10,
            date_creation: now.toISOString(),
            statut: 'active',
          },
        ]);
        // Re-fetch pour afficher la nouvelle
        fetchPinata();
      }
    };
    checkAndCreatePinata();
  }, []);

  // Récupère la piñata
  useEffect(() => {
    const fetchPinata = async () => {
      setLoading(true);
      setError(null);
      const { data, error } = await supabase
        .from("pinata")
        .select("*")
        .order("date_creation", { ascending: false })
        .limit(1)
        .single();
      if (error) {
        setError("Erreur lors du chargement de la piñata.");
        setPinata(null);
      } else {
        setPinata(data);

      }
      setLoading(false);
    };
    fetchPinata();
  }, []);

  // Récupère l'utilisateur connecté et son droit à un coup
  useEffect(() => {
    const fetchUserAndHit = async () => {
      setHitLoading(true);
      setHitAvailable(null);
      setHitMsg("");
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setUserId(null);
        setHitAvailable(false);
        setHitMsg("Non connecté");
        setHitLoading(false);
        return;
      }
      setUserId(user.id);
      if (!pinata) {
        setHitAvailable(false);
        setHitMsg("Pas de piñata active");
        setHitLoading(false);
        return;
      }
      // Cherche la ligne user_daily_hit du jour et de cette piñata
      const today = new Date().toISOString().slice(0, 10); // format YYYY-MM-DD
      const { data: hitData, error: hitError } = await supabase
        .from("user_daily_hit")
        .select("*")
        .eq("user_id", user.id)
        .eq("pinata_id", pinata.pinata_id)
        .eq("date", today)
        .single();
      // Stocke le debug dans un état
      setDebugInfo({
        userId: user.id,
        pinataId: pinata.pinata_id,
        today,
        hitData,
        hitError
      });
      if (hitError || !hitData) {
        setHitAvailable(false);
        setHitMsg("Aucun coup disponible aujourd'hui (accepte un pari pour en obtenir un)");
      } else if (!hitData.has_pari_accepted) {
        setHitAvailable(false);
        setHitMsg("Accepte un pari aujourd'hui pour débloquer un coup !");
      } else if (hitData.has_used_hit) {
        setHitAvailable(false);
        setHitMsg("Coup déjà utilisé aujourd'hui");
      } else {
        setHitAvailable(true);
        setHitMsg("Coup disponible !");
      }
      setHitLoading(false);
    };
    if (pinata && !pinata.joueur_gagnant_id) {
      fetchUserAndHit();
    } else {
      setHitAvailable(false);
      setHitMsg("");
      setHitLoading(false);
    }
  }, [pinata]);

  // Récupère l'historique des coups dès que la piñata change
  useEffect(() => {
    const fetchHits = async () => {
      if (!pinata) return;
      // Récupère les 10 derniers coups + total
      const { data: hitsData, error: hitsError, count } = await supabase
        .from('pinata_hits')
        .select('id, user_id, pinata_id, timestamp, user: user_id (pseudo, avatar, uid)', { count: 'exact' })
        .eq('pinata_id', pinata.pinata_id)
        .order('timestamp', { ascending: false })
        .limit(10);
      if (!hitsError && hitsData) {
        // Corrige le cas où user est un tableau (Supabase join)
        const mappedHits = hitsData.map((hit: any) => ({
          ...hit,
          user: Array.isArray(hit.user) ? hit.user[0] : hit.user,
        }));
        setHits(mappedHits);
        setTotalHits(count || mappedHits.length);
      } else {
        setHits([]);
        setTotalHits(0);
      }
    };
    fetchHits();
  }, [pinata]);

  // Ajoute un hit lors du coup
  async function handleHit() {
    if (!userId || !pinata) return;
    setHitLoading(true);
    setHitMsg("Analyse de l’impact…");
    setFunnyMsg("");
    await new Promise(res => setTimeout(res, 1000));
    const hitSounds = Array.from({length: 11}, (_, i) => `/sounds/hit${i+1}.mp3`);
    const audio = new Audio(hitSounds[Math.floor(Math.random()*hitSounds.length)]);
    audio.play();
    const today = new Date().toISOString().slice(0, 10);
    const { error: hitErr } = await supabase
      .from("user_daily_hit")
      .update({ has_used_hit: true })
      .eq("user_id", userId)
      .eq("pinata_id", pinata.pinata_id)
      .eq("date", today);
    if (hitErr) {
      setHitMsg("Erreur lors de l'utilisation du coup");
      setHitLoading(false);
      return;
    }
    // Ajoute dans pinata_hits
    await supabase.from("pinata_hits").insert({
      user_id: userId,
      pinata_id: pinata.pinata_id,
      timestamp: new Date().toISOString(),
    });
    // Décrémenter les PV de la piñata
    const { data: newPinata, error: pinataErr } = await supabase
      .from("pinata")
      .update({ pv_restants: pinata.pv_restants - 1 })
      .eq("pinata_id", pinata.pinata_id)
      .select()
      .single();
    if (pinataErr) {
      setHitMsg("Erreur lors de la mise à jour de la piñata");
      setHitLoading(false);
      return;
    }
    setPinata(newPinata);
    setHitAvailable(false);

    // --- PATCH ROBUSTE ---
    // On récupère la piñata à jour en base (pour éviter les bugs de race/double-clic/latence)
    const { data: pinataCheck } = await supabase
      .from('pinata')
      .select('*')
      .eq('pinata_id', pinata.pinata_id)
      .single();

    if (pinataCheck && pinataCheck.pv_restants <= 0 && (!pinataCheck.joueur_gagnant_id || pinataCheck.statut !== 'terminee')) {
      // Récupère le dernier coup porté sur cette piñata
      const { data: hits, error: hitsError } = await supabase
      .from('pinata_hits')
      .select('user_id')
      .eq('pinata_id', pinata.pinata_id)
      .order('timestamp', { ascending: false })
      .limit(1);
    const lastHit = hits && hits.length > 0 ? hits[0] : null;
    if (!lastHit || !lastHit.user_id) {
      // Aucun coup : ne rien faire
      return;
    }
    const gagnantId = lastHit.user_id;
    // Requête séparée pour le pseudo
    let gagnantPseudo = null;
    const { data: userData } = await supabase
      .from('users')
      .select('pseudo')
      .eq('uid', gagnantId)
      .single();
    if (userData && userData.pseudo) {
      gagnantPseudo = userData.pseudo;
    }
    // Debug temporaire
    console.log('lastHit', lastHit, 'pseudo', gagnantPseudo);
      // 1. Génère un montant aléatoire entre 3 et 8
      const reward = Math.floor(Math.random() * 6) + 3;
      setLastReward(reward);
      // 2. Met à jour la piñata avec le vrai gagnant
      await supabase
        .from('pinata')
        .update({
          joueur_gagnant_id: gagnantId,
          joueur_gagnant_pseudo: gagnantPseudo,
          statut: 'terminee',
          nombre_total_de_coups: totalHits
        })
        .eq('pinata_id', pinata.pinata_id);
      // 3. Créditer le solde du gagnant
      const { data: gagnantData, error: gagnantFetchError } = await supabase
        .from('users')
        .select('solde')
        .eq('uid', gagnantId)
        .single();
      if (!gagnantFetchError && gagnantData) {
        await supabase
          .from('users')
          .update({ solde: gagnantData.solde + reward })
          .eq('uid', gagnantId);
        // Ajoute une transaction historique pour la récompense piñata
        await supabase
          .from('transactions')
          .insert([
            {
              type: 'pinata',
              from: null,
              to: gagnantId,
              montant: reward,
              description: `Récompense piñata explosée (${reward} narvals)`,
              date: new Date().toISOString()
            }
          ]);
      }
    }
    // Message comique
    const funnyMsgs = [
      "💥 Boom ! Rien. Cette piñata est faite en kevlar.",
      "🔫 Touchée, mais pas coulée.",
      "🎯 Elle a esquivé. La garce.",
      "⚔️ Le coup était beau… mais pas décisif.",
      "🪓 Encore un peu de patience… peut-être le prochain ?",
      "🥊 Elle vacille… ou pas.",
      "🧨 Presque. Ça a vibré, non ?"
    ];
    if (pinataCheck && pinataCheck.pv_restants <= 0) {
      setFunnyMsg("Piñata explosée !");
    } else {
      const msg = funnyMsgs[Math.floor(Math.random()*funnyMsgs.length)];
      setFunnyMsg(msg);
    }
    setTimeout(() => setFunnyMsg(""), 5000);
    setHitMsg(pinataCheck && pinataCheck.pv_restants <= 0 ? "Piñata explosée !" : "Coup utilisé !");
    setHitLoading(false);
    // Refresh hits
    const { data: hitsData, error: hitsError, count } = await supabase
      .from('pinata_hits')
      .select('id, user_id, pinata_id, timestamp, user: user_id (pseudo, avatar, uid)', { count: 'exact' })
      .eq('pinata_id', pinata.pinata_id)
      .order('timestamp', { ascending: false })
      .limit(10);
    if (!hitsError && hitsData) {
      const mappedHits = hitsData.map((hit: any) => ({
        ...hit,
        user: Array.isArray(hit.user) ? hit.user[0] : hit.user,
      }));
      setHits(mappedHits);
      setTotalHits(count || mappedHits.length);
    }
  // FIN PATCH

  }

  return (
    <>
      {/* Intro vidéo plein écran */}
      {showIntro && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black">
          {/* Overlay de chargement/erreur */}
          {isClient && introLoading && !introError && (
            <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-80 text-white text-xl font-bold">
              Chargement de l’intro…
            </div>
          )}
          {introError && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black bg-opacity-90 text-red-400 text-lg font-semibold z-10">
              <span>Erreur lors du chargement de l’intro 😢</span>
              <button
                onClick={() => setShowIntro(false)}
                className="mt-6 px-5 py-3 rounded-xl bg-gray-800 text-white hover:bg-gray-700 font-bold shadow-lg"
              >Passer l’intro</button>
            </div>
          )}
          <video
            ref={introVideoRef}
            src="/intro.mp4"
            autoPlay
            playsInline
            muted={introMuted}
            className="w-full h-full object-contain bg-black max-w-full max-h-full"
            onEnded={() => setShowIntro(false)}
            onClick={() => setShowIntro(false)}
            tabIndex={0}
            aria-label="Intro Piñata"
            onLoadStart={() => { setIntroLoading(true); setIntroError(null); }}
            onWaiting={() => setIntroLoading(true)}
            onCanPlay={() => setIntroLoading(false)}
            onPlay={() => setIntroLoading(false)}
            onError={() => { setIntroError("Impossible de lire la vidéo. Vérifie que intro.mp4 est bien dans /public et au bon format."); setIntroLoading(false); }}
            style={{ display: introError ? 'none' : 'block' }}
          />
          {/* Bouton passer l’intro, toujours accessible */}
          {!introError && (
            <button
              onClick={() => setShowIntro(false)}
              className="absolute bottom-8 right-8 px-4 py-2 rounded-full bg-black bg-opacity-60 text-white text-sm font-semibold hover:bg-opacity-90 border border-white/20 shadow-lg z-20"
              style={{ backdropFilter: 'blur(2px)' }}
              style={{backdropFilter:'blur(2px)'}}
            >Passer l’intro</button>
          )}
        </div>
      )}
      <div className={`min-h-screen flex flex-col items-center justify-center bg-[#0B0F1C] text-white px-2 py-8 relative${showIntro ? ' pointer-events-none select-none opacity-0' : ''}`}>
      {/* Bouton retour home */}
      <button
        onClick={() => router.push("/")}
        className="absolute top-3 left-3 z-20 bg-slate-700/80 hover:bg-slate-600/90 rounded-full p-2 shadow transition focus:outline-none focus:ring-2 focus:ring-cyan-400 flex items-center justify-center"
        style={{ width: 40, height: 40 }}
        aria-label="Retour à l'accueil"
      >
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5 text-cyan-300">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
        </svg>
      </button>
      {/* Bouton info règles */}
      <button
        onClick={() => setShowInfo(true)}
        className="absolute top-3 right-3 z-20 bg-slate-700/80 hover:bg-slate-600/90 rounded-full p-2 shadow transition focus:outline-none focus:ring-2 focus:ring-cyan-400 flex items-center justify-center"
        style={{ width: 40, height: 40 }}
        aria-label="Règles du mini-jeu"
      >
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5 text-cyan-300">
          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" fill="none" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v2m0 4h.01" />
        </svg>
      </button>
      {/* Modal info règles */}
      {showInfo && (
        <div className="fixed inset-0 z-40 bg-black/90 flex items-center justify-center">
          <button
            onClick={() => setShowInfo(false)}
            className="fixed top-4 right-4 text-gray-400 hover:text-cyan-400 z-50 bg-slate-800/70 rounded-full p-2"
            aria-label="Fermer"
            style={{ backdropFilter: 'blur(4px)' }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-7 h-7">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <img
            src="/reglepinata.png"
            alt="Règles du mini-jeu Piñata"
            className="max-w-[100vw] max-h-[100vh] w-auto h-auto object-contain mx-auto"
            style={{ boxShadow: '0 0 40px #000a' }}
          />
        </div>
      )}
      <div className="w-full max-w-md mx-auto bg-[#181F32] rounded-2xl shadow-lg p-6 flex flex-col items-center">
        {loading && <div className="text-gray-400">Chargement…</div>}
        {error && <div className="text-red-400 mb-2">{error}</div>}
        {pinata && pinata.joueur_gagnant_id ? (
          // --- Piñata explosée ---
          <div className="flex flex-col items-center w-full">
            {/* Image piñata explosée en grand */}
            <img
              src="/pinata/pinata_broken.png"
              alt="Piñata explosée"
              className="w-40 h-40 md:w-52 md:h-52 object-contain drop-shadow-xl mb-4 mt-2"
              draggable={false}
            />
            {/* Avatar gagnant en grand */}
            <img
              src={hits[0]?.user?.avatar || '/default-avatar.png'}
              alt={pinata.joueur_gagnant_pseudo || 'Gagnant'}
              className="w-20 h-20 rounded-full object-cover border-4 border-amber-400 shadow-lg mb-2"
            />
            {/* Texte gagnant */}
            <div className="text-lg md:text-xl font-bold text-center text-amber-200 mb-1 mt-1">
              {pinata.joueur_gagnant_pseudo || 'Un joueur'} a explosé la piñata au {totalHits}<sup>e</sup> coup !
            </div>
            {/* Récompense */}
            {lastReward !== null && (
              <div className="text-base font-semibold text-green-400 flex items-center justify-center gap-2 mb-2">
                +{lastReward} narvals
                <span className="text-xl">🎁</span>
              </div>
            )}
            {/* Timer live jusqu'à minuit */}
            <div className="text-xs text-gray-300 mb-4">
              <LiveCountdown />
            </div>
            {/* Derniers participants (plus discret) */}
            <div className="mt-2 w-full">
              <div className="text-xs text-yellow-300 mb-1 text-center font-bold">Derniers participants</div>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {hits.map((hit, idx) => (
                  <div key={hit.id} className={`flex flex-col items-center min-w-[54px] bg-[#232B42] rounded-xl px-1.5 py-1.5 shadow ${idx === 0 ? 'border-2 border-amber-400' : ''}`}>
                    <img
                      src={hit.user?.avatar || '/default-avatar.png'}
                      alt={hit.user?.pseudo || 'Joueur'}
                      className="w-7 h-7 rounded-full object-cover border border-gray-700 mb-0.5"
                    />
                    <span className="font-semibold text-white text-[11px] truncate max-w-[40px]">
                      {userId && hit.user?.uid === userId ? 'Moi' : hit.user?.pseudo || 'Joueur'}
                    </span>
                    <span className="text-[9px] text-gray-400">
                      {new Date(hit.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    {idx === 0 && <span className="mt-0.5 px-1 py-0.5 rounded bg-amber-400 text-black text-[9px] font-bold">Dernier !</span>}
                  </div>
                ))}
              </div>
            </div>
            {/* CTA désactivé, plus petit et sur une ligne */}
            <button
              className="mt-6 px-4 py-2 rounded-lg text-base font-semibold bg-gray-700 text-gray-400 cursor-not-allowed w-auto"
              disabled
            >
              Reviens demain pour une nouvelle piñata !
            </button>
          </div>
        ) : pinata && (
          // --- Piñata normale ---
          <div>
            <div className="w-full flex justify-center mb-2 mt-2">
              <img
                src={
                  pinata.pv_restants === 0
                    ? "/pinata/pinata_broken.png"
                    : pinata.pv_restants / pinata.pv_total > 0.75
                    ? "/pinata/pinata_100.png"
                    : pinata.pv_restants / pinata.pv_total > 0.5
                    ? "/pinata/pinata_75.png"
                    : pinata.pv_restants / pinata.pv_total > 0.25
                    ? "/pinata/pinata_50.png"
                    : "/pinata/pinata_25.png"
                }
                alt="Piñata"
                className="w-44 h-44 object-contain select-none pointer-events-none drop-shadow-xl"
                draggable={false}
              />
            </div>
            <div className="mt-2 text-center text-base text-sky-200 font-semibold">
              Coup n° {totalHits} / ??
            </div>

            <button
              className={`mt-6 w-full py-4 rounded-xl text-xl font-bold transition-all ${
                hitAvailable
                  ? "bg-amber-400 text-black hover:bg-amber-300 active:scale-95 shadow-lg"
                  : "bg-gray-700 text-gray-400 cursor-not-allowed"
              }`}
              onClick={handleHit}
              disabled={!hitAvailable || hitLoading}
            >
              {hitLoading ? "..." : "Donner un coup"}
            </button>

            {!hitAvailable && (
              <div className="mt-2 text-sm text-yellow-300 text-center min-h-[1.5em]">
                {hitLoading ? 'Chargement…' : hitMsg}
              </div>
            )}

            {funnyMsg && (
              <div className="text-yellow-300 text-center mt-6 text-lg font-semibold drop-shadow animate-fade-in">
                {funnyMsg}
              </div>
            )}

            <div className="mt-8 w-full">
              <div className="text-sm text-yellow-300 mb-2 text-center font-bold">Derniers coups portés</div>
              <ul className="flex flex-col gap-2">
                {hits.map((hit, idx) => (
                  <li key={hit.id} className={`flex items-center gap-3 px-3 py-2 rounded-xl bg-[#232B42] shadow ${idx === 0 ? 'border-2 border-amber-400' : ''}`}>
                    <img
                      src={hit.user?.avatar || '/default-avatar.png'}
                      alt={hit.user?.pseudo || 'Joueur'}
                      className="w-8 h-8 rounded-full object-cover border border-gray-700"
                    />
                    <span className="font-semibold text-white">
                      {userId && hit.user?.uid === userId ? 'Moi' : hit.user?.pseudo || 'Joueur'}
                    </span>
                    <span className="text-xs text-gray-400 ml-2">
                      {new Date(hit.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    {idx === 0 && <span className="ml-auto px-2 py-1 rounded bg-amber-400 text-black text-xs font-bold">Dernier !</span>}
                    {userId && hit.user?.uid === userId && <span className="ml-2 px-2 py-1 rounded bg-cyan-600 text-white text-xs font-bold">Moi</span>}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

    </div>
  </div>
    </>
  );
}

