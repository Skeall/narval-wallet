"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/utils/supabaseClient";


export default function TransfertPage() {
  const router = useRouter();
  const [users, setUsers] = useState<any[]>([]);
  const [user, setUser] = useState<any>(null);
  const [solde, setSolde] = useState<number>(0);
  const [destinataire, setDestinataire] = useState<string>("");
  const [montant, setMontant] = useState<number>(1);
  const [message, setMessage] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string>("");
  const [errorMsg, setErrorMsg] = useState<string>("");

  useEffect(() => {
    const fetchUsersAndMe = async () => {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) return;
      setUser(authUser);
      // Récupère le solde
      const { data: userData } = await supabase
        .from("users")
        .select("uid, pseudo, solde")
        .eq("uid", authUser.id)
        .single();
      setSolde(userData?.solde || 0);
      // Récupère tous les autres users
      const { data: allUsers } = await supabase
        .from("users")
        .select("uid, pseudo")
        .neq("uid", authUser.id);
      setUsers(allUsers || []);
    };
    fetchUsersAndMe();
  }, []);

  const handleSubmit = async (e: any) => {
    e.preventDefault();
    setErrorMsg("");
    setSuccessMsg("");
    if (!destinataire) {
      setErrorMsg("Sélectionne un destinataire.");
      return;
    }
    if (montant < 1 || montant > solde) {
      setErrorMsg("Montant invalide.");
      return;
    }
    if (destinataire === user?.id) {
      setErrorMsg("Impossible de s'envoyer des Narvals à soi-même.");
      return;
    }
    setLoading(true);
    try {
      // Met à jour les soldes
      const { error: err1 } = await supabase
        .from("users")
        .update({ solde: solde - montant })
        .eq("uid", user.id);
      const { data: destData, error: err2 } = await supabase
        .from("users")
        .select("solde")
        .eq("uid", destinataire)
        .single();
      if (err1 || err2 || !destData) throw new Error("Erreur lors de la mise à jour des soldes.");
      await supabase
        .from("users")
        .update({ solde: destData.solde + montant })
        .eq("uid", destinataire);
      // Crée la transaction
      await supabase.from("transactions").insert({
        type: "transfert",
        from: user.id,
        to: destinataire,
        montant,
        description: message,
        date: new Date().toISOString(),
      });
      setSuccessMsg(`Tu as envoyé ₦${montant} à ${users.find(u => u.uid === destinataire)?.pseudo || "ce membre"} 🎉`);
      setTimeout(() => router.push("/portefeuille"), 1500);
    } catch (e: any) {
      setErrorMsg(e.message || "Erreur lors du transfert.");
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#0B0F1C] px-4">
      <form onSubmit={handleSubmit} className="bg-[#181E2C] rounded-xl shadow-lg p-8 w-full max-w-md flex flex-col gap-6">
        <h1 className="text-2xl font-bold text-sky-400 mb-2 text-center">Transférer des Narvals</h1>
        {/* Destinataire */}
        <div>
          <label className="block mb-2 font-semibold">Destinataire</label>
          <select
            className="w-full bg-[#22283A] text-white rounded-lg px-4 py-3 focus:outline-none"
            value={destinataire}
            onChange={e => setDestinataire(e.target.value)}
            required
          >
            <option value="">Sélectionner un membre...</option>
            {users.map(u => (
              <option key={u.uid} value={u.uid}>{u.pseudo}</option>
            ))}
          </select>
        </div>
        {/* Montant */}
        <div className="flex flex-col items-center w-full">
  <div className="text-3xl font-extrabold text-sky-300 mb-2">{montant > 0 ? `Tu vas envoyer ₦${montant}` : ""}</div>
  <div className="flex items-center w-full gap-2">
    <button
      type="button"
      aria-label="Décrémenter"
      className="bg-[#22283A] text-sky-300 rounded-full w-9 h-9 flex items-center justify-center text-2xl font-bold hover:bg-sky-800 focus:outline-none disabled:opacity-40"
      onClick={() => setMontant(m => Math.max(1, m - 1))}
      disabled={montant <= 1}
    >
      –
    </button>
    <input
      type="range"
      min={1}
      max={solde}
      value={montant}
      onChange={e => setMontant(Number(e.target.value))}
      className="w-full accent-sky-400"
      disabled={solde < 1}
      style={{ minWidth: 0 }}
    />
    <button
      type="button"
      aria-label="Incrémenter"
      className="bg-[#22283A] text-sky-300 rounded-full w-9 h-9 flex items-center justify-center text-2xl font-bold hover:bg-sky-800 focus:outline-none disabled:opacity-40"
      onClick={() => setMontant(m => Math.min(solde, m + 1))}
      disabled={montant >= solde}
    >
      +
    </button>
  </div>
  <div className="text-xs text-gray-400 mt-1">Solde disponible : ₦{solde}</div>
</div>
        {/* Message optionnel */}
        <div>
          <label className="block mb-2 font-semibold">Message (optionnel)</label>
          <input
            type="text"
            maxLength={140}
            value={message}
            onChange={e => setMessage(e.target.value)}
            className="w-full bg-[#22283A] text-white rounded-lg px-4 py-3 focus:outline-none"
            placeholder="Un petit mot..."
          />
        </div>
        {/* Bouton CTA */}
        <button
          type="submit"
          className="mt-2 flex items-center justify-center gap-2 bg-sky-500 hover:bg-sky-600 text-white font-bold py-3 rounded-lg text-lg shadow transition disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={!destinataire || montant < 1 || montant > solde || loading}
        >
          <span>Envoyer les Narvals</span>
          <span className="text-xl">✈️</span>
        </button>
        {/* Messages */}
        {errorMsg && <div className="text-center text-red-400 mt-2">{errorMsg}</div>}
        {successMsg && <div className="text-center text-green-400 mt-2">{successMsg}</div>}
      </form>
    </div>
  );
}
