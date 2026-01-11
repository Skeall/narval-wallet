"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import LoadingVideo from "../components/LoadingVideo";
import { useRouter } from "next/navigation";
import { supabase } from "@/utils/supabaseClient";

// debug: simple constants for game config
const GAME_END_UTC = new Date("2026-02-24T23:59:59.999Z");
const MAX_SLOTS = 6;

// Items definition with emoji labels
type ItemKey =
  | "passeport"
  | "billet"
  | "creme"
  | "lunettes"
  | "maillot"
  | "tongs"
  | "echarpe"
  | "parapluie"
  | "bonnet";

const NECESSARY: { key: ItemKey; label: string }[] = [
  { key: "passeport", label: "🛂 Passeport" },
  { key: "billet", label: "🎫 Billet d’avion" },
  { key: "creme", label: "🧴 Crème solaire" },
  { key: "lunettes", label: "🕶️ Lunettes de soleil" },
  { key: "maillot", label: "🩱 Maillot de bain" },
  { key: "tongs", label: "🩴 Tongs" },
];
const USELESS: { key: ItemKey; label: string }[] = [
  { key: "echarpe", label: "🧣 Écharpe" },
  { key: "parapluie", label: "☔ Parapluie" },
  { key: "bonnet", label: "🧢 Bonnet" },
];
const ALL_ITEMS = [...NECESSARY, ...USELESS];
const NECESSARY_KEYS = new Set(NECESSARY.map(i => i.key));
const LABEL_BY_KEY = Object.fromEntries(ALL_ITEMS.map(i => [i.key, i.label]));

// debug: mapping item -> image asset in /public/valise
const IMG_BY_KEY: Record<ItemKey, string> = {
  passeport: "/valise/passport.png",
  billet: "/valise/billet.png",
  creme: "/valise/creme.png",
  lunettes: "/valise/lunette.png",
  maillot: "/valise/maillot.png",
  tongs: "/valise/tong.png",
  echarpe: "/valise/echarpe.png",
  parapluie: "/valise/parapluie.png",
  bonnet: "/valise/bonnet.png",
};

// Types
interface UserRow { uid: string; pseudo: string; solde: number; avatar?: string }
interface SuitItem { id: string; item: ItemKey; created_at: string }
interface StateRow { uid: string; last_draw_date: string | null; last_exchange_date: string | null; completed_at: string | null }
interface EventRow { id: string; type: string; uid: string; details: any; created_at: string }

