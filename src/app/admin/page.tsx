"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/utils/supabaseClient";
import { grantXp } from "../xp/xpService";

interface User {
  uid: string;
  pseudo: string;
  solde: number;
  avatar?: string;
}

interface Transaction {
  id: string;
  type: string;
  from: string | null;
  to: string | null;
  montant: number;
  description?: string;
  date: string;
}

import NewAuctionButton from "./NewAuctionButton";

export default function AdminPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [transactions, setTransactions] = useState<Record<string, Transaction[]>>({});
  const [loading, setLoading] = useState(true);
  const [editSolde, setEditSolde] = useState<Record<string, number>>({});
  const [editMotif, setEditMotif] = useState<Record<string, string>>({});
  const [groupAmount, setGroupAmount] = useState<number>(0);
  const [groupMotif, setGroupMotif] = useState<string>("");
  const [groupSelected, setGroupSelected] = useState<Set<string>>(new Set());
  const [groupFeedback, setGroupFeedback] = useState<string>("");
  const [feedback, setFeedback] = useState<string>("");
  // XP group grant state (pink)
  const [xpGroupAmount, setXpGroupAmount] = useState<number>(0);
  const [xpGroupReason, setXpGroupReason] = useState<string>("");
  const [xpGroupSelected, setXpGroupSelected] = useState<Set<string>>(new Set());
  const [xpGroupFeedback, setXpGroupFeedback] = useState<string>("");

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    const { data } = await supabase.from("users").select("uid, pseudo, solde, avatar").order("pseudo");
    setUsers(data || []);
    setLoading(false);
  };

  const fetchTransactions = async (uid: string) => {
    const { data } = await supabase
      .from("transactions")
      .select("id, type, from, to, montant, description, date")
      .or(`from.eq.${uid},to.eq.${uid}`)
      .order("date", { ascending: false })
      .limit(5);
    setTransactions((prev) => ({ ...prev, [uid]: data || [] }));
  };

  // Actions individuelles
  const handleAddNarvals = async (user: User, amount: number, motif?: string) => {
    if (!amount || amount <= 0) return;
    setFeedback("");
    await supabase.from("users").update({ solde: user.solde + amount }).eq("uid", user.uid);
    await supabase.from("transactions").insert({
      type: "admin_ajout",
      from: null,
      to: user.uid,
      montant: amount,
      description: motif || "Ajout admin",
      date: new Date().toISOString(),
    });
    setFeedback(`+₦${amount} ajoutés à ${user.pseudo}`);
    fetchUsers();
    fetchTransactions(user.uid);
  };

  const handleRemoveNarvals = async (user: User, amount: number, motif?: string) => {
    if (!amount || amount <= 0) return;
    setFeedback("");
    await supabase.from("users").update({ solde: user.solde - amount }).eq("uid", user.uid);
    await supabase.from("transactions").insert({
      type: "admin_retrait",
      from: user.uid,
      to: null,
      montant: -amount,
      description: motif || "Retrait admin",
      date: new Date().toISOString(),
    });
    setFeedback(`-₦${amount} retirés à ${user.pseudo}`);
    fetchUsers();
    fetchTransactions(user.uid);
  };

  const handleSetSolde = async (user: User, newSolde: number, motif?: string) => {
    if (isNaN(newSolde)) return;
    setFeedback("");
    await supabase.from("users").update({ solde: newSolde }).eq("uid", user.uid);
    await supabase.from("transactions").insert({
      type: "admin_modif",
      from: null,
      to: user.uid,
      montant: newSolde - user.solde,
      description: motif || "Modification solde admin",
      date: new Date().toISOString(),
    });
    setFeedback(`Solde de ${user.pseudo} modifié à ₦${newSolde}`);
    fetchUsers();
    fetchTransactions(user.uid);
  };

  const handleSendNarvals = async (user: User, amount: number, motif?: string) => {
    if (!amount || amount <= 0) return;
    setFeedback("");
    await supabase.from("users").update({ solde: user.solde + amount }).eq("uid", user.uid);
    await supabase.from("transactions").insert({
      type: "admin_transfert",
      from: null,
      to: user.uid,
      montant: amount,
      description: motif || "Transfert admin",
      date: new Date().toISOString(),
    });
    setFeedback(`₦${amount} envoyés à ${user.pseudo}`);
    fetchUsers();
    fetchTransactions(user.uid);
  };

  // Sélection groupée
  const toggleGroupSelect = (uid: string) => {
    setGroupSelected((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(uid)) newSet.delete(uid);
      else newSet.add(uid);
      return newSet;
    });
  };

  const toggleXpGroupSelect = (uid: string) => {
    setXpGroupSelected((prev) => {
      const s = new Set(prev);
      if (s.has(uid)) s.delete(uid); else s.add(uid);
      return s;
    });
  };

  const handleGroupSend = async () => {
    if (!groupAmount || groupAmount <= 0 || groupSelected.size === 0) return;
    setGroupFeedback("");
    const promises = Array.from(groupSelected).map(async (uid) => {
      const user = users.find((u) => u.uid === uid);
      if (!user) return;
      await supabase.from("users").update({ solde: user.solde + groupAmount }).eq("uid", uid);
      await supabase.from("transactions").insert({
        type: "admin_distribution",
        from: null,
        to: uid,
        montant: groupAmount,
        description: groupMotif || "Distribution groupée admin",
        date: new Date().toISOString(),
      });
    });
    await Promise.all(promises);
    setGroupFeedback(`✅ ₦${groupAmount} envoyés à ${groupSelected.size} joueurs`);
    setGroupSelected(new Set());
    setGroupAmount(0);
    setGroupMotif("");
    fetchUsers();
  };

  const handleGroupGrantXp = async () => {
    if (!xpGroupAmount || xpGroupAmount <= 0 || xpGroupSelected.size === 0) return;
    setXpGroupFeedback("");
    try {
      console.debug('[Admin][XP][Group] grant start', { count: xpGroupSelected.size, amount: xpGroupAmount, reason: xpGroupReason });
      const ops = Array.from(xpGroupSelected).map(async (uid) => {
        await grantXp(uid, 'ADMIN_GRANT', xpGroupAmount, { reason: xpGroupReason || 'ADMIN', source: 'ADMIN_PAGE' });
      });
      await Promise.all(ops);
      setXpGroupFeedback(`✅ +${xpGroupAmount} XP donnés à ${xpGroupSelected.size} joueurs`);
      setXpGroupSelected(new Set());
      setXpGroupAmount(0);
      setXpGroupReason("");
      console.debug('[Admin][XP][Group] grant done');
    } catch (e) {
      console.debug('[Admin][XP][Group] grant error', e);
      setXpGroupFeedback('Erreur lors de la distribution XP');
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white py-8 px-2 flex flex-col items-center">
      <h1 className="text-3xl font-bold mb-6 text-cyan-400">Admin - Gestion des joueurs</h1>
      {feedback && <div className="mb-4 p-2 bg-cyan-800/80 rounded text-center text-cyan-100 shadow">{feedback}</div>}
      <div className="w-full max-w-5xl flex flex-col md:flex-row gap-8">
        {/* Tableau joueurs */}
        <div className="flex-1 bg-gray-900/70 rounded-2xl p-6 shadow-xl">
          <h2 className="text-xl font-semibold mb-4 text-cyan-300">Joueurs</h2>
          <table className="w-full text-left border-separate border-spacing-y-2">
            <thead>
              <tr className="text-cyan-200">
                <th>Avatar</th>
                <th>Pseudo</th>
                <th>Solde</th>
                <th>Actions</th>
                <th>Historique</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.uid} className="bg-gray-800/70 hover:bg-cyan-900/20 rounded-xl transition">
                  <td className="py-2">
                    <img src={user.avatar || "/default-avatar.png"} alt="avatar" className="w-10 h-10 rounded-full border border-cyan-700 shadow" />
                  </td>
                  <td className="font-semibold text-cyan-200">{user.pseudo}</td>
                  <td className="font-mono text-lg">₦{user.solde}</td>
                  <td className="flex flex-col gap-2 min-w-[180px]">
                    <div className="flex gap-2 mb-1">
                      <input type="number" placeholder="+/-" className="w-16 p-1 rounded bg-gray-700 text-cyan-100" value={editSolde[user.uid] || ""} onChange={e => setEditSolde({ ...editSolde, [user.uid]: Number(e.target.value) })} />
                      <input type="text" placeholder="Motif" className="w-28 p-1 rounded bg-gray-700 text-cyan-100" value={editMotif[user.uid] || ""} onChange={e => setEditMotif({ ...editMotif, [user.uid]: e.target.value })} />
                    </div>
                    <div className="flex gap-2">
                      <button className="bg-green-600 hover:bg-green-700 text-white font-bold py-1 px-2 rounded shadow text-xs" onClick={() => handleAddNarvals(user, editSolde[user.uid] || 0, editMotif[user.uid])}>+ Ajouter</button>
                      <button className="bg-red-600 hover:bg-red-700 text-white font-bold py-1 px-2 rounded shadow text-xs" onClick={() => handleRemoveNarvals(user, editSolde[user.uid] || 0, editMotif[user.uid])}>- Retirer</button>
                      <button className="bg-cyan-700 hover:bg-cyan-800 text-white font-bold py-1 px-2 rounded shadow text-xs" onClick={() => handleSetSolde(user, editSolde[user.uid] || user.solde, editMotif[user.uid])}>✏️ Modifier</button>
                      <button className="bg-yellow-600 hover:bg-yellow-700 text-white font-bold py-1 px-2 rounded shadow text-xs" onClick={() => handleSendNarvals(user, editSolde[user.uid] || 0, editMotif[user.uid])}>💸 Envoyer</button>
                    </div>
                  </td>
                  <td>
                    <button className="underline text-cyan-300 text-xs" onClick={() => { setSelectedUser(user); fetchTransactions(user.uid); }}>Voir</button>
                    {transactions[user.uid] && (
                      <ul className="mt-2 text-xs text-cyan-100">
                        {transactions[user.uid].map(tx => (
                          <li key={tx.id} className="mb-1">
                            <span className="font-mono">{tx.date.slice(5, 16)}</span> – <span className="font-semibold">{tx.montant > 0 ? '+' : ''}{tx.montant}</span> <span className="italic">{tx.description || tx.type}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Distribution groupée (Narvals) */}
        <div className="w-full md:w-80 bg-gray-900/80 rounded-2xl p-6 shadow-xl flex flex-col items-center">
          <h2 className="text-lg font-semibold mb-4 text-yellow-300">Distribution groupée</h2>
          <input type="number" className="w-full p-2 mb-2 rounded bg-gray-700 text-yellow-200" placeholder="Montant" value={groupAmount || ""} onChange={e => setGroupAmount(Number(e.target.value))} />
          <input type="text" className="w-full p-2 mb-2 rounded bg-gray-700 text-yellow-200" placeholder="Motif (facultatif)" value={groupMotif} onChange={e => setGroupMotif(e.target.value)} />
          <div className="flex flex-wrap gap-2 mb-4 justify-center">
            {users.map(user => (
              <div key={user.uid} onClick={() => toggleGroupSelect(user.uid)} className={`cursor-pointer border-2 rounded-full p-1 ${groupSelected.has(user.uid) ? 'border-yellow-400 shadow-lg' : 'border-gray-700'} transition relative`}>
                <img src={user.avatar || "/default-avatar.png"} alt="avatar" className="w-10 h-10 rounded-full" />
                {groupSelected.has(user.uid) && <span className="absolute top-0 right-0 bg-yellow-400 w-4 h-4 rounded-full border-2 border-white"></span>}
              </div>
            ))}
          </div>
          <button className="bg-yellow-500 hover:bg-yellow-600 text-slate-900 font-bold py-2 px-6 rounded-full shadow-lg mt-2" onClick={handleGroupSend}>
            Envoyer à {groupSelected.size} joueur{groupSelected.size > 1 ? 's' : ''}
          </button>
          {groupFeedback && <div className="mt-4 text-yellow-200 font-semibold text-center">{groupFeedback}</div>}
        </div>

        {/* Distribution XP (rose) */}
        <div className="w-full md:w-80 bg-gray-900/80 rounded-2xl p-6 shadow-xl flex flex-col items-center">
          <h2 className="text-lg font-semibold mb-4 text-pink-300">Distribution XP</h2>
          <input type="number" className="w-full p-2 mb-2 rounded bg-gray-700 text-pink-200" placeholder="Montant XP" value={xpGroupAmount || ""} onChange={e => setXpGroupAmount(Number(e.target.value))} />
          <input type="text" className="w-full p-2 mb-2 rounded bg-gray-700 text-pink-200" placeholder="Motif (facultatif)" value={xpGroupReason} onChange={e => setXpGroupReason(e.target.value)} />
          <div className="flex flex-wrap gap-2 mb-4 justify-center">
            {users.map(user => (
              <div key={user.uid} onClick={() => toggleXpGroupSelect(user.uid)} className={`cursor-pointer border-2 rounded-full p-1 ${xpGroupSelected.has(user.uid) ? 'border-pink-400 shadow-lg' : 'border-gray-700'} transition relative`}>
                <img src={user.avatar || "/default-avatar.png"} alt="avatar" className="w-10 h-10 rounded-full" />
                {xpGroupSelected.has(user.uid) && <span className="absolute top-0 right-0 bg-pink-400 w-4 h-4 rounded-full border-2 border-white"></span>}
              </div>
            ))}
          </div>
          <button className="bg-pink-500 hover:bg-pink-400 text-black font-bold py-2 px-6 rounded-full shadow-lg mt-2" onClick={handleGroupGrantXp}>
            Donner XP à {xpGroupSelected.size} joueur{xpGroupSelected.size > 1 ? 's' : ''}
          </button>
          {xpGroupFeedback && <div className="mt-4 text-pink-200 font-semibold text-center">{xpGroupFeedback}</div>}
        </div>
      </div>
      {/* Ajout rapide d'une nouvelle enchère */}
      {/* debug: bouton dédié pour créer l'enchère Booster fin 01/01/2026 01:00 (CET) */}
      <NewAuctionButton
        onCreated={fetchUsers}
        lotTitle="Booster"
        lotDescription="Gagne un booster"
        lotImage="booster homepage.png"
        currentBid={1}
        deadlineIso="2026-01-01T00:00:00.000Z"
        label="Créer l'enchère Booster (fin 01/01/2026 01:00)"
      />
    </div>
  );
}
