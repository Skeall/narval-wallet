"use client";
import { useEffect, useState } from "react";
import { usePariSound, PariSoundProvider } from "../PariSoundProvider";
import { useRouter } from "next/navigation";
import { supabase } from "@/utils/supabaseClient";
import { grantXp } from "../xp/xpService";
import { XP_VALUES } from "../xp/xpRules";
import { sendNotificationToUser } from "@/utils/notifications";

interface User {
  uid: string;
  pseudo: string;
  solde: number;
  // optional URL/path to avatar image in DB
  avatar?: string;
}

function PariPage() {
  const playPariSound = usePariSound();
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [currentUser, setCurrentUser] = useState<User|null>(null);
  const [selectedOpponent, setSelectedOpponent] = useState<string>("");
  // debug: track recent opponents for quick selection (last 4 unique)
  const [recentOpponents, setRecentOpponents] = useState<User[]>([]);
  // debug: toggle full selector (dropdown) when clicking "+"
  const [showFullSelector, setShowFullSelector] = useState<boolean>(false);
  // debug: simple pulse animation flag per selected uid
  const [selectedPulseUid, setSelectedPulseUid] = useState<string>("");
  const [montant, setMontant] = useState(0);
  const [description, setDescription] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  // Récupérer l'utilisateur connecté et la liste des autres joueurs
  useEffect(() => {
    const fetchUsers = async () => {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }
      // Récupérer infos user connecté
      const { data: userData } = await supabase
        .from("users")
        .select("uid, pseudo, solde, avatar")
        .eq("uid", user.id)
        .single();
      setCurrentUser(userData);
      // Récupérer tous les autres users
      const { data: allUsers } = await supabase
        .from("users")
        .select("uid, pseudo, solde, avatar");
      const allOtherUsers: User[] = (allUsers || []).filter((u: User) => u.uid !== user.id);
      setUsers(allOtherUsers);

      // debug log
      console.debug("[Pari] currentUser:", userData);
      console.debug("[Pari] allOtherUsers count:", allOtherUsers.length);

      // Récupérer les 4 derniers adversaires uniques depuis la table "paris"
      try {
        const { data: recentBets, error: recentErr } = await supabase
          .from("paris")
          .select("joueur1_uid, joueur2_uid, date")
          .or(`joueur1_uid.eq.${user.id},joueur2_uid.eq.${user.id}`)
          .order("date", { ascending: false })
          .limit(20); // sécurité: on prend jusqu'à 20 derniers paris pour en extraire 4 uniques
        if (recentErr) {
          console.debug("[Pari] recent opponents fetch error:", recentErr.message);
        }
        const uniques: string[] = [];
        (recentBets || []).forEach((row: any) => {
          const otherUid = row.joueur1_uid === user.id ? row.joueur2_uid : row.joueur1_uid;
          if (otherUid && !uniques.includes(otherUid)) {
            uniques.push(otherUid);
          }
        });
        const recentUsers = uniques
          .map((uid) => allOtherUsers.find((u) => u.uid === uid))
          .filter((u): u is User => Boolean(u))
          .slice(0, 4);
        setRecentOpponents(recentUsers);
        console.debug("[Pari] recentOpponents:", recentUsers.map((u) => u.pseudo));
      } catch (e) {
        console.debug("[Pari] recent opponents exception:", e);
      }
      setLoading(false);
    };
    fetchUsers();
  }, []);

  

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-900 relative">
      {/* Bouton retour mobile friendly */}
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
      <div className="bg-gray-800 rounded-lg p-8 shadow-md w-full max-w-md mt-12">
        <h1 className="text-2xl font-bold text-center text-cyan-400 mb-6">Lancer un pari</h1>
        <form className="flex flex-col gap-4">
          {/* Nouveau label fun (remplace l'ancien champ Adversaire + select) */}
          <div className="text-gray-200 text-base font-medium">Tu veux défier qui ? 👇</div>

          {/* Rangée d'avatars: 4 derniers adversaires + bouton "+" */}
          <div className="flex items-center justify-center gap-4 mt-1">
            {/* Cas avec adversaires récents */}
            {recentOpponents.length > 0 && (
              recentOpponents.map((u) => {
                const isSelected = selectedOpponent === u.uid;
                return (
                  <button
                    key={u.uid}
                    type="button"
                    title={u.pseudo}
                    onClick={() => {
                      console.debug("[Pari] avatar clicked:", u.uid, u.pseudo);
                      setSelectedOpponent(u.uid);
                      setShowFullSelector(false);
                      setSelectedPulseUid(u.uid);
                      // petit pulse temporaire
                      setTimeout(() => setSelectedPulseUid(""), 300);
                    }}
                    className={
                      `relative w-14 h-14 rounded-full overflow-hidden bg-gradient-to-br from-slate-600 to-slate-700 text-cyan-200 flex items-center justify-center ` +
                      `hover:from-slate-500 hover:to-slate-600 transition transform ` +
                      (isSelected ? " ring-2 ring-cyan-400 scale-105 " : "") +
                      (selectedPulseUid === u.uid ? " animate-pulse " : "")
                    }
                    aria-label={`Choisir ${u.pseudo}`}
                  >
                    {/* Affiche l'avatar si disponible, sinon fallback initiale */}
                    {u.avatar ? (
                      <img
                        src={u.avatar}
                        alt={`Avatar de ${u.pseudo}`}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="text-lg font-bold">
                        {u.pseudo?.charAt(0)?.toUpperCase() || "?"}
                      </span>
                    )}
                  </button>
                );
              })
            )}

            {/* Bouton + pour ouvrir le sélecteur complet */}
            <button
              type="button"
              title="Choisir un autre joueur"
              onClick={() => {
                console.debug("[Pari] plus clicked: open full selector");
                setShowFullSelector((v) => !v);
              }}
              className="w-14 h-14 rounded-full border-2 border-cyan-400 text-cyan-400 flex items-center justify-center hover:bg-cyan-500/10 transition"
              aria-label="Ouvrir le sélecteur complet"
            >
              <span className="text-2xl font-bold">+</span>
            </button>
          </div>

          {/* Afficher le pseudo sélectionné sous la rangée d'avatars */}
          {selectedOpponent && (
            <div className="text-center text-cyan-300 text-sm -mt-1">
              {users.find((u) => u.uid === selectedOpponent)?.pseudo}
            </div>
          )}

          {/* Si 0..4 adversaires récents: le layout ci-dessus reste centré par défaut */}

          {/* Sélecteur complet (dropdown original) - visible uniquement après clic "+" */}
          {showFullSelector && (
            <select
              className="p-2 rounded bg-gray-700 text-gray-100"
              value={selectedOpponent}
              onChange={e => {
                console.debug("[Pari] selected from full selector:", e.target.value);
                setSelectedOpponent(e.target.value);
              }}
              required
            >
              <option value="">-- Choisir un joueur --</option>
              {users.map(u => (
                <option key={u.uid} value={u.uid}>{u.pseudo}</option>
              ))}
            </select>
          )}
          {/* UI text: updated label per request */}
          <label className="text-gray-200">Tu mises combien ?</label>
          <div className="flex flex-col items-center gap-2 mb-2">
            <div className="text-3xl font-bold text-cyan-300 mb-2">₦{montant}</div>
            <div className="flex items-center w-full gap-2">
              <button
                type="button"
                className="bg-gray-700 text-cyan-400 rounded-full w-8 h-8 flex items-center justify-center text-xl hover:bg-gray-600"
                onClick={() => setMontant(m => Math.max(1, m - 1))}
                aria-label="Diminuer"
              >-</button>
              <input
                type="range"
                min={1}
                max={currentUser ? currentUser.solde : 100}
                value={montant}
                onChange={e => setMontant(Number(e.target.value))}
                className="flex-1 accent-cyan-400"
              />
              <button
                type="button"
                className="bg-gray-700 text-cyan-400 rounded-full w-8 h-8 flex items-center justify-center text-xl hover:bg-gray-600"
                onClick={() => setMontant(m => Math.min(currentUser ? currentUser.solde : 100, m + 1))}
                aria-label="Augmenter"
              >+</button>
            </div>
            <div className="text-xs text-gray-400">Max : ₦{currentUser ? currentUser.solde : 100}</div>
          </div>
          {/* UI text: updated textarea label per request */}
          <label className="flex items-center justify-between text-gray-200 mt-2">
            <span>Sur quoi vous misez ? 🎯</span>
            <span className="ml-2 bg-gray-600 text-xs text-gray-200 px-2 py-0.5 rounded-full">facultatif</span>
          </label>
          <textarea
            className="p-2 rounded bg-gray-700 text-gray-100 resize-none"
            placeholder="Ex : Celui qui gagne le bière pong"
            maxLength={140}
            value={description}
            onChange={e => setDescription(e.target.value)}
            rows={2}
            style={{ fontSize: '0.95rem' }}
          />
          <div className="text-right text-xs text-gray-400 mb-[-0.5rem]">{description.length}/140</div>
          {/* UI text: updated submit button per request */}
          <button
            type="button"
            className="bg-cyan-500 hover:bg-cyan-600 text-white font-bold py-2 px-4 rounded mt-4 disabled:opacity-50"
            disabled={loading}
            onClick={async () => {
              playPariSound();
              setMessage("");
              if (!currentUser) return;
              if (!selectedOpponent) {
                setMessage("Choisissez un adversaire.");
                return;
              }
              if (!Number.isInteger(montant) || montant <= 0) {
                setMessage("Le montant doit être un entier positif.");
                return;
              }
              if (montant > currentUser.solde) {
                setMessage("Montant supérieur à votre solde.");
                return;
              }
              setLoading(true);
              // 1. Vérifier le solde à jour (déjà fait plus haut, mais re-vérification côté BDD possible en production)
              // 2. Débiter la mise du solde du joueur 1
              const { error: soldeError } = await supabase
                .from("users")
                .update({ solde: currentUser.solde - montant })
                .eq("uid", currentUser.uid);
              if (soldeError) {
                setMessage("Erreur lors du débit de la mise: " + soldeError.message);
                setLoading(false);
                return;
              }
              // 3. Insérer la transaction négative (historique)
              const { error: txError } = await supabase.from("transactions").insert([
                {
                  type: "pari",
                  from: currentUser.uid,
                  to: selectedOpponent,
                  montant: -montant,
                  description: description
                    ? `Sujet : ${description}`
                    : `Pari lancé entre ${currentUser.pseudo} et ${users.find(u => u.uid === selectedOpponent)?.pseudo}`,
                  date: new Date().toISOString(),
                },
              ]);
              // 4. Créer l'entrée dans la table "paris" (on récupère l'id pour la dédup XP)
              const { data: pariRows, error: pariError } = await supabase
                .from("paris")
                .insert([
                  {
                    joueur1_uid: currentUser.uid,
                    joueur2_uid: selectedOpponent,
                    montant,
                    statut: "en attente de validation",
                    gagnant_uid: null,
                    date: new Date().toISOString(),
                    ...(description ? { description: description.trim() } : {}),
                  },
                ])
                .select("id")
                .limit(1);
              // Rollback si erreur transaction ou pari (remet le solde si erreur)
              if (txError || pariError) {
                // Rembourse le solde si une des deux opérations a échoué
                await supabase.from("users").update({ solde: currentUser.solde }).eq("uid", currentUser.uid);
                setMessage(
                  "Erreur lors de la création du pari: " +
                  (txError?.message || pariError?.message || "Veuillez réessayer.")
                );
              } else {
                setMessage(`Pari lancé avec ${users.find(u => u.uid === selectedOpponent)?.pseudo} pour ₦${montant}` + (description ? `\n📝 Sujet : ${description}` : "") + ". En attente de réponse ou de validation.");
                setMontant(0);
                setSelectedOpponent("");
                setDescription("");
                // XP: création de pari (+5) – idempotent via dedupe
                try {
                  const betId = (pariRows && pariRows[0] && pariRows[0].id) || null;
                  const dedupe = betId ? `BETC:${betId}` : `BETC:${currentUser.uid}:${selectedOpponent}:${montant}:${new Date().toISOString().slice(0,10)}`;
                  console.debug('[XP][Pari][Create] grant +', XP_VALUES.BET_CREATED, { betId, dedupe });
                  await grantXp(currentUser.uid, 'BET_CREATED', XP_VALUES.BET_CREATED, { betId, montant, opponent: selectedOpponent }, dedupe);
                } catch (e) {
                  console.debug('[XP][Pari][Create] error', e);
                }
                // debug: Push notification à l'adversaire
                try {
                  const opponentPseudo = users.find(u => u.uid === selectedOpponent)?.pseudo || 'Quelqu\'un';
                  console.debug('[Push][Pari][Create] Notifying opponent:', selectedOpponent);
                  await sendNotificationToUser(
                    selectedOpponent,
                    `${currentUser.pseudo} te défie ! 🎯`,
                    `Pari de ₦${montant}${description ? ` — ${description}` : ''}`,
                    '/',
                    'pari-nouveau'
                  );
                } catch (e) {
                  console.debug('[Push][Pari][Create] notification error', e);
                }
              }
              setLoading(false);
            }}
          >
            {loading ? "Patiente..." : "Que le meilleur gagne ! 🔥"}
          </button>
        </form>
        {message && <div className="mt-6 text-center text-cyan-300">{message}</div>}
      </div>
    </div>
  );
}

export default function PariPageWithProvider() {
  return (
    <PariSoundProvider>
      <PariPage />
    </PariSoundProvider>
  );
}