export default function ValisePage() {
  const router = useRouter();
  const [user, setUser] = useState<UserRow | null>(null);
  const [items, setItems] = useState<SuitItem[]>([]);
  const [state, setState] = useState<StateRow | null>(null);
  const [feed, setFeed] = useState<EventRow[]>([]);
  const [winners, setWinners] = useState<{ uid: string; pseudo: string; avatar?: string; completed_at: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string>("");
  const [now, setNow] = useState<Date>(new Date());
  // intro video state
  const [showIntro, setShowIntro] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  // streak state (consecutive days with a daily draw)
  const [streak, setStreak] = useState<number>(0);
  const [streakLoading, setStreakLoading] = useState<boolean>(false);
  // audio: suspense sound for daily draw
  const drawSoundRef = useRef<HTMLAudioElement | null>(null);
  // debug: set of item keys (useful or useless) that appear at least twice (to show recycle)
  const duplicateKeys = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const it of items) {
      counts[it.item] = (counts[it.item] || 0) + 1;
    }
    const dups = new Set<ItemKey>();
    Object.entries(counts).forEach(([k, v]) => { if (v >= 2) dups.add(k as ItemKey); });
    return dups;
  }, [items]);

  // Hall of Fame: sort winners by completion date ascending (1st, 2nd, 3rd...)
  const winnersSorted = useMemo(() => {
    try {
      const sorted = [...winners].sort((a, b) => {
        const da = new Date(a.completed_at).getTime();
        const db = new Date(b.completed_at).getTime();
        return da - db;
      });
      console.debug('[Valise][hof] winners sorted', sorted.map(w => ({ uid: w.uid, at: w.completed_at })));
      return sorted;
    } catch (e) {
      console.debug('[Valise][hof] sort error', e);
      return winners;
    }
  }, [winners]);

  // suspense animation for daily draw
  const [showDrawSuspense, setShowDrawSuspense] = useState(false);
  const [suspenseIndex, setSuspenseIndex] = useState(0);
  const cycleKeys = useMemo(() => ALL_ITEMS.map(i => i.key as ItemKey), []);

  // debug: tick clock for UI
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000 * 30);
    return () => clearInterval(t);
  }, []);

  // Preload draw sound once on mount
  useEffect(() => {
    try {
      if (typeof window === 'undefined') return;
      const a = new Audio('/valiseopen.mp3');
      a.preload = 'auto';
      drawSoundRef.current = a;
      console.debug('[Valise][sound] preload valiseopen.mp3');
    } catch (e) {
      console.debug('[Valise][sound] preload failed', e);
    }
  }, []);

  // Show intro video if coming from /specials
  useEffect(() => {
    try {
      if (typeof window === 'undefined') return;
      const flag = sessionStorage.getItem('valiseIntro');
      if (flag === '1') {
        console.debug('[Valise][intro] flag detected -> show video');
        setShowIntro(true);
        sessionStorage.removeItem('valiseIntro');
        setTimeout(() => {
          try { videoRef.current?.play().catch(() => {}); } catch {}
        }, 60);
      }
    } catch {}
  }, []);

  const isOver = useMemo(() => now > GAME_END_UTC, [now]);

  // Load current user
  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }
      const { data: u } = await supabase.from("users").select("uid,pseudo,solde,avatar").eq("uid", user.id).single();
      setUser(u as UserRow);
    };
    load();
  }, [router]);

  // Load suitcase, state, feed, winners
  const reloadAll = async (uid?: string) => {
    const userId = uid || user?.uid;
    if (!userId) return;
    console.debug("[Valise] reloadAll for", userId);
    const [{ data: it }, { data: st }, { data: ev }, { data: ws }] = await Promise.all([
      supabase.from("valise_items").select("id,item,created_at").eq("uid", userId).order("created_at"),
      supabase.from("valise_state").select("uid,last_draw_date,last_exchange_date,completed_at").eq("uid", userId).single(),
      supabase.from("valise_events").select("id,type,uid,details,created_at,users!inner(uid,pseudo,avatar)").order("created_at", { ascending: false }).limit(50),
      supabase.from("valise_events").select("uid,created_at,users!inner(uid,pseudo,avatar)").eq("type", "complete").order("created_at", { ascending: true })
    ]);
    setItems((it || []) as any);
    setState((st as any) || { uid: userId, last_draw_date: null, last_exchange_date: null, completed_at: null });
    setFeed((ev || []) as any);
    // build winners from 'complete' feed events (chronological, unique by uid)
    const mapped: { uid: string; pseudo: string; avatar?: string; completed_at: string }[] = [];
    try {
      const seen = new Set<string>();
      for (const r of (ws as any[]) || []) {
        if (!r || !r.uid) continue;
        if (seen.has(r.uid)) continue;
        seen.add(r.uid);
        mapped.push({ uid: r.uid, completed_at: r.created_at, pseudo: r.users?.pseudo, avatar: r.users?.avatar });
      }
      console.debug('[Valise] winners (from feed complete)', mapped.map(w => ({ uid: w.uid, at: w.completed_at })));
    } catch (e) {
      console.debug('[Valise] winners mapping error', e);
    }
    setWinners(mapped);
    setLoading(false);
  };

  useEffect(() => { if (user?.uid) reloadAll(user.uid); }, [user?.uid]);

  // compute daily streak: consecutive days with a draw for this user
  useEffect(() => {
    const loadStreak = async () => {
      try {
        if (!user) return;
        setStreakLoading(true);
        const since = new Date();
        since.setDate(since.getDate() - 120);
        const { data: draws } = await supabase
          .from('valise_events')
          .select('created_at')
          .eq('uid', user.uid)
          .eq('type', 'draw')
          .gte('created_at', since.toISOString())
          .order('created_at', { ascending: false });
        const setDays = new Set<string>();
        (draws || []).forEach((r: any) => {
          try { setDays.add(new Date(r.created_at).toISOString().slice(0,10)); } catch {}
        });
        // walk back from today (or yesterday if no draw today)
        const today = new Date();
        const start = (!!state?.last_draw_date && state.last_draw_date.slice(0,10) === today.toISOString().slice(0,10))
          ? new Date(today)
          : new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);
        let d = start;
        let count = 0;
        while (true) {
          const key = d.toISOString().slice(0,10);
          if (setDays.has(key)) { count += 1; d = new Date(d.getFullYear(), d.getMonth(), d.getDate() - 1); }
          else break;
        }
        setStreak(count);
      } catch (e) {
        console.debug('[Valise][streak] error', e);
      } finally {
        setStreakLoading(false);
      }
    };
    loadStreak();
  }, [user?.uid, state?.last_draw_date]);

  const todayStr = () => new Date().toISOString().slice(0, 10);
  const hasDrawnToday = !!state?.last_draw_date && state!.last_draw_date.slice(0, 10) === todayStr();
  const canExchangeToday = !state?.last_exchange_date || state!.last_exchange_date.slice(0, 10) !== todayStr();

  const checkVictory = (arr: SuitItem[]) => {
    if (arr.length !== MAX_SLOTS) return false;
    const set = new Set(arr.map(a => a.item));
    if (set.size !== MAX_SLOTS) return false; // no duplicates
    for (const k of NECESSARY_KEYS) if (!set.has(k as ItemKey)) return false;
    return true;
  };

  const awardVictory = async () => {
    if (!user) return;
    // update state + reward user
    await supabase.from("valise_state").upsert({ uid: user.uid, completed_at: new Date().toISOString() }, { onConflict: "uid" });
    await supabase.from("users").update({ solde: (user.solde || 0) + 6 }).eq("uid", user.uid);
    await supabase.from("transactions").insert({
      type: "valise_reward",
      from: null,
      to: user.uid,
      montant: 6,
      description: "+6 Narvals (valise complétée)",
      date: new Date().toISOString(),
    });
    await supabase.from("valise_events").insert({ type: "complete", uid: user.uid, details: { msg: "valise complétée" }, created_at: new Date().toISOString() });
    setMessage("🎉 Valise complétée ! +6 Narvals");
    await reloadAll();
  };

  // debug: manual check button to validate completion after an exchange
  const handleDebugCheckComplete = async () => {
    try {
      console.debug('[Valise][debug-check] starting completion check');
      if (!user) return;
      if (state?.completed_at) { console.debug('[Valise][debug-check] already completed'); return; }
      const ok = checkVictory(items);
      console.debug('[Valise][debug-check] result=', ok, { items: items.map(i => i.item) });
      if (ok) {
        await awardVictory();
      }
    } catch (e) {
      console.debug('[Valise][debug-check] error', e);
    }
  };

  // debug: recycle two identical useless items -> remove both and reset today's draw
  const handleRecycle = async (key: ItemKey) => {
    try {
      if (!user) return;
      const ids = items.filter(it => it.item === key).slice(0, 2).map(it => it.id);
      if (ids.length < 2) { setMessage('Recyclage: besoin de 2 objets identiques'); return; }
      console.debug('[Valise][recycle] removing two', key, ids);
      await supabase.from('valise_items').delete().in('id', ids);
      await supabase.from('valise_state').upsert({ uid: user.uid, last_draw_date: null }, { onConflict: 'uid' });
      await supabase.from('valise_events').insert({ type: 'recycle', uid: user.uid, details: { item: key, count: 2 }, created_at: new Date().toISOString() });
      setMessage('♻️ Recyclage effectué: tirage du jour réinitialisé');
      await reloadAll();
    } catch (e: any) {
      console.error('[Valise][recycle] error', e);
      setMessage('Erreur recyclage: ' + (e?.message || e));
    }
  };

  const handleDraw = async () => {
    try {
      setMessage("");
      if (!user) return;
      if (isOver) { setMessage("Jeu terminé"); return; }
      if (hasDrawnToday) { setMessage("Tirage déjà fait aujourd’hui"); return; }
      // start suspense overlay (1s min)
      const start = Date.now();
      setShowDrawSuspense(true);
      const animInterval = setInterval(() => setSuspenseIndex(i => (i + 1) % cycleKeys.length), 90);
      let revealMsg = "";
      // play suspense sound
      try {
        const a = drawSoundRef.current || new Audio('/valiseopen.mp3');
        drawSoundRef.current = a;
        a.currentTime = 0;
        a.volume = 1;
        a.play().then(() => console.debug('[Valise][sound] play valiseopen')).catch(() => {});
      } catch (e) {
        console.debug('[Valise][sound] play failed', e);
      }
      // random item (all equal probability)
      const rand = ALL_ITEMS[Math.floor(Math.random() * ALL_ITEMS.length)].key as ItemKey;
      // upsert state last_draw_date
      await supabase.from("valise_state").upsert({ uid: user.uid, last_draw_date: todayStr() }, { onConflict: "uid" });
      // suitcase add/replace
      let after: SuitItem[] = [];
      if (items.length < MAX_SLOTS) {
        // debug: robust insert handling (array | object | null)
        const { data: insRaw, error: insErr } = await supabase
          .from("valise_items")
          .insert({ uid: user.uid, item: rand, created_at: new Date().toISOString() })
          .select("id,item,created_at");
        if (insErr) {
          console.debug("[Valise][draw] insert error, will refetch items", insErr);
          setMessage("Erreur tirage (DB): " + (insErr.message || "échec d'insertion"));
          return;
        }
        const insArr = Array.isArray(insRaw) ? insRaw : (insRaw ? [insRaw] : []);
        if (insArr.length > 0) {
          after = [...items, ...insArr as any];
        } else {
          console.debug("[Valise][draw] insert returned no rows, refetching items");
          const { data: latest, error: latestErr } = await supabase
            .from("valise_items")
            .select("id,item,created_at")
            .eq("uid", user.uid)
            .order("created_at");
          if (latestErr) {
            setMessage("Erreur tirage (DB read): " + (latestErr.message || "sélection impossible"));
            return;
          }
          after = (latest as any) || items;
        }
      } else {
        const victim = items[Math.floor(Math.random() * items.length)];
        await supabase.from("valise_items").update({ item: rand }).eq("id", victim.id);
        after = items.map(it => (it.id === victim.id ? { ...it, item: rand } : it));
      }
      await supabase.from("valise_events").insert({ type: "draw", uid: user.uid, details: { item: rand }, created_at: new Date().toISOString() });
      // 10% chance: douane remove one
      if (Math.random() < 0.10 && after.length > 0) {
        const lost = after[Math.floor(Math.random() * after.length)];
        await supabase.from("valise_items").delete().eq("id", lost.id);
        after = after.filter(x => x.id !== lost.id);
        await supabase.from("valise_events").insert({ type: "douane", uid: user.uid, details: { lost: lost.item }, created_at: new Date().toISOString() });
      }
      setItems(after);
      console.debug("[Valise][draw] local items updated", after);
      // Victory check
      if (checkVictory(after) && !state?.completed_at) {
        await awardVictory();
      } else {
        revealMsg = `Tirage: ${LABEL_BY_KEY[rand]}`;
      }
      // debug: delay reload to avoid overriding local state with stale remote read
      setTimeout(() => { reloadAll().catch(() => {}); }, 250);
      // wait until the suspense sound finishes to reveal
      await new Promise<void>((resolve) => {
        try {
          const a = drawSoundRef.current;
          if (!a) { resolve(); return; }
          if (a.ended) { resolve(); return; }
          const onEnded = () => { try { a.removeEventListener('ended', onEnded); } catch {} resolve(); };
          a.addEventListener('ended', onEnded);
        } catch { resolve(); }
      });
      try { clearInterval(animInterval); } catch {}
      setShowDrawSuspense(false);
      if (revealMsg) setMessage(revealMsg);
    } catch (e: any) {
      console.error("[Valise] draw error", e);
      setMessage("Erreur tirage : " + (e?.message || e));
      setShowDrawSuspense(false);
      try { drawSoundRef.current?.pause(); } catch {}
    }
  };

  // debug: reset everything for this user (delete items + clear state)
  const handleResetAll = async () => {
    try {
      if (!user) return;
      if (typeof window !== 'undefined') {
        const ok = window.confirm('Réinitialiser complètement votre valise ? (test)');
        if (!ok) return;
      }
      console.debug('[Valise][reset-all] deleting items for', user.uid);
      await supabase.from('valise_items').delete().eq('uid', user.uid);
      console.debug('[Valise][reset-all] deleting all exchanges for', user.uid);
      await supabase
        .from('valise_exchanges')
        .delete()
        .or(`from_uid.eq.${user.uid},to_uid.eq.${user.uid}`);
      console.debug('[Valise][reset-all] clearing valise_state for', user.uid);
      await supabase
        .from('valise_state')
        .upsert({ uid: user.uid, last_draw_date: null, last_exchange_date: null, completed_at: null }, { onConflict: 'uid' });
      setMessage('Valise réinitialisée (test)');
      await reloadAll();
      await loadPending();
    } catch (e: any) {
      console.error('[Valise][reset-all] error', e);
      setMessage('Erreur reset total (test): ' + (e?.message || e));
    }
  };

  // debug: test helper to reset today's draw (for QA only)
  const handleResetDaily = async () => {
    try {
      if (!user) return;
      console.debug('[Valise][reset] clearing last_draw_date for', user.uid);
      await supabase
        .from('valise_state')
        .upsert({ uid: user.uid, last_draw_date: null, last_exchange_date: null }, { onConflict: 'uid' });
      console.debug('[Valise][reset] deleting pending exchanges for', user.uid);
      await supabase
        .from('valise_exchanges')
        .delete()
        .eq('status', 'pending')
        .or(`from_uid.eq.${user.uid},to_uid.eq.${user.uid}`);
      setMessage('Tirage et échanges du jour réinitialisés (test)');
      await reloadAll();
      await loadPending();
    } catch (e: any) {
      console.error('[Valise][reset] error', e);
      setMessage('Erreur reset (test): ' + (e?.message || e));
    }
  };

  const handleDelete = async (id: string, item: ItemKey) => {
    try {
      if (!user) return;
      if (user.solde < 1) { setMessage("Solde insuffisant (1 Narval)"); return; }
      await supabase.from("users").update({ solde: user.solde - 1 }).eq("uid", user.uid);
      await supabase.from("transactions").insert({
        type: "valise_delete",
        from: user.uid,
        to: null,
        montant: -1,
        description: `Suppression ${item}`,
        date: new Date().toISOString(),
      });
      await supabase.from("valise_items").delete().eq("id", id);
      await supabase.from("valise_events").insert({ type: "delete", uid: user.uid, details: { item }, created_at: new Date().toISOString() });
      setMessage(`Objet supprimé: ${LABEL_BY_KEY[item]} (-1)`);
      await reloadAll();
    } catch (e: any) {
      console.error("[Valise] delete error", e);
      setMessage("Erreur suppression : " + (e?.message || e));
    }
  };

  // Minimal exchanges UI (initiate + accept)
  const [showExchange, setShowExchange] = useState(false);
  const [targetUid, setTargetUid] = useState("");
  const [myItemId, setMyItemId] = useState("");
  const [wantItemKey, setWantItemKey] = useState<ItemKey>("passeport");
  const [pending, setPending] = useState<any[]>([]);
  // exchange UI helpers
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState<UserRow[]>([]);
  const [selectedTarget, setSelectedTarget] = useState<UserRow | null>(null);
  const [fromItemMap, setFromItemMap] = useState<Record<string, ItemKey>>({});
  const [userMap, setUserMap] = useState<Record<string, { pseudo: string; avatar?: string }>>({});
  // rules popup
  const [showRules, setShowRules] = useState(false);
  // confirmations
  const [confirmDeleteTarget, setConfirmDeleteTarget] = useState<{ id: string; item: ItemKey } | null>(null);
  const [confirmRecycleKey, setConfirmRecycleKey] = useState<ItemKey | null>(null);

  const loadPending = async () => {
    if (!user) return;
    console.debug("[Valise] loadPending exchanges for", user.uid);
    const { data } = await supabase
      .from("valise_exchanges")
      .select("id,from_uid,to_uid,from_item_id,from_item_key,to_item_key,status,created_at,responded_at")
      .or(`from_uid.eq.${user.uid},to_uid.eq.${user.uid}`)
      .order("created_at", { ascending: false })
      .limit(20);
    const list = data || [];
    // enrich from_item_id -> item key map
    const ids = Array.from(new Set(list.map(x => x.from_item_id).filter(Boolean)));
    if (ids.length > 0) {
      const { data: itemsRows } = await supabase
        .from("valise_items")
        .select("id,item")
        .in("id", ids as string[]);
      const map: Record<string, ItemKey> = {};
      (itemsRows || []).forEach((r: any) => { map[r.id] = r.item as ItemKey; });
      setFromItemMap(map);
    } else {
      setFromItemMap({});
    }
    // load involved users for avatars
    const uidSet = new Set<string>();
    list.forEach(x => { uidSet.add(x.from_uid); uidSet.add(x.to_uid); });
    if (uidSet.size > 0) {
      const { data: usersRows } = await supabase
        .from("users")
        .select("uid,pseudo,avatar")
        .in("uid", Array.from(uidSet));
      const uMap: Record<string, { pseudo: string; avatar?: string }> = {};
      (usersRows || []).forEach((u: any) => { uMap[u.uid] = { pseudo: u.pseudo, avatar: u.avatar }; });
      setUserMap(uMap);
    } else {
      setUserMap({});
    }
    setPending(list);
  };
  useEffect(() => { loadPending(); }, [user?.uid]);

  // search players by pseudo when modal is open
  useEffect(() => {
    const run = async () => {
      if (!showExchange) return;
      const term = searchTerm.trim();
      if (term.length < 2) { setSearchResults([]); return; }
      console.debug('[Valise][exchange] search users by pseudo:', term);
      const { data } = await supabase
        .from('users')
        .select('uid,pseudo,avatar')
        .ilike('pseudo', `%${term}%`)
        .limit(10);
      setSearchResults((data as any) || []);
    };
    run();
  }, [showExchange, searchTerm]);

  const proposeExchange = async () => {
    try {
      if (!user) return;
      if (isOver) { setMessage("Jeu terminé"); return; }
      if (!canExchangeToday) { setMessage("Échange déjà effectué aujourd’hui"); return; }
      if (!targetUid || !myItemId || !wantItemKey) { setMessage("Formulaire incomplet"); return; }
      const mine = items.find(it => it.id === myItemId);
      if (!mine) { setMessage('Objet sélectionné introuvable'); return; }
      await supabase.from("valise_exchanges").insert({
        from_uid: user.uid,
        to_uid: targetUid,
        from_item_id: myItemId,
        from_item_key: mine.item,
        to_item_key: wantItemKey,
        status: "pending",
        created_at: new Date().toISOString(),
      } as any);
      await supabase.from("valise_events").insert({ type: "exchange_proposed", uid: user.uid, details: { to: targetUid, from_item_id: myItemId, to_item_key: wantItemKey }, created_at: new Date().toISOString() });
      await supabase.from("valise_state").upsert({ uid: user.uid, last_exchange_date: todayStr() }, { onConflict: "uid" });
      setShowExchange(false);
      setMessage("Échange proposé – en attente d’acceptation");
      await loadPending();
    } catch (e: any) {
      console.error("[Valise] propose exchange error", e);
      setMessage("Erreur échange : " + (e?.message || e));
    }
  };

  const acceptExchange = async (ex: any) => {
    try {
      if (!user) return;
      if (user.uid !== ex.to_uid) { setMessage("Non autorisé"); return; }
      // Prefer secured RPC to bypass RLS for cross-user swap
      const { error: rpcErr } = await supabase.rpc('valise_accept_exchange', { p_exchange_id: ex.id });
      if (rpcErr) {
        console.debug('[Valise] RPC accept failed, fallback to client swap', rpcErr);
        // Fallback (may fail due to RLS if other user rows are not visible)
        const { data: mine } = await supabase.from("valise_items").select("id,item").eq("uid", ex.to_uid).eq("item", ex.to_item_key as ItemKey).limit(1);
        const { data: theirs } = await supabase.from("valise_items").select("id,item").eq("uid", ex.from_uid).eq("id", ex.from_item_id).limit(1);
        if (!mine || mine.length === 0 || !theirs || theirs.length === 0) { setMessage("Objets introuvables"); return; }
        await supabase.from("valise_items").update({ item: theirs[0].item }).eq("id", mine[0].id);
        await supabase.from("valise_items").update({ item: ex.to_item_key }).eq("id", theirs[0].id);
        await supabase.from("valise_exchanges").update({ status: "accepted", responded_at: new Date().toISOString() }).eq("id", ex.id);
        await supabase.from("valise_events").insert({ type: "exchange", uid: user.uid, details: { with: ex.from_uid, a: theirs[0].item, b: ex.to_item_key }, created_at: new Date().toISOString() });
        await supabase.from("valise_state").upsert({ uid: user.uid, last_exchange_date: todayStr() }, { onConflict: "uid" });
        await supabase.from("valise_state").upsert({ uid: ex.from_uid, last_exchange_date: todayStr() }, { onConflict: "uid" });
      }
      setMessage("Échange effectué !");
      await reloadAll();
      await loadPending();
    } catch (e: any) {
      console.error("[Valise] accept exchange error", e);
      setMessage("Erreur acceptation : " + (e?.message || e));
    }
  };

  const declineExchange = async (ex: any) => {
    try {
      if (!user) return;
      if (user.uid !== ex.to_uid && user.uid !== ex.from_uid) { setMessage('Non autorisé'); return; }
      console.debug('[Valise] decline exchange', ex.id);
      await supabase.from('valise_exchanges').update({ status: 'declined', responded_at: new Date().toISOString() }).eq('id', ex.id);
      await supabase.from('valise_events').insert({ type: 'exchange_declined', uid: user.uid, details: { with: user.uid === ex.from_uid ? ex.to_uid : ex.from_uid }, created_at: new Date().toISOString() });
      setMessage('Échange refusé');
      await loadPending();
    } catch (e: any) {
      console.error('[Valise] decline exchange error', e);
      setMessage('Erreur refus: ' + (e?.message || e));
    }
  };

  if (loading) {
    // debug: show animated video instead of text during load
    return <LoadingVideo label="Chargement de la valise" />;
  }

  const victory = !!state?.completed_at;

  return (
    <div className="min-h-screen bg-[#0B0F1C] text-white px-3 py-4 flex flex-col items-center gap-4">
      {/* Intro overlay */}
      {showIntro && (
        <div className="fixed inset-0 z-[60] bg-black/95 flex items-center justify-center">
          <button
            className="absolute top-3 right-3 px-3 py-1.5 rounded-full bg-white/15 hover:bg-white/25 text-white text-xs border border-white/20"
            onClick={() => { try { videoRef.current?.pause(); } catch {}; setShowIntro(false); console.debug('[Valise][intro] skipped'); }}
          >
            Passer l'intro
          </button>
          <video
            ref={videoRef}
            src="/valise.mp4"
            className="w-[92vw] max-w-[700px] rounded-2xl shadow-2xl"
            autoPlay
            muted
            playsInline
            onEnded={() => { setShowIntro(false); console.debug('[Valise][intro] ended'); }}
          />
        </div>
      )}

      {/* Draw suspense overlay (1s min) */}
      {showDrawSuspense && (
        <div className="fixed inset-0 z-[58] bg-black/70 flex items-center justify-center">
          <div className="bg-[#0F172A] border border-white/10 rounded-2xl p-5 w-[88%] max-w-[380px] flex flex-col items-center shadow-2xl">
            <div className="text-sm text-white/80 mb-3">Tirage en cours…</div>
            <div className="w-32 h-32 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center shadow-inner">
              <img
                src={IMG_BY_KEY[cycleKeys[suspenseIndex]]}
                alt={LABEL_BY_KEY[cycleKeys[suspenseIndex]]}
                className="w-24 h-24 object-contain animate-pulse"
                draggable={false}
              />
            </div>
            <div className="mt-3 text-xs text-white/60">Suspense…</div>
          </div>
        </div>
      )}

      {/* Confirm delete modal */}
      {confirmDeleteTarget && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={() => setConfirmDeleteTarget(null)}>
          <div className="bg-[#0F172A] border border-white/10 rounded-2xl p-4 w-[92%] max-w-[420px]" onClick={e => e.stopPropagation()}>
            <div className="text-base font-bold mb-1">Confirmer la suppression</div>
            <div className="text-sm text-white/80 mb-4">
              Veux-tu vraiment supprimer "{LABEL_BY_KEY[confirmDeleteTarget.item]}" pour 1 Narval ?
            </div>
            <div className="flex gap-2 justify-end">
              <button
                className="px-3 py-2 rounded-lg bg-gray-600 hover:bg-gray-500 text-white"
                onClick={() => setConfirmDeleteTarget(null)}
              >Annuler</button>
              <button
                className="px-3 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white font-semibold"
                onClick={async () => {
                  console.debug('[Valise][confirm] delete', confirmDeleteTarget);
                  const t = confirmDeleteTarget; setConfirmDeleteTarget(null);
                  await handleDelete(t.id, t.item);
                }}
              >Supprimer (−1)</button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm recycle modal */}
      {confirmRecycleKey && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={() => setConfirmRecycleKey(null)}>
          <div className="bg-[#0F172A] border border-white/10 rounded-2xl p-4 w-[92%] max-w-[420px]" onClick={e => e.stopPropagation()}>
            <div className="text-base font-bold mb-1">Confirmer le recyclage</div>
            <div className="text-sm text-white/80 mb-4">
              Veux-tu vraiment recycler 2 × "{LABEL_BY_KEY[confirmRecycleKey]}" pour récupérer un tirage du jour ?
            </div>
            <div className="flex gap-2 justify-end">
              <button
                className="px-3 py-2 rounded-lg bg-gray-600 hover:bg-gray-500 text-white"
                onClick={() => setConfirmRecycleKey(null)}
              >Annuler</button>
              <button
                className="px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold"
                onClick={async () => {
                  console.debug('[Valise][confirm] recycle', confirmRecycleKey);
                  const k = confirmRecycleKey as ItemKey; setConfirmRecycleKey(null);
                  await handleRecycle(k);
                }}
              >Recycler ♻️</button>
            </div>
          </div>
        </div>
      )}
      {/* Header (trimmed) */}
      <div className="w-full max-w-[430px] flex flex-col gap-2 items-center">
        {isOver && <div className="text-red-300 font-semibold">Jeu terminé</div>}
        {victory && <div className="mt-1 px-3 py-1 rounded bg-green-600 text-white font-bold">Votre valise est complète 🎉</div>}
        {message && <div className="mt-1 text-cyan-300 text-sm">{message}</div>}
      </div>
      {/* Streak pill */}
      <div className="w-full max-w-[430px] flex items-center justify-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-black/30 border border-white/10 shadow">
          <span className="text-base">🔥</span>
          <span className="text-sm font-bold text-amber-300">Streak: {streakLoading ? '…' : streak}</span>
        </div>
        <div className="ml-2 text-xs text-gray-300">
          {hasDrawnToday ? 'Série en cours' : `Fais un tirage aujourd’hui pour passer à ${Math.max(0, streak) + 1}`}
        </div>
      </div>

      {/* Rules modal */}
      {showRules && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50" onClick={() => setShowRules(false)}>
          <div className="bg-[#0F172A] border border-white/10 rounded-2xl p-2 w-[95%] max-w-[620px]" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-2">
              <div className="text-sm font-semibold text-white/90">Règles</div>
              <button className="text-gray-300 hover:text-white" onClick={() => setShowRules(false)}>✖</button>
            </div>
            <div className="mt-2 rounded-xl overflow-hidden">
              <img src="/reglevalise.jpg" alt="Règles Prépare ta valise" className="w-full h-auto object-contain" />
            </div>
          </div>
        </div>
      )}

      {/* Suitcase (visual frame) */}
      <div className="w-full max-w-[430px] relative">
        {/* info button (rules) */}
        <button
          className="absolute -top-1 right-0 translate-y-[-100%] w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 border border-white/20 text-white flex items-center justify-center shadow"
          onClick={() => { console.debug('[Valise] open rules'); setShowRules(true); }}
          aria-label="Informations / Règles"
          title="Règles"
        >
          ℹ️
        </button>
        {/* debug: suitcase handle */}
        <div className="absolute -top-5 left-1/2 -translate-x-1/2 w-24 h-5 rounded-b-xl bg-[#4a3728] border-x border-b border-black/40 shadow-lg" />
        <div
          className="rounded-3xl p-3 border-4 border-[#4a3728] shadow-[inset_0_0_0_2px_rgba(0,0,0,0.35),0_8px_20px_rgba(0,0,0,0.5)]"
          style={{ backgroundImage: 'linear-gradient(135deg, #223046 0%, #0f172a 100%)' }}
        >
          <div
            className="rounded-2xl p-3 border-2 border-dashed border-white/10 bg-[#0b1220]/80"
            style={{ backgroundImage: 'repeating-linear-gradient(45deg, rgba(255,255,255,0.03) 0, rgba(255,255,255,0.03) 6px, transparent 6px, transparent 12px)' }}
          >
            <div className="grid grid-cols-3 gap-3">
          {Array.from({ length: MAX_SLOTS }).map((_, i) => {
            const it = items[i];
            const isUseless = it ? !NECESSARY_KEYS.has(it.item) : false;
            const imgSrc = it ? IMG_BY_KEY[it.item] : null;
            return (
              <div
                key={i}
                className={`relative aspect-square rounded-xl border ${it ? (isUseless ? 'border-red-500/50' : 'border-yellow-400/60') : 'border-white/10'} bg-gradient-to-b from-white/5 to-black/20 flex items-center justify-center`}
              >
                {!it ? (
                  <div className="flex flex-col items-center justify-center text-center">
                    <div className="text-[12px] font-semibold opacity-80">Emplacement libre</div>
                  </div>
                ) : (
                  <>
                    {/* item image */}
                    <img
                      src={imgSrc as string}
                      alt={LABEL_BY_KEY[it.item]}
                      className="w-full h-full object-contain drop-shadow"
                      draggable={false}
                    />
                    {/* overlay recycle icon (top-left) when there are duplicate items */}
                    {!victory && duplicateKeys.has(it.item) && (
                      <button
                        className="absolute top-1.5 left-1.5 w-7 h-7 rounded-full bg-emerald-600/80 hover:bg-emerald-500 text-white flex items-center justify-center shadow"
                        onClick={() => { console.debug('[Valise][ui] open recycle confirm for', it.item); setConfirmRecycleKey(it.item); }}
                        aria-label={`Recyclage 2 × ${LABEL_BY_KEY[it.item]}`}
                        title="Recyclage (2×)"
                      >
                        ♻️
                      </button>
                    )}
                    {/* overlay delete icon (compact, top-right) */}
                    {!victory && (
                      <button
                        className="absolute top-1.5 right-1.5 w-7 h-7 rounded-full bg-black/50 hover:bg-red-600 text-white flex items-center justify-center shadow"
                        onClick={() => { console.debug('[Valise][ui] open delete confirm for', it.id, it.item); setConfirmDeleteTarget({ id: it.id, item: it.item }); }}
                        aria-label={`Supprimer ${LABEL_BY_KEY[it.item]} (-1)`}
                        title="Supprimer (-1)"
                      >
                        🗑️
                      </button>
                    )}
                  </>
                )}
              </div>
            );
          })}
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <button
                className="w-full py-3 rounded-2xl bg-gradient-to-r from-amber-300 to-yellow-400 text-black font-extrabold shadow-lg hover:from-amber-200 hover:to-yellow-300 active:scale-[0.99] disabled:opacity-50"
                disabled={isOver || hasDrawnToday || victory}
                onClick={handleDraw}
              >
                🎲 Tirage du jour
              </button>
              <button
                className="w-full py-3 rounded-2xl bg-gradient-to-r from-cyan-300 to-sky-400 text-black font-extrabold shadow-lg hover:from-cyan-200 hover:to-sky-300 active:scale-[0.99] disabled:opacity-50"
                disabled={isOver || !canExchangeToday || victory}
                onClick={() => setShowExchange(true)}
              >
                🔁 Échanger
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Exchange modal (revamped) */}
      {showExchange && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={() => setShowExchange(false)}>
          <div className="bg-[#0F172A] border border-white/10 rounded-2xl p-4 w-[95%] max-w-[560px]" onClick={e => e.stopPropagation()}>
            {/* header */}
            <div className="flex items-center justify-between mb-3">
              <div className="text-lg font-bold">Échanger un objet</div>
              <button className="text-gray-300 hover:text-white" onClick={() => setShowExchange(false)}>✖</button>
            </div>

            {/* choose target user */}
            <div className="mb-3">
              <div className="text-sm font-semibold mb-1">Choisir un joueur</div>
              {selectedTarget ? (
                <div className="flex items-center gap-2 bg-[#162036] border border-white/10 rounded-xl p-2">
                  <img src={selectedTarget.avatar || "/default-avatar.png"} className="w-8 h-8 rounded-full object-cover border border-gray-700" alt="avatar"/>
                  <div className="text-sm font-medium">{selectedTarget.pseudo}</div>
                  <button className="ml-auto text-xs bg-gray-700 hover:bg-gray-600 rounded px-2 py-1" onClick={() => { setSelectedTarget(null); setTargetUid(""); }}>Changer</button>
                </div>
              ) : (
                <div>
                  <input
                    className="w-full bg-gray-800 rounded-xl p-2 text-sm"
                    placeholder="Rechercher par pseudo (min. 2 caractères)"
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                  />
                  {searchResults.length > 0 && (
                    <div className="mt-2 max-h-40 overflow-y-auto flex flex-col gap-1">
                      {searchResults.map(u => (
                        <button
                          key={u.uid}
                          className="flex items-center gap-2 bg-[#162036] border border-white/10 hover:bg-[#1b2540] rounded-xl p-2 text-left"
                          onClick={() => { setSelectedTarget(u); setTargetUid(u.uid); setSearchTerm(""); setSearchResults([]); console.debug('[Valise][exchange] target selected', u.uid); }}
                        >
                          <img src={u.avatar || "/default-avatar.png"} className="w-7 h-7 rounded-full object-cover border border-gray-700" alt="avatar"/>
                          <span className="text-sm">{u.pseudo}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* choose my item */}
            <div className="mb-3">
              <div className="text-sm font-semibold mb-1">Mon objet à échanger</div>
              <div className="grid grid-cols-4 gap-2">
                {items.length === 0 && <div className="text-xs text-gray-400 col-span-4">Aucun objet dans la valise…</div>}
                {items.map((it) => (
                  <button
                    key={it.id}
                    className={`relative aspect-square rounded-xl border ${myItemId === it.id ? 'border-cyan-400 ring-2 ring-cyan-400/40' : 'border-white/10'} bg-[#0b1220] flex items-center justify-center`}
                    onClick={() => { setMyItemId(it.id); console.debug('[Valise][exchange] myItemId=', it.id); }}
                  >
                    <img src={IMG_BY_KEY[it.item]} alt={LABEL_BY_KEY[it.item]} className="w-full h-full object-contain" />
                  </button>
                ))}
              </div>
            </div>

            {/* choose wanted item */}
            <div className="mb-3">
              <div className="text-sm font-semibold mb-1">Objet souhaité</div>
              <div className="grid grid-cols-5 gap-2">
                {ALL_ITEMS.map(o => (
                  <button
                    key={o.key}
                    className={`relative aspect-square rounded-xl border ${wantItemKey === o.key ? 'border-amber-400 ring-2 ring-amber-400/40' : 'border-white/10'} bg-[#0b1220] flex items-center justify-center`}
                    onClick={() => { setWantItemKey(o.key as ItemKey); console.debug('[Valise][exchange] want=', o.key); }}
                    title={o.label}
                  >
                    <img src={IMG_BY_KEY[o.key as ItemKey]} alt={o.label} className="w-full h-full object-contain" />
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-2 mt-2">
              <button className="flex-1 bg-cyan-400 text-black font-bold rounded p-2 disabled:opacity-50" onClick={proposeExchange} disabled={!selectedTarget || !myItemId || !wantItemKey}>Envoyer la demande</button>
              <button className="flex-1 bg-gray-600 rounded p-2" onClick={() => setShowExchange(false)}>Fermer</button>
            </div>

            {/* pending list */}
            <div className="mt-4">
              <div className="text-sm font-semibold mb-2">Échanges en attente</div>
              {pending.length === 0 ? (
                <div className="text-xs text-gray-400">Aucune demande.</div>
              ) : (
                <ul className="flex flex-col gap-2 max-h-56 overflow-y-auto pr-1">
                  {pending.map((ex) => {
                    const from = userMap[ex.from_uid];
                    const to = userMap[ex.to_uid];
                    const fromItem = (ex.from_item_key as ItemKey | undefined) || (fromItemMap[ex.from_item_id as string] as ItemKey | undefined);
                    const mineIsRecipient = user?.uid === ex.to_uid;
                    const canAct = ex.status === 'pending' && (mineIsRecipient || user?.uid === ex.from_uid);
                    return (
                      <li key={ex.id} className="flex items-center gap-2 bg-[#181F2E] rounded-xl px-3 py-2 border border-white/10">
                        <img src={(from?.avatar) || "/default-avatar.png"} className="w-7 h-7 rounded-full object-cover border border-gray-700" alt="from"/>
                        <span className="text-xs text-gray-300">{from?.pseudo || 'Inconnu'}</span>
                        <span className="text-gray-400 text-xs mx-1">→</span>
                        <img src={(to?.avatar) || "/default-avatar.png"} className="w-7 h-7 rounded-full object-cover border border-gray-700" alt="to"/>
                        <span className="text-xs text-gray-300">{to?.pseudo || 'Inconnu'}</span>
                        <div className="flex items-center gap-2 ml-auto">
                          {fromItem && (
                            <img src={IMG_BY_KEY[fromItem]} alt={fromItem} className="w-7 h-7 object-contain" />
                          )}
                          <span className="text-xs text-gray-400">↔️</span>
                          <img src={IMG_BY_KEY[ex.to_item_key as ItemKey]} alt={ex.to_item_key} className="w-7 h-7 object-contain" />
                        </div>
                        {canAct && (
                          <div className="flex items-center gap-1 ml-2">
                            {mineIsRecipient && (
                              <button className="text-xs bg-green-600 hover:bg-green-500 rounded px-2 py-1" onClick={() => acceptExchange(ex)}>Accepter</button>
                            )}
                            <button className="text-xs bg-gray-700 hover:bg-gray-600 rounded px-2 py-1" onClick={() => declineExchange(ex)}>{mineIsRecipient ? 'Refuser' : 'Annuler'}</button>
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}

      {/* debug: exchanges section hidden per UX focus */}

      {/* debug: winners section hidden per UX focus */}

      {/* Hall of Fame (avatars of completed users, in order) */}
      {winnersSorted.length > 0 && (
        <div className="w-full max-w-[430px] -mt-1 mb-1">
          <div className="flex items-center gap-2 overflow-x-auto py-1">
            {winnersSorted.map((w, idx) => {
              const medalClass = idx === 0
                ? 'ring-2 ring-amber-400/70'
                : idx === 1
                ? 'ring-2 ring-gray-300/60'
                : idx === 2
                ? 'ring-2 ring-amber-800/60'
                : 'ring-1 ring-white/20';
              const rank = idx + 1;
              return (
                <div key={`${w.uid}-${rank}`} className="relative flex flex-col items-center mr-2">
                  <img
                    src={w.avatar || '/default-avatar.png'}
                    alt={w.pseudo}
                    className={`w-9 h-9 rounded-full object-cover border border-gray-700 ${medalClass}`}
                    draggable={false}
                  />
                  <span className="absolute -top-1 -left-1 text-[10px] px-1.5 rounded-full bg-black/70 border border-white/20 text-amber-200 font-bold shadow">
                    {rank}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Feed (styled like /moracle) */}
      <div className="w-full max-w-[430px] bg-[#0F172A] rounded-2xl p-3 border border-white/10 mb-6">
        <div className="mb-2 text-sm font-bold">Activité</div>
        {feed.length === 0 ? (
          <div className="text-xs text-gray-400">Aucune activité.</div>
        ) : (
          <ul className="flex flex-col gap-2 max-h-64 overflow-y-auto pr-1">
            {feed.map((ev, idx) => {
              let text = "";
              if (ev.type === "draw") text = `a tiré : ${LABEL_BY_KEY[ev.details?.item as ItemKey]}`;
              else if (ev.type === "delete") text = `s’est débarrassé de ${LABEL_BY_KEY[ev.details?.item as ItemKey]}`;
              else if (ev.type === "douane") text = `🕵️ Douane : a perdu ${LABEL_BY_KEY[ev.details?.lost as ItemKey]}`;
              else if (ev.type === "exchange") text = `a échangé ${LABEL_BY_KEY[ev.details?.a as ItemKey]} ↔️ ${LABEL_BY_KEY[ev.details?.b as ItemKey]}`;
              else if (ev.type === "complete") text = `a complété sa valise 🎉`;
              else if (ev.type === "exchange_proposed") text = `a proposé un échange`;
              else if (ev.type === "exchange_declined") text = `a refusé un échange`;
              else if (ev.type === "recycle") text = `♻️ a recyclé 2 × ${LABEL_BY_KEY[ev.details?.item as ItemKey]}`;
              let dateStr = '';
              try {
                const d = new Date(ev.created_at);
                dateStr = d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
              } catch {}
              const isComplete = ev.type === 'complete'; // debug: golden highlight for completion
              return (
                <li
                  key={ev.id ?? idx}
                  className={
                    `flex items-center gap-2 rounded-xl px-4 py-3 shadow min-h-[38px] border ` +
                    (isComplete
                      ? 'bg-gradient-to-r from-amber-700/25 to-yellow-600/15 border-amber-400/40 shadow-amber-500/20'
                      : 'bg-[#181F2E] border-white/10')
                  }
                >
                  <img
                    src={(ev as any).users?.avatar || "/default-avatar.png"}
                    alt="avatar"
                    className={`w-7 h-7 rounded-full object-cover border border-gray-700 ${isComplete ? 'ring-2 ring-amber-400/60' : ''}`}
                  />
                  <span className="text-xs text-gray-400 min-w-[46px] text-center">{dateStr}</span>
                  <span className={`ml-2 text-xs break-words whitespace-pre-line flex-1 ${isComplete ? 'text-amber-200 font-semibold drop-shadow' : 'text-amber-300 font-medium'}`}>{text}</span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
      {/* debug: discreet button below the feed to validate completion */}
      <div className="w-full max-w-[430px] -mt-4 mb-6 flex justify-end">
        <button
          className="px-2.5 py-1 rounded-md text-[10px] text-white/40 border border-white/10 bg-transparent hover:text-white/60 disabled:opacity-30"
          disabled={victory}
          onClick={handleDebugCheckComplete}
          title="Vérifier valise (debug)"
        >
          valise debug
        </button>
      </div>
    </div>
  );
}
