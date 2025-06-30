"use client";
import { useEffect, useState } from "react";
import { usePariSound, PariSoundProvider } from "../PariSoundProvider";
import { useRouter } from "next/navigation";
import { supabase } from "@/utils/supabaseClient";

interface User {
  uid: string;
  pseudo: string;
  solde: number;
}

function PariPage() {
  const playPariSound = usePariSound();
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [currentUser, setCurrentUser] = useState<User|null>(null);
  const [selectedOpponent, setSelectedOpponent] = useState<string>("");
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
        .select("uid, pseudo, solde")
        .eq("uid", user.id)
        .single();
      setCurrentUser(userData);
      // Récupérer tous les autres users
      const { data: allUsers } = await supabase
        .from("users")
        .select("uid, pseudo, solde");
      setUsers((allUsers || []).filter((u: User) => u.uid !== user.id));
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
          <label className="text-gray-200">Adversaire</label>
          <select
            className="p-2 rounded bg-gray-700 text-gray-100"
            value={selectedOpponent}
            onChange={e => setSelectedOpponent(e.target.value)}
            required
          >
            <option value="">-- Choisir un joueur --</option>
            {users.map(u => (
              <option key={u.uid} value={u.uid}>{u.pseudo}</option>
            ))}
          </select>
          <label className="text-gray-200">Montant</label>
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
          <label className="flex items-center justify-between text-gray-200 mt-2">
            <span>📝 Sujet du pari / condition de victoire</span>
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
              // 4. Créer l'entrée dans la table "paris"
              const { error: pariError } = await supabase.from("paris").insert([
                {
                  joueur1_uid: currentUser.uid,
                  joueur2_uid: selectedOpponent,
                  montant,
                  statut: "en attente de validation",
                  gagnant_uid: null,
                  date: new Date().toISOString(),
                  ...(description ? { description: description.trim() } : {}),
                },
              ]);
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
              }
              setLoading(false);
            }}
          >
            {loading ? "Patiente..." : "Lancer le pari"}
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
