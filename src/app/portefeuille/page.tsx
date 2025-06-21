"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/utils/supabaseClient";


// Types
interface UserJoin {
  pseudo?: string | null;
}
interface Transaction {
  id: string;
  type: "don" | "transfert" | "pari" | "impôt" | "enchère";
  from: string | null;
  to: string | null;
  to_label?: string | null;
  montant: number;
  description?: string;
  date: string;
  from_pseudo?: string | null;
  to_pseudo?: string | null;
}

interface User {
  UID: string;
  pseudo: string;
}

const typeLabels: Record<string, string> = {
  don: "Don",
  transfert: "Transfert",
  pari: "Pari",
  "impôt": "Impôt",
  "enchère": "Enchère",
};

const badgeColors: Record<string, string> = {
  don: "bg-blue-700 text-blue-200",
  transfert: "bg-green-700 text-green-200",
  pari: "bg-purple-700 text-purple-200",
  impôt: "bg-red-700 text-red-200",
  enchère: "bg-yellow-700 text-yellow-200",
};

export default function PortefeuillePage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [user, setUser] = useState<User|null>(null);
  const [solde, setSolde] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        // 1. Récupérer l'utilisateur connecté
        const { data: { user: authUser } } = await supabase.auth.getUser();
        if (!authUser) {
          setLoading(false);
          return;
        }
        const userUID = authUser.id;
        // 2. Récupérer le profil user (pour le pseudo et solde)
        const { data: userData } = await supabase
          .from("users")
          .select("UID, pseudo, solde")
          .eq("UID", userUID)
          .single();
        if (!userData) {
          setLoading(false);
          return;
        }
        setUser({ UID: userData.UID, pseudo: userData.pseudo });
        setSolde(userData.solde);
        // 1. Récupérer les transactions où l'utilisateur est impliqué (from ou to), AVEC jointure sur users
        const { data: tx1, error: error1 } = await supabase
          .from("transactions")
          .select(`id, type, from, to, to_label, montant, description, date, from_user:from (pseudo), to_user:to (pseudo)`)
          .or(`from.eq.${userUID},to.eq.${userUID}`)
          .order("date", { ascending: false });
        // 2. Récupérer les dons au pot commun
        const { data: tx2, error: error2 } = await supabase
          .from("transactions")
          .select(`id, type, from, to, to_label, montant, description, date, from_user:from (pseudo), to_user:to (pseudo)`)
          .eq("from", userUID)
          .eq("to_label", "pot_commun")
          .order("date", { ascending: false });

        // Fusionne, supprime les doublons, trie par date décroissante, limite à 10
        let allTxs = [...(tx1 || []), ...(tx2 || [])];
        allTxs = allTxs.filter((tx, idx, arr) => arr.findIndex(t => t.id === tx.id) === idx);
        allTxs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        allTxs = allTxs.slice(0, 10);

        // Mapping explicite des pseudos pour affichage (robuste et valeurs par défaut)
        allTxs = allTxs.map(tx => ({
          ...tx,
          from_pseudo: (
            Array.isArray(tx.from_user)
              ? ((tx.from_user[0] as UserJoin)?.pseudo ?? "inconnu")
              : (typeof tx.from_user === "object" && tx.from_user !== null && "pseudo" in tx.from_user)
                ? (tx.from_user as UserJoin).pseudo
                : "inconnu"
          ),
          to_pseudo: tx.to_label === "pot_commun"
            ? "pot commun"
            : (
              Array.isArray(tx.to_user)
                ? ((tx.to_user[0] as UserJoin)?.pseudo ?? "inconnu")
                : (typeof tx.to_user === "object" && tx.to_user !== null && "pseudo" in tx.to_user)
                  ? (tx.to_user as UserJoin).pseudo
                  : "inconnu"
            ),
          id: tx.id ?? Math.random().toString(36).slice(2),
          type: tx.type ?? "transfert",
          montant: tx.montant ?? 0,
          date: tx.date ?? new Date().toISOString()
        }));

        console.log("allTxs après mapping:", allTxs);
        if (error1 || error2) {
          setTransactions([]);
          setErrorMsg('Erreur lors de la récupération des transactions: ' + (error1?.message || error2?.message));
        } else {
          setTransactions(allTxs);
          setErrorMsg("");
        }
        setLoading(false);
      } catch (e) {
        console.error("Erreur fetchData portefeuille:", e);
        setErrorMsg("Erreur interne: " + (e as Error).message);
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center bg-[#0B0F1C] text-white">Chargement...</div>;
  }

  return (
    <div className="min-h-screen bg-[#0B0F1C] text-white flex flex-col items-center pt-20">
      <div className="bg-[#1C2233] rounded-xl p-8 w-full max-w-xl shadow-lg">
        <h1 className="text-3xl font-bold mb-2 text-center text-sky-400">Portefeuille</h1>
        <div className="mb-6 text-center text-lg">
          Solde&nbsp;: <span className="font-bold text-sky-300">{solde} Narvals</span>
        </div>
        <h2 className="text-xl font-semibold mb-4">Dernières transactions</h2>
        {errorMsg && (
          <div className="text-center text-red-400 mb-2">{errorMsg}</div>
        )}
        {transactions.length === 0 ? (
          <>
            <div className="text-center text-gray-400">Aucune transaction récente</div>
          </>
        ) : (
        <ul className="space-y-4">
          {transactions.map((tx) => (
            <li key={tx.id} className="flex items-center justify-between bg-[#232B42] rounded-lg px-4 py-3">
              <div>
                <div className="font-medium">
                  {renderLabel(tx, user)}
                </div>
                <div className="text-xs text-gray-400">{formatDate(tx.date)}</div>
              </div>
              <span className={`px-2 py-1 rounded text-xs font-semibold ml-2 ${badgeColors[tx.type]}`}>{typeLabels[tx.type]}</span>
            </li>
          ))}
        </ul>
        )}
      </div>
    </div>
  );
}

