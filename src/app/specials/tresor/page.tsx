"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/utils/supabaseClient";

interface TresorGame {
  game_id: string;
  treasure_index: number;
  statut: "active" | "terminee";
  joueur_gagnant_id: string | null;
  joueur_gagnant_pseudo: string | null;
  reward: number | null;
  date_creation: string;
  date_fin: string | null;
}

interface TresorAttempt {
  id: string;
  game_id: string;
  user_id: string;
  cell_index: number;
  is_winner: boolean;
  attempted_at: string;
  user: {
    uid: string;
    pseudo: string;
    avatar: string | null;
  } | null;
}

interface DailyTresorStatus {
  user_id: string;
  date: string;
  has_pari_accepted: boolean;
  has_used_attempt: boolean;
}

interface WinnerPreview {
  pseudo: string;
  avatar: string | null;
  montant: number;
}

interface AttemptRow {
  id: string;
  game_id: string;
  user_id: string;
  cell_index: number;
  is_winner: boolean;
  attempted_at: string;
  user: { uid: string; pseudo: string; avatar: string | null } | { uid: string; pseudo: string; avatar: string | null }[] | null;
}

const GRID_SIZE = 16;

function randomTreasureIndex(): number {
  return Math.floor(Math.random() * GRID_SIZE);
}

