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
}

export default function EventsPage() {
  const [events, setEvents] = useState<Event[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [filter, setFilter] = useState<'upcoming' | 'past'>("upcoming");
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const [currentUserUid, setCurrentUserUid] = useState<string|null>(null);

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
      const { data } = await supabase.from("users").select("*");
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
    </div>
  );
}