function renderLabel(tx: Transaction, user: User|null) {
  if (!user) return "";
  const isSender = tx.from === user.UID;
  const isReceiver = tx.to === user.UID;

  // 1. Don au pot commun
  if (tx.type === "don" && isSender && tx.to_label === "pot_commun") {
    return `Tu as donné ${tx.montant} Narvals au pot commun`;
  }
  // 2. Transfert où user est l'émetteur
  if (isSender && tx.to_pseudo && tx.to_label !== "pot_commun") {
    return `Tu as envoyé ${tx.montant} Narvals à ${tx.to_pseudo}`;
  }
  // 3. Transfert où user est le destinataire
  if (isReceiver && tx.from_pseudo) {
    return `Tu as reçu ${tx.montant} Narvals de ${tx.from_pseudo}`;
  }
  // 4. Transfert où user n'est ni émetteur ni destinataire
  if (tx.from_pseudo && tx.to_pseudo && tx.to_label !== "pot_commun") {
    return `${tx.from_pseudo} a envoyé ${tx.montant} Narvals à ${tx.to_pseudo}`;
  }
  // 5. Cas spéciaux
  if (tx.type === "impôt") {
    return `Tu as payé un impôt de ${tx.montant} Narvals`;
  }
  if (tx.type === "pari" && isReceiver) {
    return `Tu as gagné ${tx.montant} Narvals sur un pari`;
  }
  if (tx.type === "enchère" && isReceiver) {
    return `Tu as remporté ${tx.montant} Narvals à une enchère`;
  }
  // 6. Fallback
  return `Transaction (${tx.montant} Narvals)`;
}


// La fonction pseudoOrPot n'est plus utile, les pseudos sont maintenant dynamiques.

function formatDate(dateString: string) {
  const d = new Date(dateString);
  return d.toLocaleDateString("fr-FR", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}
