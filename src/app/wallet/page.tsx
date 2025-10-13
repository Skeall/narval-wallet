"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/utils/supabaseClient";

interface TxRow {
  id: string;
  type: "transfert" | "pari" | string;
  from: string;
  to: string;
  montant: number;
  description: string | null;
  date: string; // ISO
}

interface UserRow {
  uid: string;
  pseudo: string;
  avatar?: string;
}

export default function WalletPage() {
  const router = useRouter(); // debug: back navigation to home
  // debug: core state
  const [me, setMe] = useState<UserRow | null>(null);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [txs, setTxs] = useState<TxRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false); // for enter animations

  // debug: last seen logic for "🆕" badge
  const LAST_SEEN_KEY = "wallet_last_seen_at";
  const [lastSeenAt, setLastSeenAt] = useState<string | null>(null);

  // Fetch current user, users and last 100 transactions involving the current user
  useEffect(() => {
    const run = async () => {
      try {
        setLoading(true);
        const { data: auth } = await supabase.auth.getUser();
        const meId = auth.user?.id;
        if (!meId) {
          setLoading(false);
          return;
        }
        // read profile
        const { data: meRow } = await supabase
          .from("users")
          .select("uid, pseudo, avatar")
          .eq("uid", meId)
          .single();
        setMe(meRow || null);

        // all users for mapping pseudo/avatar locally (simple solution)
        const { data: allUsers } = await supabase
          .from("users")
          .select("uid, pseudo, avatar");
        setUsers(allUsers || []);

        // last 100 txs for this user (sender or receiver)
        const { data: rows } = await supabase
          .from("transactions")
          .select("id, type, from, to, montant, description, date")
          .or(`from.eq.${meId},to.eq.${meId}`)
          .order("date", { ascending: false })
          .limit(100);
        setTxs(rows || []);

        // load last seen timestamp for "🆕" badge
        try {
          const ls = localStorage.getItem(LAST_SEEN_KEY);
          setLastSeenAt(ls);
        } catch {}
      } catch (e) {
        console.debug("[Wallet] fetch exception", e);
      } finally {
        setLoading(false);
        // trigger enter animations after mount
        setTimeout(() => setMounted(true), 0);
        // update last seen to now (after initial render)
        try {
          localStorage.setItem(LAST_SEEN_KEY, new Date().toISOString());
        } catch {}
      }
    };
    run();
  }, []);

  // map uid -> user for quick lookup
  const userMap = useMemo(() => Object.fromEntries(users.map(u => [u.uid, u])), [users]);

  // Normalize type helper (handles casing/whitespace)
  const normType = (t?: string) => (t || "").trim().toLowerCase();
  const isBonusType = (t?: string) => {
    const n = normType(t);
    return n === "bonus" || n === "prime" || n.startsWith("mouv");
  };

  // group transactions by day (YYYY-MM-DD)
  const grouped = useMemo(() => {
    const byDay: Record<string, TxRow[]> = {};
    txs.forEach(tx => {
      const d = new Date(tx.date);
      const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
      if (!byDay[key]) byDay[key] = [];
      byDay[key].push(tx);
    });
    // sorted day keys desc
    const keys = Object.keys(byDay).sort((a,b) => (a<b?1:-1));
    return keys.map(k => ({ key: k, items: byDay[k] }));
  }, [txs]);

  // Weekly summary (last 7 days): net delta for me, activity counts, and mini trend
  const weekly = useMemo(() => {
    if (!me) return { net: 0, counts: { pari: 0, transfert: 0, bonus: 0 }, daily: Array(7).fill(0) as number[] };
    const now = new Date();
    const start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const daily = Array(7).fill(0) as number[];
    let net = 0;
    const counts = { pari: 0, transfert: 0, bonus: 0 };

    const deltaFor = (tx: TxRow) => {
      const t = normType(tx.type);
      if (t === "transfert") {
        // Outgoing = negative; incoming = positive
        return tx.from === me.uid ? -Math.abs(tx.montant) : Math.abs(tx.montant);
      }
      if (t === "pari") {
        // Business rule: exclude engaged stakes (negative) until the bet is resolved
        // We only count positive results (wins) in weekly net/trend
        return tx.montant > 0 ? tx.montant : 0;
      }
      // Treat explicit bonus types, and also any unknown positive credit as bonus (heuristic)
      if (isBonusType(t) || (t !== "transfert" && t !== "pari" && tx.montant > 0)) {
        return Math.abs(tx.montant);
      }
      return tx.montant;
    };

    txs.forEach(tx => {
      const d = new Date(tx.date);
      if (d >= start) {
        const idx = Math.min(6, Math.max(0, Math.floor((d.getTime() - start.getTime()) / (24 * 60 * 60 * 1000))));
        const delta = deltaFor(tx);
        daily[idx] += delta;
        net += delta;
        const t = normType(tx.type);
        if (t === "pari") counts.pari += 1;
        else if (t === "transfert") counts.transfert += 1;
        else if (isBonusType(t) || (t !== "transfert" && t !== "pari" && tx.montant > 0)) counts.bonus += 1;
      }
    });

    console.debug("[Wallet][weekly] net:", net, "counts:", counts, "daily:", daily);
    return { net, counts, daily };
  }, [txs, me]);

  // helpers
  const pluralNarval = (n: number) => `${Math.abs(n)} ${Math.abs(n) > 1 ? "Narvals" : "Narval"}`;
  const fmtDateHeader = (key: string) => {
    const [y,m,d] = key.split("-").map(Number);
    const date = new Date(y, m-1, d);
    return `📅 ${date.toLocaleDateString('fr-FR', { day:'2-digit', month:'long', year:'numeric' })}`;
  };
  const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  const isNew = (iso: string) => {
    if (!lastSeenAt) return false; // first open: no badge to avoid flooding
    try { return new Date(iso) > new Date(lastSeenAt); } catch { return false; }
  };

  // Build presentation for each tx
  const presentTx = (tx: TxRow) => {
    if (!me) return { title: "", subtitle: "", tag: "", color: "#38BDF8", icon: "💠", other: null as UserRow | null };
    const mine = tx.from === me.uid;
    const otherUid = mine ? tx.to : tx.from;
    const other = userMap[otherUid] as UserRow | undefined;
    const who = other?.pseudo || "Un joueur";
    const amountAbs = pluralNarval(Math.abs(tx.montant));
    const t = normType(tx.type);
    // debug: log normalized type once per render item
    console.debug("[Wallet][presentTx] type:", tx.type, "→", t);

    // defaults
    let title = `${amountAbs}`;
    let subtitle = tx.description || "";
    let tag = "Autre";
    let color = "#38BDF8"; // cyan par défaut
    let icon = "💠";

    if (t === "transfert") {
      tag = "Transfert";
      icon = "💸";
      color = "#00CFFF"; // turquoise
      if (mine) {
        title = `Tu as envoyé ${amountAbs} à ${who} 💸`;
      } else {
        title = `Tu as reçu ${amountAbs} de ${who} 💸`;
      }
    } else if (t === "pari") {
      tag = "Pari";
      icon = "🎲";
      color = "#A855F7"; // violet
      if (tx.montant > 0) {
        title = `Tu as gagné ${amountAbs} contre ${who} 🎉`;
      } else if (tx.montant < 0) {
        // mise ou perte: on reste neutre si on ne connaît pas l'issue
        title = `Tu as engagé ${amountAbs} contre ${who} 🎲`;
      } else {
        title = `Pari mis à jour avec ${who}`;
      }
    } else if (isBonusType(t) || (t !== "transfert" && t !== "pari" && tx.montant >= 0)) {
      // Map "mouvement" → Bonus (per product decision)
      tag = "Bonus";
      icon = "🎁";
      color = "#FFD54F"; // doré
      if (tx.montant >= 0) {
        title = `Tu as reçu un bonus de ${amountAbs} ✨`;
      } else {
        title = `Ajustement bonus: -${amountAbs}`;
      }
    } else {
      // fallback générique
      icon = tx.montant >= 0 ? "🟢" : "🔴";
      color = tx.montant >= 0 ? "#1EDD88" : "#FF5C5C";
      title = `${tx.montant >= 0 ? "Gain" : "Perte"} de ${amountAbs}`;
    }

    // tone: if subtitle empty and description exists already handled; else keep it empty
    const isBonus = tag === "Bonus";
    return { title, subtitle, tag, color, icon, other: other || null, isBonus };
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0B0F1C] text-white">
        Chargement de l'historique…
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0B0F1C] text-white flex flex-col items-center pb-10 relative">
      {/* Bouton retour (haut gauche) */}
      <button
        onClick={() => {
          console.debug("[Wallet] back to home clicked");
          router.push("/");
        }}
        className="absolute top-3 left-3 z-20 bg-slate-700/80 hover:bg-slate-600/90 rounded-full p-2 shadow transition focus:outline-none focus:ring-2 focus:ring-cyan-400 flex items-center justify-center"
        style={{ width: 40, height: 40 }}
        aria-label="Retour à l'accueil"
      >
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5 text-cyan-300">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
        </svg>
      </button>
      <div className="w-full max-w-[430px] px-4 pt-6">
        {/* Header */}
        <h1 className="text-2xl font-bold text-sky-300 mb-2">Historique du portefeuille</h1>
        <p className="text-sm text-gray-300 mb-4">Tes bonus récents, classés par jour.</p>

        {/* Weekly summary card */}
        {(() => {
          const net = weekly.net;
          const netAbs = Math.abs(net);
          const isPos = net > 0;
          const isNeg = net < 0;
          const color = isPos ? "#1EDD88" : isNeg ? "#FF5C5C" : "#9CA3AF";
          const summaryLine = isPos
            ? `+${netAbs} ${netAbs > 1 ? "Narvals" : "Narval"} gagnés 🎉`
            : isNeg
              ? `-${netAbs} ${netAbs > 1 ? "Narvals" : "Narval"} perdus 😅`
              : "Équilibre parfait 😌";
          // Emoji d'ambiance selon l'amplitude
          const mood = isPos && netAbs >= 8 ? "🐳"
            : isNeg && netAbs >= 8 ? "💀"
            : isNeg ? "😅" : isPos ? "🔥" : "🙂";

          // Simple mini-trend bars (7 jours) - positive: green, negative: red, zero: gray
          const daily = weekly.daily;
          const maxAbs = Math.max(1, ...daily.map(v => Math.abs(v)));

          return (
            <div
              className={
                "relative mb-5 rounded-2xl px-5 py-4 bg-[#162032] border border-white/8 " +
                "shadow-[0_8px_24px_rgba(0,0,0,0.25)] " +
                (mounted ? "opacity-100 scale-100" : "opacity-0 scale-[0.98]") +
                " transition"
              }
              style={{ transitionDuration: "300ms" }}
            >
              <div className="flex flex-col gap-3">
                {/* Zone 1 — Résumé */}
                <div>
                  <div className="text-sm text-gray-300">📊 Bilan des 7 derniers jours</div>
                  <div className="text-[16px] font-semibold" style={{ color }}>{summaryLine}</div>
                </div>

                {/* Zone 2 — Détails d’activité */}
                <div className="flex items-center gap-3 text-sm flex-wrap">
                  <span className="px-2 py-1 rounded-full bg-white/5 border border-white/10 text-violet-300">🎲 {weekly.counts.pari} Paris</span>
                  <span className="px-2 py-1 rounded-full bg-white/5 border border-white/10 text-cyan-300">💸 {weekly.counts.transfert} Transferts</span>
                  <span className="px-2 py-1 rounded-full bg-white/5 border border-white/10 text-amber-300">🎁 {weekly.counts.bonus} Bonus</span>
                  {/* Removed mood label per request */}
                </div>

                {/* Zone 3 — Mini tendance */}
                <div className="mt-1">
                  <div className="relative h-12 w-full flex items-end gap-1">
                    {daily.map((v, i) => {
                      const h = Math.max(2, Math.round((Math.abs(v) / maxAbs) * 40));
                      const barColor = v > 0 ? "#1EDD88" : v < 0 ? "#FF5C5C" : "#64748B";
                      const justify = v >= 0 ? "flex-end" : "flex-start";
                      return (
                        <div key={i} className="flex-1 flex" style={{ alignItems: justify as any }}>
                          <div
                            className="w-full rounded-sm"
                            style={{ height: `${h}px`, background: barColor, opacity: 0.85 }}
                            title={`Jour ${i + 1}: ${v >= 0 ? "+" : ""}${v}`}
                          />
                        </div>
                      );
                    })}
                    {/* Axe médian visuel */}
                    <div className="absolute inset-x-0 top-1/2 h-px bg-white/10" />
                  </div>
                </div>
              </div>
            </div>
          );
        })()}

        {/* Timeline group by day */}
        <div className="flex flex-col gap-5">
          {grouped.length === 0 && (
            <div className="text-gray-400 text-center mt-8">Aucune transaction pour le moment.</div>
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
                        (p.isBonus
                          ? "bg-[#231A0F] hover:shadow-[0_0_16px_1px_rgba(255,213,79,0.20)]"
                          : "bg-[#1A2233] hover:shadow-[0_0_16px_1px_rgba(56,189,248,0.15)]") +
                        (mounted ? " opacity-100 translate-y-0" : " opacity-0 translate-y-2")
                      }
                      style={{
                        borderLeft: `4px solid ${p.isBonus ? "#FFD54F" : (tx.montant >= 0 ? "#1EDD88" : "#FF5C5C")}`,
                        transitionDuration: `${250 + Math.min(idx, 8) * 40}ms`,
                      }}
                    >
                      {/* Top row: avatar + title */}
                      <div className="flex items-start gap-3">
                        <div className={
                          `w-10 h-10 rounded-full overflow-hidden flex-shrink-0 border ` +
                          (p.isBonus ? "border-amber-300/40 bg-[#2B210F]" : "border-white/10 bg-[#0B0F1C]")
                        }>
                          {p.isBonus ? (
                            <div className="w-full h-full flex items-center justify-center text-xl">🎁</div>
                          ) : p.other?.avatar ? (
                            <img src={p.other.avatar} alt={p.other.pseudo} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-sm text-gray-300">
                              {(p.other?.pseudo || "?").charAt(0).toUpperCase()}
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-[15px] font-semibold leading-snug">{p.title}</span>
                            {/* New badge */}
                            {showNew && (
                              <span className="text-[10px] px-1.5 py-[1px] rounded-full bg-green-500/20 text-green-300 border border-green-400/30">🆕</span>
                            )}
                          </div>
                          {p.subtitle && (
                            <div className="text-sm text-gray-300 mt-0.5 italic truncate">“{p.subtitle}”</div>
                          )}
                          <div className="text-xs text-gray-400 mt-1 flex items-center gap-2">
                            <span style={{ color: p.color }}>{p.icon} {p.tag}</span>
                            <span>—</span>
                            <span>{fmtTime(tx.date)}</span>
                          </div>
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
    </div>
  );
}