export default function TresorPage() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [game, setGame] = useState<TresorGame | null>(null);
  const [attempts, setAttempts] = useState<TresorAttempt[]>([]);
  const [dailyStatus, setDailyStatus] = useState<DailyTresorStatus | null>(null);
  const [lastWinners, setLastWinners] = useState<WinnerPreview[]>([]);
  const [loading, setLoading] = useState(true);
  const [digLoading, setDigLoading] = useState(false);
  const [diggingCell, setDiggingCell] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<string>("");
  const [showWinGlow, setShowWinGlow] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const tresorAudioRef = useRef<HTMLAudioElement | null>(null);

  const today = new Date().toISOString().slice(0, 10);
  const mapBackgroundUrl = "/specials/carte.png";

  const attemptsByCell = useMemo(() => {
    const map = new Map<number, TresorAttempt>();
    for (const attempt of attempts) {
      map.set(attempt.cell_index, attempt);
    }
    return map;
  }, [attempts]);

  const canUseAttempt =
    !!userId && !!dailyStatus?.has_pari_accepted && !dailyStatus?.has_used_attempt && !!game && game.statut === "active";

  useEffect(() => {
    const audio = tresorAudioRef.current;
    if (!audio) return;

    // Audio d'ambiance du mini-jeu: boucle continue + volume réduit (10%).
    audio.loop = true;
    audio.volume = 0.1;
    audio.muted = isAudioMuted;

    audio
      .play()
      .then(() => {
        console.debug("[Tresor][Audio] started", { muted: isAudioMuted, volume: audio.volume });
      })
      .catch((error) => {
        console.debug("[Tresor][Audio] autoplay blocked", error);
      });
  }, []);

  useEffect(() => {
    const audio = tresorAudioRef.current;
    if (!audio) return;
    audio.muted = isAudioMuted;
    console.debug("[Tresor][Audio] mute toggled", { muted: isAudioMuted });
  }, [isAudioMuted]);

  const handleToggleAudio = async () => {
    const audio = tresorAudioRef.current;
    const nextMuted = !isAudioMuted;
    setIsAudioMuted(nextMuted);
    if (!audio) return;

    // En cas d'autoplay bloqué, une interaction utilisateur relance la lecture.
    if (!nextMuted) {
      try {
        await audio.play();
      } catch (error) {
        console.debug("[Tresor][Audio] play after unmute blocked", error);
      }
    }
  };

  const fetchLastWinners = async () => {
    const { data: games, error } = await supabase
      .from("tresor_games")
      .select("joueur_gagnant_id, joueur_gagnant_pseudo, reward")
      .eq("statut", "terminee")
      .order("date_fin", { ascending: false })
      .limit(3);

    if (error || !games) {
      console.debug("[Tresor] fetchLastWinners error", error);
      setLastWinners([]);
      return;
    }

    const winners: WinnerPreview[] = [];
    for (const item of games) {
      if (!item.joueur_gagnant_id || !item.reward) continue;
      const { data: userData } = await supabase
        .from("users")
        .select("avatar")
        .eq("uid", item.joueur_gagnant_id)
        .maybeSingle();
      winners.push({
        pseudo: item.joueur_gagnant_pseudo || "Joueur",
        avatar: userData?.avatar || null,
        montant: item.reward,
      });
    }

    setLastWinners(winners);
  };

  const ensureActiveGame = async (): Promise<TresorGame | null> => {
    const { data: activeGame, error } = await supabase
      .from("tresor_games")
      .select("*")
      .eq("statut", "active")
      .order("date_creation", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.debug("[Tresor] ensureActiveGame read error", error);
      return null;
    }

    if (activeGame) return activeGame as TresorGame;

    const { data: inserted, error: insertError } = await supabase
      .from("tresor_games")
      .insert({
        treasure_index: randomTreasureIndex(),
        statut: "active",
      })
      .select("*")
      .single();

    if (insertError) {
      console.error("[Tresor] ensureActiveGame insert error", insertError);
      return null;
    }

    console.debug("[Tresor] New active game created", inserted?.game_id);
    return inserted as TresorGame;
  };

  const fetchAttempts = async (gameId: string) => {
    const { data, error } = await supabase
      .from("tresor_attempts")
      .select("id, game_id, user_id, cell_index, is_winner, attempted_at, user:user_id (uid, pseudo, avatar)")
      .eq("game_id", gameId)
      .order("attempted_at", { ascending: true });

    if (error || !data) {
      console.debug("[Tresor] fetchAttempts error", error);
      setAttempts([]);
      return;
    }

    const mapped = (data as AttemptRow[]).map((row) => ({
      ...row,
      user: Array.isArray(row.user) ? row.user[0] : row.user,
    }));
    setAttempts(mapped as TresorAttempt[]);
  };

  const fetchDailyStatus = async (uid: string) => {
    const { data, error } = await supabase
      .from("user_daily_tresor_attempt")
      .select("user_id, date, has_pari_accepted, has_used_attempt")
      .eq("user_id", uid)
      .eq("date", today)
      .maybeSingle();

    if (error) {
      console.debug("[Tresor] fetchDailyStatus error", error);
      setDailyStatus(null);
      return;
    }

    setDailyStatus((data as DailyTresorStatus | null) || null);
  };

  const refreshAll = async (uid?: string | null) => {
    const activeGame = await ensureActiveGame();
    setGame(activeGame);

    if (activeGame?.game_id) {
      await fetchAttempts(activeGame.game_id);
    } else {
      setAttempts([]);
    }

    if (uid) {
      await fetchDailyStatus(uid);
    }

    await fetchLastWinners();
  };

  useEffect(() => {
    let mounted = true;

    const bootstrap = async () => {
      setLoading(true);
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!mounted) return;

      setUserId(user?.id || null);
      await refreshAll(user?.id || null);
      setLoading(false);
    };

    bootstrap();

    const interval = setInterval(async () => {
      if (!mounted) return;
      await refreshAll(userId);
    }, 12000);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
    // userId intentionally included so polling refreshes proper daily status after auth changes
  }, [userId]);

  async function handleDig(cellIndex: number) {
    if (!userId || !game || !canUseAttempt || digLoading) return;

    if (attemptsByCell.has(cellIndex)) {
      setFeedback("Cette case est déjà creusée.");
      return;
    }

    setDiggingCell(cellIndex);
    setDigLoading(true);
    setFeedback("Tu creuses...");

    // Petite latence volontaire pour créer le suspense visuel.
    await new Promise((resolve) => setTimeout(resolve, 650));

    const isWinner = game.treasure_index === cellIndex;

    const { error: insertAttemptError } = await supabase.from("tresor_attempts").insert({
      game_id: game.game_id,
      user_id: userId,
      cell_index: cellIndex,
      is_winner: isWinner,
    });

    if (insertAttemptError) {
      console.error("[Tresor] insert attempt error", insertAttemptError);
      setFeedback("Cette case vient d'être prise par un autre joueur.");
      await refreshAll(userId);
      setDigLoading(false);
      setDiggingCell(null);
      return;
    }

    const { error: updateDailyError } = await supabase
      .from("user_daily_tresor_attempt")
      .update({ has_used_attempt: true })
      .eq("user_id", userId)
      .eq("date", today);

    if (updateDailyError) {
      console.error("[Tresor] update daily usage error", updateDailyError);
    }

    if (!isWinner) {
      setFeedback("Le trésor n’est pas ici...");
      const audio = new Audio("/sounds/hit1.mp3");
      audio.volume = 0.25;
      audio.play().catch(() => {});
      await refreshAll(userId);
      setDigLoading(false);
      setDiggingCell(null);
      return;
    }

    const reward = Math.floor(Math.random() * 6) + 3;

    const { data: gameUpdatedRows, error: gameUpdateError } = await supabase
      .from("tresor_games")
      .update({
        statut: "terminee",
        joueur_gagnant_id: userId,
        joueur_gagnant_pseudo: "Joueur",
        reward,
        date_fin: new Date().toISOString(),
      })
      .eq("game_id", game.game_id)
      .eq("statut", "active")
      .is("joueur_gagnant_id", null)
      .select("game_id");

    if (gameUpdateError || !gameUpdatedRows || gameUpdatedRows.length === 0) {
      console.debug("[Tresor] winner update skipped", gameUpdateError);
      setFeedback("Le trésor a déjà été trouvé juste avant toi.");
      await refreshAll(userId);
      setDigLoading(false);
      setDiggingCell(null);
      return;
    }

    const { data: profile } = await supabase
      .from("users")
      .select("pseudo, solde")
      .eq("uid", userId)
      .single();

    if (profile) {
      await supabase
        .from("users")
        .update({ solde: (profile.solde || 0) + reward })
        .eq("uid", userId);

      await supabase.from("tresor_games").update({ joueur_gagnant_pseudo: profile.pseudo || "Joueur" }).eq("game_id", game.game_id);

      await supabase.from("transactions").insert({
        type: "tresor",
        from: null,
        to: userId,
        montant: reward,
        description: `Récompense Chasse au Trésor (+${reward} narvals)`,
        date: new Date().toISOString(),
      });
    }

    const { error: newGameError } = await supabase.from("tresor_games").insert({
      treasure_index: randomTreasureIndex(),
      statut: "active",
    });

    if (newGameError) {
      console.debug("[Tresor] new game insert skipped", newGameError);
    }

    setShowWinGlow(true);
    setTimeout(() => setShowWinGlow(false), 2200);
    setFeedback(`Trésor trouvé ! +${reward} Narvals`);

    await refreshAll(userId);
    setDigLoading(false);
    setDiggingCell(null);
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#1c2436] via-[#222f47] to-[#101722] text-white px-3 py-6 flex flex-col items-center">
      <audio ref={tresorAudioRef} src="/tresor.mp3" preload="auto" />

      <button
        onClick={handleToggleAudio}
        className="fixed left-3 bottom-3 z-30 rounded-full bg-black/35 hover:bg-black/55 border border-white/20 px-3 py-1.5 text-xs text-white/85 backdrop-blur-sm transition"
        aria-label={isAudioMuted ? "Activer le son d'ambiance" : "Couper le son d'ambiance"}
      >
        {isAudioMuted ? "🔇" : "🔊"}
      </button>

      <div className="w-full max-w-md relative">
        <button
          onClick={() => router.push("/specials")}
          className="absolute -top-1 left-0 z-20 bg-slate-700/80 hover:bg-slate-600/90 rounded-full p-2 shadow"
          aria-label="Retour"
        >
          ←
        </button>

        <button
          onClick={() => setShowInfo(true)}
          className="absolute -top-1 right-0 z-20 bg-slate-700/80 hover:bg-slate-600/90 rounded-full p-2 shadow"
          aria-label="Règles du mini-jeu"
        >
          ℹ️
        </button>

        {showInfo && (
          <div className="fixed inset-0 z-40 bg-black/90 flex items-center justify-center">
            <button
              onClick={() => setShowInfo(false)}
              className="fixed top-4 right-4 text-gray-200 hover:text-white z-50 bg-slate-800/70 rounded-full p-2"
              aria-label="Fermer"
              style={{ backdropFilter: "blur(4px)" }}
            >
              ✕
            </button>
            <img
              src="/regletresor.png"
              alt="Règles du mini-jeu Trésor"
              className="max-w-[100vw] max-h-[100vh] w-auto h-auto object-contain mx-auto"
              style={{ boxShadow: "0 0 40px #000a" }}
            />
          </div>
        )}

        <h1 className="text-center text-2xl font-extrabold text-amber-300 mb-2">🏴‍☠️ Chasse au Trésor</h1>
        <p className="text-center text-sm text-amber-100/80 mb-5">1 tentative par jour débloquée au premier pari accepté.</p>

        <div
          className={`relative rounded-2xl border border-[#5d6f8d] p-4 shadow-xl overflow-hidden ${showWinGlow ? "ring-2 ring-amber-300" : ""}`}
          style={{
            // Image de fond de la carte au trésor (à déposer dans /public/specials)
            backgroundImage: `url(${mapBackgroundUrl})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        >
          <div className="absolute inset-0 bg-[#0b1320]/10 pointer-events-none" />
          <div className="relative z-10">
          {loading ? (
            <div className="text-center text-gray-300 py-12">Chargement de la carte...</div>
          ) : (
            <>
              <div className="mb-3 text-sm text-center text-cyan-100">
                Cases restantes : <span className="font-bold text-amber-300">{GRID_SIZE - attempts.length}</span>
              </div>

              <div className="grid grid-cols-4 gap-2">
                {Array.from({ length: GRID_SIZE }).map((_, index) => {
                  const attempt = attemptsByCell.get(index);
                  const isBlocked = !!attempt;
                  const isDigging = diggingCell === index;

                  return (
                    <button
                      key={index}
                      onClick={() => handleDig(index)}
                      disabled={isBlocked || !canUseAttempt || digLoading}
                      className={`relative aspect-square rounded-xl border transition-all duration-200 overflow-hidden ${
                        isBlocked
                          ? "border-[#8b97ac]/70 bg-[#2f3a4f]/20"
                          : "border-amber-100/80 bg-gradient-to-b from-[#f3dbb8]/16 to-[#d5ab7a]/12 hover:scale-[1.02]"
                      } ${isDigging ? "animate-pulse" : ""}`}
                    >
                      {isDigging && !isBlocked && <span className="text-lg">⛏️</span>}

                      {attempt?.user && (
                        <img
                          src={attempt.user.avatar || "/default-avatar.png"}
                          alt={attempt.user.pseudo}
                          className={`absolute inset-0 w-full h-full object-cover ${attempt.is_winner ? "" : "grayscale"}`}
                        />
                      )}

                      {isBlocked && !attempt?.is_winner && (
                        <span className="absolute bottom-1 right-1 text-[10px] text-gray-200">✖</span>
                      )}

                      {isBlocked && attempt?.is_winner && (
                        <span className="absolute inset-0 flex items-center justify-center text-xl">💰</span>
                      )}
                    </button>
                  );
                })}
              </div>

              <div className="mt-4 min-h-[22px] text-center text-sm text-amber-100">{feedback}</div>

              <div className="mt-2 text-center text-xs text-cyan-200/90">
                {!userId && "Connecte-toi pour jouer."}
                {userId && !dailyStatus?.has_pari_accepted && "Accepte ton premier pari du jour pour débloquer la tentative."}
                {userId && dailyStatus?.has_pari_accepted && !dailyStatus?.has_used_attempt && "Tentative disponible aujourd’hui."}
                {userId && dailyStatus?.has_used_attempt && "Tentative déjà utilisée aujourd’hui."}
              </div>
            </>
          )}
          </div>
        </div>

        {lastWinners.length > 0 && (
          <div className="mt-4 rounded-2xl border border-amber-400/20 bg-[#151d2d]/80 p-3">
            <div className="text-xs text-amber-300 font-bold text-center mb-2">Derniers découvreurs</div>
            <div className="flex items-end justify-center gap-3">
              {lastWinners.map((winner, idx) => (
                <div key={`${winner.pseudo}-${idx}`} className="flex flex-col items-center">
                  <img
                    src={winner.avatar || "/default-avatar.png"}
                    alt={winner.pseudo}
                    className="w-9 h-9 rounded-full object-cover border border-amber-200/40"
                  />
                  <span className="text-[11px] text-gray-200 mt-1 max-w-[66px] truncate">{winner.pseudo}</span>
                  <span className="text-[11px] text-emerald-300">+{winner.montant}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
