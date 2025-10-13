"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/utils/supabaseClient";
import { useRouter } from "next/navigation";
import Image from "next/image";

interface Event {
  id: string;
  title: string;
  description?: string;
  date: string;
  location: string;
  cover_url?: string;
  creator_uid: string;
  participants: string[];
  narval_status: any;
  created_at: string;
}

interface User {
  uid: string;
  pseudo: string;
  avatar: string;
  birthday?: string; // DATE (YYYY-MM-DD)
}

export default function EventsPage() {
  const [events, setEvents] = useState<Event[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [filter, setFilter] = useState<'upcoming' | 'past'>("upcoming");
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const [currentUserUid, setCurrentUserUid] = useState<string|null>(null);
  // Window for upcoming birthdays (toggle 30/90 days)
  const [bdayWindowDays, setBdayWindowDays] = useState<number>(30);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setCurrentUserUid(data.user?.id ?? null));
  }, []);

  useEffect(() => {
    const fetchEvents = async () => {
      setLoading(true);
      const { data, error } = await supabase.from("events").select("*").order("date", { ascending: true });
      setEvents(data || []);
      setLoading(false);
    };
    const fetchUsers = async () => {
      // Debug: fetch avatar + birthday for anniversaires
      const { data } = await supabase.from("users").select("uid,pseudo,avatar,birthday");
      setUsers(data || []);
    };
    fetchEvents();
    fetchUsers();
  }, []);

  const userByUid = Object.fromEntries(users.map(u => [u.uid, u]));
  const now = new Date();
  const filteredEvents = events.filter(ev =>
    filter === "upcoming" ? new Date(ev.date) >= now : new Date(ev.date) < now
  );
  // debug: ensure sort order - upcoming ascending, past descending (most recent first)
  const sortedEvents = [...filteredEvents].sort((a, b) => {
    const da = new Date(a.date).getTime();
    const db = new Date(b.date).getTime();
    return filter === "past" ? db - da : da - db;
  });

  // ===== Anniversaires à venir (30 jours) =====
  const today = new Date(); // client clock; display/use Europe/Paris when formatting
  function parseBirth(b: string | undefined): { m: number; d: number } | null {
    if (!b) return null;
    // expected 'YYYY-MM-DD'
    const parts = b.split("-");
    if (parts.length < 3) return null;
    const m = Number(parts[1]);
    const d = Number(parts[2]);
    if (!m || !d) return null;
    return { m, d };
  }
  function nextBirthdayDate(bday: string | undefined, ref: Date): Date | null {
    const pd = parseBirth(bday);
    if (!pd) return null;
    const y = ref.getFullYear();
    // build at noon to avoid DST issues
    let dt = new Date(y, pd.m - 1, pd.d, 12, 0, 0);
    if (dt < ref) dt = new Date(y + 1, pd.m - 1, pd.d, 12, 0, 0);
    return dt;
  }
  function daysBetween(a: Date, b: Date) {
    const ms = b.getTime() - a.getTime();
    return Math.ceil(ms / (1000 * 60 * 60 * 24));
  }
  const upcomingBirthdays = users
    .map(u => {
      const next = nextBirthdayDate(u.birthday, today);
      if (!next) return null;
      const days = daysBetween(today, next);
      return { user: u, next, days };
    })
    .filter((x): x is { user: User; next: Date; days: number } => !!x)
    .filter(x => x.days >= 0 && x.days <= bdayWindowDays)
    .sort((a, b) => a.days - b.days);

  const thisMonthNames = users
    .map(u => ({ u, pd: parseBirth(u.birthday) }))
    .filter(x => x.pd && (x.pd!.m === (today.getMonth() + 1)))
    .map(x => x.u.pseudo);

  function formatDate(dateStr: string, noHour = false) {
    const d = new Date(dateStr);
    return d.toLocaleString("fr-FR", {
      timeZone: "Europe/Paris",
      weekday: "long",
      day: "numeric",
      month: "long",
      ...(noHour ? {} : { hour: "2-digit", minute: "2-digit" })
    });
  }
  function formatHour(dateStr: string) {
    const d = new Date(dateStr);
    return d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Paris" });
  }

  async function handleParticipation(ev: Event) {
    if (!currentUserUid) return;
    const isParticipant = ev.participants.includes(currentUserUid);
    const newParticipants = isParticipant
      ? ev.participants.filter(uid => uid !== currentUserUid)
      : [...ev.participants, currentUserUid];
    await supabase.from("events").update({ participants: newParticipants }).eq("id", ev.id);
    setEvents(events => events.map(e => e.id === ev.id ? { ...e, participants: newParticipants } : e));
  }

  return (
    <div className="min-h-screen bg-[#0B0F1C] text-white flex flex-col items-center pb-8">
      {/* Header + bouton création */}
      <div className="w-full max-w-xl flex items-center justify-between px-4 py-4">
        <div className="flex gap-2">
          <button
            className={`px-3 py-1 rounded-full text-sm font-semibold ${filter === "upcoming" ? "bg-amber-500 text-black" : "bg-[#232B42] text-white"}`}
            onClick={() => setFilter("upcoming")}
          >🟠 À venir</button>
          <button
            className={`px-3 py-1 rounded-full text-sm font-semibold ${filter === "past" ? "bg-amber-500 text-black" : "bg-[#232B42] text-white"}`}
            onClick={() => setFilter("past")}
          >🔁 Passés</button>
        </div>
        <button
          className="text-2xl bg-sky-700 hover:bg-sky-600 text-white rounded-full w-10 h-10 flex items-center justify-center shadow-lg transition"
          onClick={() => router.push("/events/new")}
          aria-label="Créer un événement"
        >
          ➕
        </button>
      </div>
      {/* Liste des événements */}
      <div className="w-full max-w-xl flex flex-col gap-4 px-2">
        {loading ? (
          <div className="text-center text-gray-400 py-12">Chargement…</div>
        ) : filteredEvents.length === 0 ? (
          <div className="text-center text-gray-400 py-12">Aucun événement à afficher.</div>
        ) : (
          sortedEvents.map(ev => {
            const creator = userByUid[ev.creator_uid];
            return (
              <div
                key={ev.id}
                className="bg-[#171C2B] rounded-2xl shadow-md flex flex-col overflow-hidden cursor-pointer hover:shadow-lg transition min-h-[170px] mb-2"
                onClick={() => router.push(`/events/${ev.id}`)}
                style={{padding:'0.5rem 0'}}
              >
                {/* Image de couverture 4:1 */}
                {ev.cover_url && (
                  <div className="w-full bg-black relative flex-shrink-0" style={{ aspectRatio: '4/1', maxHeight: 110 }}>
                    <Image
                      src={ev.cover_url}
                      alt={ev.title}
                      fill
                      className="object-cover rounded-t-2xl"
                      style={{maxHeight:110}}
                      sizes="(max-width: 600px) 100vw, 600px"
                      priority={false}
                    />
                  </div>
                )}
                {/* Contenu compact */}
                <div className="flex flex-col gap-2 px-3 pt-3 pb-2">
                  {/* Ligne titre + orga */}
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-base text-white truncate flex-1">{ev.title}</span>
                    {creator && (
                      <span className="flex items-center gap-1">
                        <Image
                          src={creator.avatar}
                          alt={creator.pseudo}
                          width={26}
                          height={26}
                          className="rounded-full object-cover border border-[#232B42]"
                        />
                        <span className="text-xs text-gray-200 font-semibold max-w-[80px] truncate">{creator.pseudo}</span>
                      </span>
                    )}
                  </div>
                  {/* Date + heure */}
                  <div className="flex items-center gap-2 text-xs">
                    <span>🕒</span>
                    <span className="text-gray-300">{formatDate(ev.date, true)}</span>
                    <span className="text-amber-400 font-bold">{formatHour(ev.date)}</span>
                  </div>
                  {/* Lieu */}
                  <div className="flex items-center gap-2 text-xs text-gray-400 truncate">
                    <span>📍</span>
                    <span>{ev.location}</span>
                  </div>
                  {/* Ligne participants + bouton */}
                  <div className="flex items-center justify-between mt-1">
                    {/* Participants */}
                    <div className="flex items-center gap-1">
                      {ev.participants.length > 0 && ev.participants.map(uid =>
                        userByUid[uid] ? (
                          <Image
                            key={uid}
                            src={userByUid[uid].avatar}
                            alt={userByUid[uid].pseudo}
                            width={22}
                            height={22}
                            className="rounded-full border-2 border-[#232B42] -ml-2 first:ml-0 object-cover"
                          />
                        ) : null
                      )}
                    </div>
                    {/* Bouton participation */}
                    {currentUserUid && (
                      <button
                        className={`px-4 py-1 rounded-full font-semibold text-xs transition-all shadow min-w-[110px] ml-2 ${ev.participants.includes(currentUserUid)
                          ? "bg-[#2c2f38] text-gray-300 hover:bg-[#393c47]"
                          : "bg-amber-400 text-black hover:bg-amber-300"}`}
                        onClick={e => { e.stopPropagation(); handleParticipation(ev); }}
                      >
                        {ev.participants.includes(currentUserUid) ? "Je ne peux plus venir 🫤" : "Je participe"}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* ===== Bloc Anniversaires à venir (festif) — affiché seulement s'il y a des anniversaires ≤ 30 jours ===== */}
      {filter === "upcoming" && upcomingBirthdays.length > 0 && (
        <div className="w-full max-w-xl px-4 mt-3">
          {/* Debug: rendu du bloc anniversaire uniquement quand 'upcomingBirthdays' n'est pas vide */}
          <div className="relative rounded-2xl p-4 bg-gradient-to-br from-[#2b1740] via-[#131b32] to-[#0f172a] border border-white/10 shadow-[0_12px_36px_rgba(0,0,0,0.35)] overflow-hidden">
            {/* Confetti décoratifs */}
            <div className="pointer-events-none select-none absolute -top-2 -left-2 text-4xl opacity-15">🎉</div>
            <div className="pointer-events-none select-none absolute -bottom-2 -right-2 text-4xl opacity-15">🎈</div>

            {/* Title */}
            <div className="flex items-center justify-between mb-3">
              <div className="text-[15px] font-semibold text-white flex items-center gap-2">
                <span>🎂</span>
                <span>Prochains anniversaires</span>
              </div>
              <button
                type="button"
                className="text-[11px] px-2 py-0.5 rounded-full bg-amber-400/15 text-amber-300 border border-amber-300/20 hover:bg-amber-400/25 transition"
                onClick={() => {
                  setBdayWindowDays(d => {
                    const nd = d === 30 ? 90 : 30;
                    console.debug('[Events][Birthday] window toggle', d, '→', nd);
                    return nd;
                  });
                }}
                title="Cliquer pour basculer 30/90 jours"
                aria-label={`Fenêtre anniversaires: ${bdayWindowDays} jours`}
              >
                Dans {bdayWindowDays} jours
              </button>
            </div>

            {/* Horizontal list of upcoming birthdays (festive cards) */}
            <div className="flex gap-3 overflow-x-auto py-1 pr-2 -mr-2">
              {upcomingBirthdays.map(({ user: u, next, days }) => {
                const dayLabel = days === 0 ? "Aujourd'hui" : days === 1 ? "Demain" : `Dans ${days} j`; // UX: plus compact sur mobile
                const dateLabel = next.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
                const ringClass = days <= 1 ? "ring-rose-300/70" : days <= 7 ? "ring-amber-300/60" : "ring-sky-300/50";
                return (
                  <div key={u.uid} className="min-w-[210px] bg-[#0f1526]/90 hover:bg-[#111a2c] transition rounded-xl p-3 border border-white/10 shadow-sm">
                    <div className="flex items-center gap-3">
                      <div className={`w-11 h-11 rounded-full overflow-hidden ring-2 ${ringClass} flex-shrink-0 bg-[#0B0F1C]`}> 
                        {u.avatar ? (
                          <Image src={u.avatar} alt={u.pseudo} width={44} height={44} className="object-cover w-full h-full" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-xl">🎂</div>
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-semibold truncate">{u.pseudo}</div>
                        <div className="mt-0.5 flex items-center gap-2">
                          <span className="text-[11px] px-1.5 py-[2px] rounded-full bg-amber-400/15 text-amber-300 border border-amber-300/20">{dateLabel}</span>
                          <span className="text-[11px] px-1.5 py-[2px] rounded-full bg-sky-400/10 text-sky-300 border border-sky-300/20">{dayLabel}</span>
                        </div>
                      </div>
                    </div>
                    {/* CTAs retirés: rappel visuel uniquement, pas d'action */}
                  </div>
                );
              })}
            </div>

            {/* Liseré festif bas */}
            <div className="absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r from-rose-400 via-amber-300 to-sky-400 opacity-60" />
          </div>
        </div>
      )}
    </div>
  );
}
