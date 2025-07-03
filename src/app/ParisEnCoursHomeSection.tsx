import { useEffect, useState, useRef } from "react";
import { useVictorySound } from "./VictorySoundProvider";
import { useLooseSound } from "./LooseSoundProvider";
import { supabase } from "@/utils/supabaseClient";
import BetAcceptCard from "./components/BetAcceptCard";

interface ParisEnCoursHomeSectionProps {
  userId: string;
  userPseudo: string;
  refresh?: () => void;
}

export default function ParisEnCoursHomeSection({ userId, userPseudo, refresh }: ParisEnCoursHomeSectionProps) {
  const playVictorySound = useVictorySound();
  const playLooseSound = useLooseSound();
  const audioRef = useRef<HTMLAudioElement>(null);

  // Définir le gagnant et distribuer les gains
  const handleSetWinner = async (pari: any, gagnantUid: string) => {
    setActionMsg(null);
    // 1. Récupérer le montant total (mise * 2)
    const montantTotal = (pari.montant || 0) * 2;
    // 2. Plus de taxe pot commun, tout va au gagnant
    const gainNet = montantTotal;
    // 3. Créditer le gagnant
    const { data: gagnantData, error: gagnantFetchError } = await supabase
      .from('users')
      .select('solde')
      .eq('uid', gagnantUid)
      .single();
    if (gagnantFetchError || !gagnantData) {
      setActionMsg("Erreur lors de la récupération du gagnant.");
      return;
    }
    const { error: gagnantUpdateError } = await supabase
      .from('users')
      .update({ solde: gagnantData.solde + gainNet })
      .eq('uid', gagnantUid);
    if (gagnantUpdateError) {
      setActionMsg("Erreur lors du versement des gains : " + gagnantUpdateError.message);
      return;
    }
    // 4. Plus de crédit pot commun
    // 5. Mettre à jour le pari
    await supabase
      .from('paris')
      .update({ statut: 'terminé', gagnant_uid: gagnantUid })
      .eq('id', pari.id);
    setActionMsg('Le gagnant a été défini et les gains distribués !');
  };

  // Annuler un pari en cours et rembourser les deux joueurs
  const handleAnnulerPariEnCours = async (pari: any) => {
    setActionMsg(null);
    // Rembourse joueur1
    if (pari.joueur1_uid) {
      const { data: user1, error: err1 } = await supabase.from('users').select('solde').eq('uid', pari.joueur1_uid).single();
      if (!err1 && user1) {
        await supabase.from('users').update({ solde: user1.solde + (pari.montant || 0) }).eq('uid', pari.joueur1_uid);
      }
    }
    // Rembourse joueur2
    if (pari.joueur2_uid) {
      const { data: user2, error: err2 } = await supabase.from('users').select('solde').eq('uid', pari.joueur2_uid).single();
      if (!err2 && user2) {
        await supabase.from('users').update({ solde: user2.solde + (pari.montant || 0) }).eq('uid', pari.joueur2_uid);
      }
    }
    // Supprime le pari
    await supabase.from('paris').delete().eq('id', pari.id);
    setActionMsg('Pari annulé et remboursé aux deux joueurs.');
  };
  const [bets, setBets] = useState<any[]>([]);
  const [actionMsg, setActionMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchBets = async () => {
      setLoading(true);
      const { data: bets } = await supabase
        .from("paris")
        .select("*, joueur1:joueur1_uid (pseudo, avatar), joueur2:joueur2_uid (pseudo, avatar)")
        .or(`joueur1_uid.eq.${userId},joueur2_uid.eq.${userId}`);
      // Ne garder que les statuts "en cours" ou "en attente de validation"
      const filteredBets = (bets || []).filter(
        (bet: any) => bet.statut === 'en cours' || bet.statut === 'en attente de validation'
      );
      setBets(filteredBets);
      setLoading(false);
    };
    fetchBets();
  }, [userId]);

  if (loading) return null;

  if (bets.length === 0) return <></>;

  return (
    <>
      <audio ref={audioRef} src="/pariaccept.mp3" preload="auto" />
      <div className="w-full max-w-[480px] mx-auto mt-8 font-inter">
      {actionMsg && (
        <div className="mb-3 text-center text-xs text-green-200 bg-green-900/60 rounded-xl p-3 shadow-lg border border-green-700 animate-fadeIn">
          {actionMsg}
        </div>
      )}
      <h2 className="text-2xl font-extrabold mb-4 text-cyan-300 tracking-tight drop-shadow-glow">Paris en cours</h2>
      <div className="flex flex-col gap-6">
        {bets.map((pari) => {
          const isJoueur1 = pari.joueur1_uid === userId;
          const isJoueur2 = pari.joueur2_uid === userId;
          const adversaire = isJoueur1 ? (pari.joueur2?.pseudo || "?") : (pari.joueur1?.pseudo || "?");
          const canSetWinner =
            pari.statut === "en cours" && (isJoueur1 || isJoueur2);

          // NOUVEAU : Bloc Acceptation pour joueur2
          if (isJoueur2 && (pari.statut === "en attente" || pari.statut === "en attente de validation")) {
            return (
              <BetAcceptCard
                key={pari.id}
                pari={pari}
                joueur1Pseudo={pari.joueur1?.pseudo || "Un joueur"}
                onAccept={async () => {
                  // Action d'acceptation réelle : update Supabase
                  // 1. Vérifie le solde des deux joueurs
                  const { data: user2 } = await supabase
                    .from("users")
                    .select("uid, solde")
                    .eq("uid", userId)
                    .single();
                  const { data: user1 } = await supabase
                    .from("users")
                    .select("uid, solde")
                    .eq("uid", pari.joueur1_uid)
                    .single();
                  if (!user2 || user2.solde < pari.montant) {
                    setActionMsg("Solde insuffisant pour accepter ce pari (toi).");
                    return;
                  }
                  if (!user1 || user1.solde < pari.montant) {
                    setActionMsg("Solde insuffisant pour l'autre joueur. Pari annulé.");
                    await supabase.from("paris").update({ statut: "annulé" }).eq("id", pari.id);
                    setBets(bets.filter(b => b.id !== pari.id));
                    return;
                  }
                  // Débite les DEUX joueurs
                  await supabase.from("users").update({ solde: user1.solde - pari.montant }).eq("uid", user1.uid);
                  await supabase.from("users").update({ solde: user2.solde - pari.montant }).eq("uid", user2.uid);
                  await supabase.from("paris").update({ statut: "en cours" }).eq("id", pari.id);
                  // Donne un coup piñata aux deux joueurs (user1 et user2)
                  const today = new Date().toISOString().slice(0, 10);
                  // Récupère la piñata active
                  const { data: pinataActive } = await supabase
                    .from('pinata')
                    .select('pinata_id')
                    .eq('statut', 'active')
                    .single();
                  if (pinataActive && pinataActive.pinata_id) {
                    const pinata_id = pinataActive.pinata_id;
                    // Pour chaque joueur du pari, on garantit la ligne user_daily_hit pour la nouvelle piñata active
                   for (const uid of [pari.joueur1_uid, pari.joueur2_uid]) {
                     // 1. Essaye d'abord un update
                     const { data: updateData, error: updateError, count } = await supabase
                       .from('user_daily_hit')
                       .update({ has_pari_accepted: true })
                       .eq('user_id', uid)
                       .eq('pinata_id', pinata_id)
                       .eq('date', today)
                       .select('user_id'); // pour avoir le count

                     if (updateError) console.error('[Update Piñata]', {uid, pinata_id, today, updateError});
                     if (!updateError && updateData && updateData.length > 0) {
                       console.log('[Update Piñata]', {uid, pinata_id, today});
                       setActionMsg(prev => (prev ? prev + '\n' : '') + `[Update Piñata] uid=${uid}, pinata_id=${pinata_id}, date=${today} => OK`);
                     } else {
                       // 2. Si aucune ligne mise à jour, fait un insert
                       const { error: insertError } = await supabase.from('user_daily_hit').insert({
                         user_id: uid,
                         pinata_id,
                         date: today,
                         has_pari_accepted: true
                       });
                       if (insertError) {
                         console.error('[Insert Piñata]', {uid, pinata_id, today, insertError});
                         setActionMsg(prev => (prev ? prev + '\n' : '') + `[Insert Piñata] uid=${uid}, pinata_id=${pinata_id}, date=${today} => ERREUR: ${insertError.message}`);
                       } else {
                         console.log('[Insert Piñata]', {uid, pinata_id, today});
                         setActionMsg(prev => (prev ? prev + '\n' : '') + `[Insert Piñata] uid=${uid}, pinata_id=${pinata_id}, date=${today} => OK`);
                       }
                     }
                   } 
                  }
                  // Met à jour localement le pari comme 'en cours' pour affichage immédiat
                  setBets(bets.map(b => b.id === pari.id ? { ...b, statut: "en cours" } : b));
                  setActionMsg("Pari accepté ! En attente de validation de l'admin.");
                  // Play sound after success
                  if (audioRef.current) {
                    audioRef.current.currentTime = 0;
                    audioRef.current.play().catch(() => {});
                  }
                }}
                onRefuse={async () => {
                  // Action de refus (à brancher sur la vraie logique si besoin)
                  setBets(bets.filter(b => b.id !== pari.id));
                }}
                actionMsg={""}
              />
            );
          }

          // Bloc classique sinon
          return (
            <div
              key={pari.id}
              className="relative group bg-gradient-to-br from-cyan-950/80 to-cyan-900/70 border border-cyan-700/60 rounded-2xl px-6 py-5 flex flex-col shadow-xl backdrop-blur-md transition-transform duration-200 hover:-translate-y-1 hover:shadow-cyan-600/30 animate-fadeIn"
              style={{ boxShadow: '0 6px 32px 0 rgba(0,255,255,0.08)' }}
            >
              {/* Ligne du haut avec avatar et pseudo adversaire */}
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-full border-2 border-cyan-400/50 shadow-cyan-400/10 shadow-lg flex items-center justify-center bg-gradient-to-br from-cyan-600/80 to-cyan-300/40 overflow-hidden">
                  {(() => {
                    const adversaireData = isJoueur1 ? pari.joueur2 : pari.joueur1;
                    if (adversaireData?.avatar) {
                      return (
                        <img
                          src={adversaireData.avatar}
                          alt={adversaireData.pseudo || 'Avatar'}
                          className="object-cover w-full h-full"
                          style={{ minWidth: 40, minHeight: 40 }}
                          onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                        />
                      );
                    } else {
                      return (
                        <span className="select-none text-cyan-100 text-lg font-bold">
                          {adversaire.slice(0,2).toUpperCase()}
                        </span>
                      );
                    }
                  })()}
                </div>
                <div className="flex-1">
                  <span className="font-semibold text-cyan-100 text-base tracking-wide">
                    {adversaire}
                  </span>
                  <span className="ml-2 px-2 py-0.5 rounded-full text-xs font-semibold bg-cyan-800/50 text-cyan-300 border border-cyan-400/20 align-middle shadow-cyan-400/10 shadow">
                    {isJoueur1 ? 'VS' : 'VS'}
                  </span>
                </div>
                <div className="flex flex-col items-end">
                  <span className="text-cyan-300 font-bold text-lg drop-shadow-cyan">₦{(pari.montant || 0) * 2}</span>
                  <span className="text-xs text-cyan-400/70 font-mono mt-0.5">Enjeu</span>
                </div>
              </div>
              {/* Description du pari */}
              <div className="text-cyan-100/90 text-[1.07rem] font-medium mb-2 italic pl-2 border-l-4 border-cyan-600/30">
                {pari.description}
              </div>
              {/* Statut badge */}
              <div className="mb-3">
                <span
                  className={`inline-block px-3 py-1 rounded-full text-xs font-bold tracking-wide shadow-cyan-400/10 shadow border border-cyan-700/30
                    ${pari.statut === 'en cours' ? 'bg-cyan-700/60 text-cyan-100' :
                      pari.statut === 'en attente de validation' ? 'bg-yellow-700/60 text-yellow-200' :
                      'bg-gray-800/70 text-gray-300'}
                  `}
                >
                  {pari.statut === 'en cours' ? 'En cours' :
                   pari.statut === 'en attente de validation' ? 'En attente de validation' : pari.statut}
                </span>
              </div>
              {/* Actions selon le statut */}
              {['en attente', 'en attente de validation'].includes(pari.statut) && (
                <button
                  className="relative group/button bg-gradient-to-r from-red-700/80 to-red-800/60 hover:from-red-600 hover:to-red-700 text-white font-bold py-2 px-5 rounded-full shadow-md shadow-red-900/20 border border-red-400/20 focus:outline-none focus:ring-2 focus:ring-red-400/80 transition-all duration-150 active:scale-95 select-none flex items-center gap-2 backdrop-blur-xl"
                  title="Annuler ce pari et récupérer la mise"
                  onClick={async () => {
                      setLoading(true);
                      setActionMsg(null);
                      // 1. Récupère le solde actuel
                      const { data: userData, error: fetchError } = await supabase
                        .from('users')
                        .select('solde')
                        .eq('uid', userId)
                        .single();
                      if (fetchError || !userData) {
                        setActionMsg("Erreur lors de la récupération du solde utilisateur.");
                        setLoading(false);
                        return;
                      }
                      // 2. Créditer la mise
                      const newSolde = userData.solde + (pari.montant || 0);
                      const { error: updateError } = await supabase
                        .from('users')
                        .update({ solde: newSolde })
                        .eq('uid', userId);
                      if (updateError) {
                        setActionMsg("Erreur lors du remboursement : " + updateError.message);
                        setLoading(false);
                        return;
                      }
                      // 3. Supprimer le pari
                      const { error } = await supabase.from('paris').delete().eq('id', pari.id);
                      if (!error) {
                        setActionMsg('Pari annulé et mise récupérée !');
                        setBets(bets.filter((bet) => bet.id !== pari.id));
                      } else {
                        setActionMsg("Erreur lors de l'annulation : " + error.message);
                      }
                      setLoading(false);
                    }}
                >
                  Annuler & récupérer la mise
                </button>
              )}
              {/* Définir le gagnant pour les paris en cours */}
              {pari.statut === 'en cours' && (
                <div className="mt-3 flex flex-col gap-2">
                  {!pari.showWinnerChoice ? (
                    <button
                      className="relative group/button bg-gradient-to-r from-green-700/80 to-cyan-700/60 hover:from-green-600 hover:to-cyan-600 text-white font-bold py-2 px-6 rounded-full shadow-md shadow-cyan-900/20 border border-green-400/20 focus:outline-none focus:ring-2 focus:ring-cyan-400/80 transition-all duration-150 active:scale-95 select-none flex items-center gap-2 backdrop-blur-xl"
                      title="Définir le gagnant de ce pari"
                      onClick={() => {
                        setBets(bets.map(b => b.id === pari.id ? { ...b, showWinnerChoice: true } : b));
                      }}
                    >
                      <span className="material-symbols-rounded text-xl mr-1">emoji_events</span>
                      Définir le gagnant
                    </button>
                  ) : (
                    <div className="flex flex-row gap-3 mt-2">
                      <button
                        className="relative group/button bg-gradient-to-r from-blue-700/80 to-cyan-700/60 hover:from-blue-600 hover:to-cyan-600 text-white font-bold py-2 px-5 rounded-full shadow-md shadow-cyan-900/20 border border-blue-400/20 focus:outline-none focus:ring-2 focus:ring-blue-400/80 transition-all duration-150 active:scale-95 select-none flex items-center gap-2 backdrop-blur-xl"
                        title="Je suis le gagnant"
                        onClick={async () => {
                          setLoading(true);
                          setActionMsg(null);
                          // Joue le son immédiatement pour garantir le user gesture
                          playVictorySound();
                          await handleSetWinner(pari, userId);
                          setBets(bets.filter(b => b.id !== pari.id)); // Retire la carte après victoire
                          setLoading(false);
                        }}
                      >
                        <span className="material-symbols-rounded text-lg">person</span> Moi
                      </button>
                      <button
                        className="relative group/button bg-gradient-to-r from-purple-700/80 to-cyan-700/60 hover:from-purple-600 hover:to-cyan-600 text-white font-bold py-2 px-5 rounded-full shadow-md shadow-cyan-900/20 border border-purple-400/20 focus:outline-none focus:ring-2 focus:ring-purple-400/80 transition-all duration-150 active:scale-95 select-none flex items-center gap-2 backdrop-blur-xl"
                        title="L'adversaire est le gagnant"
                        onClick={async () => {
                          setLoading(true);
                          setActionMsg(null);
                          const adversaireId = pari.joueur1_uid === userId ? pari.joueur2_uid : pari.joueur1_uid;
                          playLooseSound();
                          await handleSetWinner(pari, adversaireId);
                          setBets(bets.filter(b => b.id !== pari.id));
                          setLoading(false);
                        }}
                      >
                        <span className="material-symbols-rounded text-lg">person</span> {pari.joueur1_uid === userId ? (pari.joueur2?.pseudo || 'Adversaire') : (pari.joueur1?.pseudo || 'Adversaire')}
                      </button>
                      <button
                        className="relative group/button bg-gradient-to-r from-red-700/80 to-red-800/60 hover:from-red-600 hover:to-red-700 text-white font-bold py-2 px-5 rounded-full shadow-md shadow-red-900/20 border border-red-400/20 focus:outline-none focus:ring-2 focus:ring-red-400/80 transition-all duration-150 active:scale-95 select-none flex items-center gap-2 backdrop-blur-xl"
                        title="Annuler le pari (remboursement)"
                        onClick={async () => {
                          setLoading(true);
                          setActionMsg(null);
                          await handleAnnulerPariEnCours(pari);
                          setBets(bets.filter(b => b.id !== pari.id));
                          setLoading(false);
                        }}
                      >
                        <span className="material-symbols-rounded text-lg">close</span> Annuler le pari
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
    </>
  );
}
