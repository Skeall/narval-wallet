"use client";
import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "@/utils/supabaseClient";

// debug: Embedded wallet history component (reused in Home bottom sheet)
export default function WalletHistoryEmbed() {
  // core state
  const [me, setMe] = useState<{ uid: string; pseudo: string; avatar?: string } | null>(null);
  const [users, setUsers] = useState<{ uid: string; pseudo: string; avatar?: string }[]>([]);
  const [txs, setTxs] = useState<Array<{ id: string; type: string; from: string; to: string; montant: number; description: string | null; date: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);

  // debug: last seen for new badge (shared key but harmless)
  const LAST_SEEN_KEY = "wallet_last_seen_at";
  const [lastSeenAt, setLastSeenAt] = useState<string | null>(null);

  useEffect(() => {
    const run = async () => {
      try {
        setLoading(true);
        const { data: auth } = await supabase.auth.getUser();
        const meId = auth.user?.id;
        if (!meId) { setLoading(false); return; }
        const { data: meRow } = await supabase.from("users").select("uid,pseudo,avatar").eq("uid", meId).single();
        setMe(meRow || null);
        const { data: allUsers } = await supabase.from("users").select("uid,pseudo,avatar");
        setUsers(allUsers || []);
        const { data: rows } = await supabase
          .from("transactions")
          .select("id,type,from,to,montant,description,date")
          .or(`from.eq.${meId},to.eq.${meId}`)
          .order("date", { ascending: false })
          .limit(100);
        setTxs(rows || []);
        try { setLastSeenAt(localStorage.getItem(LAST_SEEN_KEY)); } catch {}
      } catch (e) {
        console.debug("[WalletEmbed] fetch exception", e);
      } finally {
        setLoading(false);
        setTimeout(() => setMounted(true), 0);
        try { localStorage.setItem(LAST_SEEN_KEY, new Date().toISOString()); } catch {}
      }
    };
    run();
  }, []);

  const userMap = useMemo(() => Object.fromEntries(users.map(u => [u.uid, u])), [users]);
  const normType = (t?: string) => (t || "").trim().toLowerCase();
  const isBonusType = (t?: string) => {
    const n = normType(t);
    return n === "bonus" || n === "prime" || n.startsWith("mouv");
  };
  const grouped = useMemo(() => {
    const byDay: Record<string, typeof txs> = {} as any;
    txs.forEach(tx => {
      const d = new Date(tx.date);
      const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
      if (!byDay[key]) byDay[key] = [] as any;
      byDay[key].push(tx);
    });
    const keys = Object.keys(byDay).sort((a,b) => (a<b?1:-1));
    return keys.map(k => ({ key: k, items: byDay[k] }));
  }, [txs]);

  const weekly = useMemo(() => {
    if (!me) return { net: 0, counts: { pari: 0, transfert: 0, bonus: 0 }, daily: Array(7).fill(0) as number[] };
    const now = new Date();
    const start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const daily = Array(7).fill(0) as number[];
    let net = 0; const counts = { pari: 0, transfert: 0, bonus: 0 };
    const deltaFor = (tx: any) => {
      const t = normType(tx.type);
      if (t === "transfert") return tx.from === me.uid ? -Math.abs(tx.montant) : Math.abs(tx.montant);
      if (t === "pari") return tx.montant > 0 ? tx.montant : 0;
      if (isBonusType(t) || (t !== "transfert" && t !== "pari" && tx.montant > 0)) return Math.abs(tx.montant);
      return tx.montant;
    };
    txs.forEach(tx => {
      const d = new Date(tx.date); if (d >= start) {
        const idx = Math.min(6, Math.max(0, Math.floor((d.getTime() - start.getTime()) / (24*60*60*1000))));
        const delta = deltaFor(tx); daily[idx] += delta; net += delta;
        const t = normType(tx.type); if (t === "pari") counts.pari += 1; else if (t === "transfert") counts.transfert += 1; else if (isBonusType(t) || (t !== "transfert" && t !== "pari" && tx.montant > 0)) counts.bonus += 1;
      }
    });
    return { net, counts, daily };
  }, [txs, me]);

  const pluralNarval = (n: number) => `${Math.abs(n)} ${Math.abs(n) > 1 ? "Narvals" : "Narval"}`;
  const fmtDateHeader = (key: string) => {
    const [y,m,d] = key.split("-").map(Number);
    const date = new Date(y, m-1, d);
    return `📅 ${date.toLocaleDateString('fr-FR', { day:'2-digit', month:'long', year:'numeric' })}`;
  };
  const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  const isNew = (iso: string) => { if (!lastSeenAt) return false; try { return new Date(iso) > new Date(lastSeenAt); } catch { return false; } };

  const presentTx = (tx: any) => {
    if (!me) return { title: "", subtitle: "", tag: "", color: "#38BDF8", icon: "💠", other: null as any, isBonus: false };
    const mine = tx.from === me.uid; const otherUid = mine ? tx.to : tx.from; const other = userMap[otherUid];
    const who = other?.pseudo || "Un joueur"; const amountAbs = pluralNarval(Math.abs(tx.montant)); const t = normType(tx.type);
    let title = `${amountAbs}`; let subtitle = tx.description || ""; let tag = "Autre"; let color = "#38BDF8"; let icon = "💠";
    if (t === "transfert") { tag = "Transfert"; icon = "💸"; color = "#00CFFF"; title = mine ? `Tu as envoyé ${amountAbs} à ${who} 💸` : `Tu as reçu ${amountAbs} de ${who} 💸`; }
    else if (t === "pari") { tag = "Pari"; icon = "🎲"; color = "#A855F7"; title = tx.montant > 0 ? `Tu as gagné ${amountAbs} contre ${who} 🎉` : (tx.montant < 0 ? `Tu as engagé ${amountAbs} contre ${who} 🎲` : `Pari mis à jour avec ${who}`); }
    else if (isBonusType(t) || (t !== "transfert" && t !== "pari" && tx.montant >= 0)) { tag = "Bonus"; icon = "🎁"; color = "#FFD54F"; title = tx.montant >= 0 ? `Tu as reçu un bonus de ${amountAbs} ✨` : `Ajustement bonus: -${amountAbs}`; }
    else { icon = tx.montant >= 0 ? "🟢" : "🔴"; color = tx.montant >= 0 ? "#1EDD88" : "#FF5C5C"; title = `${tx.montant >= 0 ? "Gain" : "Perte"} de ${amountAbs}`; }
    const isBonus = tag === "Bonus"; return { title, subtitle, tag, color, icon, other: other || null, isBonus };
  };

  if (loading) return <div className="text-gray-400 text-sm">Chargement de l'historique…</div>;

  return (
    <div className="w-full">
      {/* Weekly summary */}
      <div className="relative mb-4 rounded-2xl px-5 py-4 bg-[#162032] border border-white/8 shadow-[0_8px_24px_rgba(0,0,0,0.25)]">
        <div className="flex flex-col gap-3">
          <div>
            <div className="text-sm text-gray-300">📊 Bilan des 7 derniers jours</div>
            {(() => {
              const net = weekly.net;
              const netAbs = Math.abs(net);
              const isPos = net > 0; const isNeg = net < 0;
              const color = isPos ? '#1EDD88' : isNeg ? '#FF5C5C' : '#9CA3AF';
              const summaryLine = isPos
                ? `+${netAbs} ${netAbs > 1 ? 'Narvals' : 'Narval'} gagnés 🎉`
                : isNeg
                  ? `-${netAbs} ${netAbs > 1 ? 'Narvals' : 'Narval'} perdus 😅`
                  : 'Équilibre parfait 😌';
              return (
                <div className="text-[16px] font-semibold" style={{ color }}>{summaryLine}</div>
              );
            })()}
          </div>
          <div className="flex items-center gap-3 text-sm flex-wrap">
            <span className="px-2 py-1 rounded-full bg-white/5 border border-white/10 text-violet-300">🎲 {weekly.counts.pari} Paris</span>
            <span className="px-2 py-1 rounded-full bg-white/5 border border-white/10 text-cyan-300">💸 {weekly.counts.transfert} Transferts</span>
            <span className="px-2 py-1 rounded-full bg-white/5 border border-white/10 text-amber-300">🎁 {weekly.counts.bonus} Bonus</span>
          </div>
          {/* Mini tendance 7 jours (comme /wallet) */}
          <div className="mt-1">
            <div className="relative h-12 w-full flex items-end gap-1">
              {(() => {
                const daily = weekly.daily;
                const maxAbs = Math.max(1, ...daily.map(v => Math.abs(v)));
                return daily.map((v, i) => {
                  const h = Math.max(2, Math.round((Math.abs(v) / maxAbs) * 40));
                  const barColor = v > 0 ? '#1EDD88' : v < 0 ? '#FF5C5C' : '#64748B';
                  const justify = v >= 0 ? 'flex-end' : 'flex-start';
                  return (
                    <div key={i} className="flex-1 flex" style={{ alignItems: justify as any }}>
                      <div className="w-full rounded-sm" style={{ height: `${h}px`, background: barColor, opacity: 0.85 }} title={`Jour ${i + 1}: ${v >= 0 ? '+' : ''}${v}`} />
                    </div>
                  );
                });
              })()}
              <div className="absolute inset-x-0 top-1/2 h-px bg-white/10" />
            </div>
          </div>
        </div>
      </div>

      {/* Timeline */}
      <div className="flex flex-col gap-5">
        {grouped.length === 0 && (
          <div className="text-gray-400 text-center mt-4">Aucune transaction pour le moment.</div>
        )}
        {grouped.map(({ key, items }) => (
          <div key={key}>
            <div className="text-sm font-semibold text-gray-300 mb-2">{fmtDateHeader(key)}</div>
            <div className="flex flex-col gap-3">
              {items.map((tx, idx) => {
                const p = presentTx(tx);
                const showNew = isNew(tx.date);
                return (
                  <div
                    key={tx.id}
                    className={
                      "relative rounded-xl border border-white/5 px-4 py-3 shadow-md transition " +
                      (p.isBonus ? "bg-[#231A0F] hover:shadow-[0_0_16px_1px_rgba(255,213,79,0.20)]" : "bg-[#1A2233] hover:shadow-[0_0_16px_1px_rgba(56,189,248,0.15)]") +
                      (mounted ? " opacity-100 translate-y-0" : " opacity-0 translate-y-2")
                    }
                    style={{ borderLeft: `4px solid ${p.isBonus ? '#FFD54F' : (tx.montant >= 0 ? '#1EDD88' : '#FF5C5C')}`, transitionDuration: `${250 + Math.min(idx, 8) * 40}ms` }}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`w-10 h-10 rounded-full overflow-hidden flex-shrink-0 border ${p.isBonus ? 'border-amber-300/40 bg-[#2B210F]' : 'border-white/10 bg-[#0B0F1C]'}`}>
                        {p.isBonus ? (
                          <div className="w-full h-full flex items-center justify-center text-xl">🎁</div>
                        ) : p.other?.avatar ? (
                          <img src={p.other.avatar} alt={p.other.pseudo} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-sm text-gray-300">{(p.other?.pseudo || "?").charAt(0).toUpperCase()}</div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[15px] font-semibold leading-snug">{p.title}</span>
                          {showNew && (<span className="text-[10px] px-1.5 py-[1px] rounded-full bg-green-500/20 text-green-300 border border-green-400/30">🆕</span>)}
                        </div>
                        {p.subtitle && (<div className="text-sm text-gray-300 mt-0.5 italic truncate">“{p.subtitle}”</div>)}
                        <div className="text-xs text-gray-400 mt-1 flex items-center gap-2"><span style={{ color: p.color }}>{p.icon} {p.tag}</span><span>—</span><span>{fmtTime(tx.date)}</span></div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
