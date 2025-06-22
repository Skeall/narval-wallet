"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/utils/supabaseClient";

interface User {
  uid: string;
  pseudo: string;
  solde: number;
}

export default function PariPage() {
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

  // Gestion du formulaire
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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
    // Créer la transaction (historique)
    const { error: txError } = await supabase.from("transactions").insert([
      {
        type: "pari",
        from: currentUser.uid,
        to: selectedOpponent,
        montant,
        description: description
          ? `Sujet : ${description}`
          : `Pari lancé entre ${currentUser.pseudo} et ${users.find(u => u.uid === selectedOpponent)?.pseudo}`,
        date: new Date().toISOString(),
      },
    ]);
    // Créer l'entrée dans la table "paris"
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
    // Plus de débit ici : le solde du joueur 1 reste inchangé tant que le pari n'est pas accepté
    if (txError || pariError) {
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
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-900">
      <div className="bg-gray-800 rounded-lg p-8 shadow-md w-full max-w-md mt-12">
        <h1 className="text-2xl font-bold text-center text-cyan-400 mb-6">Lancer un pari</h1>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
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
          <input
            type="number"
            className="p-2 rounded bg-gray-700 text-gray-100"
            value={montant}
            min={1}
            onChange={e => setMontant(Number(e.target.value))}
            required
          />
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
            type="submit"
            className="bg-cyan-500 hover:bg-cyan-600 text-white font-bold py-2 px-4 rounded mt-4 disabled:opacity-50"
            disabled={loading}
          >
            {loading ? "Patiente..." : "Lancer le pari"}
          </button>
        </form>
        {message && <div className="mt-6 text-center text-cyan-300">{message}</div>}
      </div>
    </div>
  );
}
