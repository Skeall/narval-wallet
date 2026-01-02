"use client";
import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/utils/supabaseClient";
import { grantXp } from "../xp/xpService";
import { XP_VALUES } from "../xp/xpRules";


export default function TransfertPage() {
  const audioRef = useRef<HTMLAudioElement>(null);
  const router = useRouter();
  const [users, setUsers] = useState<any[]>([]);
  const [user, setUser] = useState<any>(null);
  const [solde, setSolde] = useState<number>(0);
  const [destinataire, setDestinataire] = useState<string>("");
  // debug: recent recipients (last 4 unique from transactions)
  const [recentRecipients, setRecentRecipients] = useState<any[]>([]);
  // debug: toggle full selector visibility via "+"
  const [showFullSelector, setShowFullSelector] = useState<boolean>(false);
  // debug: pulse effect on selection
  const [selectedPulseUid, setSelectedPulseUid] = useState<string>("");
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
        .select("uid, pseudo, avatar")
        .neq("uid", authUser.id);
      const others = allUsers || [];
      setUsers(others);

      // debug logs
      console.debug("[Transfert] currentUser:", authUser.id);
      console.debug("[Transfert] others count:", others.length);

      // Récents (4 derniers uniques) depuis transactions 'transfert'
      try {
        const { data: txs, error: txErr } = await supabase
          .from("transactions")
          .select("from, to, date, type")
          .eq("type", "transfert")
          .or(`from.eq.${authUser.id},to.eq.${authUser.id}`)
          .order("date", { ascending: false })
          .limit(20); // on scanne 20 dernières pour extraire 4 uniques
        if (txErr) {
          console.debug("[Transfert] recent fetch error:", txErr.message);
        }
        const uniques: string[] = [];
        (txs || []).forEach((row: any) => {
          const otherUid = row.from === authUser.id ? row.to : row.from;
          if (otherUid && !uniques.includes(otherUid) && otherUid !== authUser.id) {
            uniques.push(otherUid);
          }
        });
        const recent = uniques
          .map(uid => others.find(u => u.uid === uid))
          .filter((u): u is any => Boolean(u))
          .slice(0, 4);
        setRecentRecipients(recent);
        console.debug("[Transfert] recentRecipients:", recent.map((u: any) => u.pseudo));
      } catch (e) {
        console.debug("[Transfert] recent exception:", e);
      }
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
      // Crée la transaction et récupère son id pour la dédup
      const { data: txRows } = await supabase
        .from("transactions")
        .insert({
          type: "transfert",
          from: user.id,
          to: destinataire,
          montant,
          description: message,
          date: new Date().toISOString(),
        })
        .select("id")
        .limit(1);
      setSuccessMsg(`Tu as envoyé ₦${montant} à ${users.find(u => u.uid === destinataire)?.pseudo || "ce membre"} 🎉`);
      // XP: envoi de Narval (+2) – idempotent via dedupe
      try {
        const txId = (txRows && txRows[0] && txRows[0].id) || null;
        const day = new Date().toISOString().slice(0,10);
        const dedupe = txId ? `TRANSFER:${txId}:${user.id}` : `TRANSFER:${user.id}:${destinataire}:${montant}:${day}`;
        console.debug('[XP][Transfert][Send] grant +', XP_VALUES.TRANSFER_SENT, { txId, to: destinataire, montant, dedupe });
        await grantXp(user.id, 'TRANSFER_SENT', XP_VALUES.TRANSFER_SENT, { to: destinataire, montant, txId }, dedupe);
      } catch (e) {
        console.debug('[XP][Transfert][Send] error', e);
      }
      // Joue le son de pièce à la validation
      if (audioRef.current) {
        audioRef.current.currentTime = 0;
        audioRef.current.volume = 0.7;
        audioRef.current.play().catch(() => {});
      }
      setTimeout(() => router.push("/portefeuille"), 1500);
    } catch (e: any) {
      setErrorMsg(e.message || "Erreur lors du transfert.");
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#0B0F1C] px-4 relative">
      <audio ref={audioRef} src="/coin.mp3" preload="auto" />
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
      <form onSubmit={handleSubmit} className="bg-[#181E2C] rounded-xl shadow-lg p-8 w-full max-w-md flex flex-col gap-6">
        <h1 className="text-2xl font-bold text-sky-400 mb-2 text-center">Transférer des Narvals</h1>
        {/* Destinataire - UI style /pari: avatars récents (4) + bouton "+" */}
        <div>
          <div className="text-gray-200 text-base font-medium">Tu veux envoyer à qui ? 👇</div>
          <div className="flex items-center justify-center gap-4 mt-2">
            {/* Avatars récents */}
            {recentRecipients.length > 0 && recentRecipients.map((u: any) => {
              const isSelected = destinataire === u.uid;
              return (
                <button
                  key={u.uid}
                  type="button"
                  title={u.pseudo}
                  onClick={() => {
                    console.debug("[Transfert] avatar clicked:", u.uid, u.pseudo);
                    setDestinataire(u.uid);
                    setShowFullSelector(false);
                    setSelectedPulseUid(u.uid);
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
                  {u.avatar ? (
                    <img src={u.avatar} alt={`Avatar de ${u.pseudo}`} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-lg font-bold">{u.pseudo?.charAt(0)?.toUpperCase() || "?"}</span>
                  )}
                </button>
              );
            })}
            {/* Bouton + */}
            <button
              type="button"
              title="Choisir un autre membre"
              onClick={() => {
                console.debug("[Transfert] plus clicked: toggle full selector");
                setShowFullSelector(v => !v);
              }}
              className="w-14 h-14 rounded-full border-2 border-cyan-400 text-cyan-400 flex items-center justify-center hover:bg-cyan-500/10 transition"
              aria-label="Ouvrir le sélecteur complet"
            >
              <span className="text-2xl font-bold">+</span>
            </button>
          </div>
          {/* Pseudo sélectionné */}
          {destinataire && (
            <div className="text-center text-cyan-300 text-sm mt-1">
              {users.find(u => u.uid === destinataire)?.pseudo}
            </div>
          )}
          {/* Sélecteur complet visible uniquement après clic "+" */}
          {showFullSelector && (
            <select
              className="mt-3 w-full bg-[#22283A] text-white rounded-lg px-4 py-3 focus:outline-none"
              value={destinataire}
              onChange={e => {
                console.debug("[Transfert] selected from full selector:", e.target.value);
                setDestinataire(e.target.value);
              }}
              required
            >
              <option value="">Sélectionner un membre...</option>
              {users.map(u => (
                <option key={u.uid} value={u.uid}>{u.pseudo}</option>
              ))}
            </select>
          )}
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
