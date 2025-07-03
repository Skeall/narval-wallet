"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/utils/supabaseClient";
// import EnCoursBetsSection from "./EnCoursBetsSection";
// import PendingByMeBetsSection from "./PendingByMeBetsSection";
import PariTransactionItem from "./PariTransactionItem";

// DEBUG: Affiche la variable d'environnement Supabase côté front
console.log("SUPABASE_URL:", process.env.NEXT_PUBLIC_SUPABASE_URL);

const POT_COMMUN_OBJECTIF = 1500;

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
  uid: string;
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
  const router = useRouter();

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [user, setUser] = useState<User|null>(null);
  const [solde, setSolde] = useState<number>(0);
  const [potCommun, setPotCommun] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  

  // Déclare fetchData ici pour qu'elle soit accessible partout
  const fetchData = async () => {
      try {
        setLoading(true);
        // 1. Récupérer l'utilisateur connecté
        const { data: { user: authUser } } = await supabase.auth.getUser();
        if (!authUser) {
          setLoading(false);
          return;
        }
        const useruid = authUser.id;
        console.log("useruid:", useruid);
        // 2. Récupérer le profil user (pour le pseudo et solde)
        const { data: userData } = await supabase
          .from("users")
          .select("uid, pseudo, solde")
          .eq("uid", useruid)
          .single();
        if (!userData) {
          setLoading(false);
          return;
        }
        setUser({ uid: userData.uid, pseudo: userData.pseudo });
        setSolde(userData.solde);

        // NOUVEAU : Récupérer la somme du pot commun
        const { data: potTxs, error: potError } = await supabase
          .from("transactions")
          .select("montant")
          .eq("to_label", "pot_commun");
        const potTotal = (potTxs || []).reduce((sum, tx) => sum + (tx.montant ?? 0), 0);
        setPotCommun(potTotal);

        // 1. Récupérer les transactions où l'utilisateur est impliqué (from ou to), AVEC jointure sur users
        const { data: tx1, error: error1 } = await supabase
          .from("transactions")
          .select(`id, type, from, to, to_label, montant, description, date, from_user:from (pseudo), to_user:to (pseudo)`)
          .or(`from.eq.${useruid},to.eq.${useruid}`)
          .order("date", { ascending: false });
        // 2. Récupérer les dons au pot commun
        const { data: tx2, error: error2 } = await supabase
          .from("transactions")
          .select(`id, type, from, to, to_label, montant, description, date, from_user:from (pseudo), to_user:to (pseudo)`)
          .eq("from", useruid)
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


  useEffect(() => {
    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#0B0F1C] py-8 relative">
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
        <div className="flex min-h-screen items-center justify-center bg-[#0B0F1C] text-white">Chargement...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0B0F1C] text-white flex flex-col items-center pt-20 relative">
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


      {/* Solde et transactions */}
      <div className="bg-[#1C2233] rounded-xl p-8 w-full max-w-xl shadow-lg mt-4">
        <h1 className="text-3xl font-bold mb-2 text-center text-sky-400">Portefeuille</h1>
        <div className="mb-6 text-center text-lg">
          Solde&nbsp;: <span className="font-bold text-sky-300">{solde} Narvals</span>
        </div>
        <h2 className="text-xl font-semibold mb-4">Dernières transactions</h2>
        {errorMsg && (
          <div className="text-center text-red-400 mb-2">{errorMsg}</div>
        )}
        {transactions.length > 0 && (
          <ul className="space-y-3">
            {transactions.map((tx) => (
              <PariTransactionItem
                key={tx.id}
                tx={tx}
                user={user}
                badgeColors={badgeColors}
                typeLabels={typeLabels}
                refreshData={fetchData}
              />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

