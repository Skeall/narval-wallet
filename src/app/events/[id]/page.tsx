"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/utils/supabaseClient";
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

export default function EventDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [event, setEvent] = useState<Event|null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserUid, setCurrentUserUid] = useState<string|null>(null);
  const router = useRouter();

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setCurrentUserUid(data.user?.id ?? null));
  }, []);

  useEffect(() => {
    if (!id) return;
    const fetchEvent = async () => {
      setLoading(true);
      const { data, error } = await supabase.from("events").select("*").eq("id", id).single();
      setEvent(data);
      setLoading(false);
    };
    const fetchUsers = async () => {
      const { data } = await supabase.from("users").select("*");
      setUsers(data || []);
    };
    fetchEvent();
    fetchUsers();
  }, [id]);

  const userByUid = Object.fromEntries(users.map(u => [u.uid, u]));

  function formatDate(dateStr: string) {
    const d = new Date(dateStr);
    return d.toLocaleDateString("fr-FR", {
      weekday: "long",
      day: "numeric",
      month: "long"
    });
  }
  function formatHour(dateStr: string) {
    const d = new Date(dateStr);
    return d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  }

  async function handleParticipation() {
    if (!event || !currentUserUid) return;
    const isParticipant = event.participants.includes(currentUserUid);
    const newParticipants = isParticipant
      ? event.participants.filter(uid => uid !== currentUserUid)
      : [...event.participants, currentUserUid];
    await supabase.from("events").update({ participants: newParticipants }).eq("id", event.id);
    setEvent(e => e ? { ...e, participants: newParticipants } : e);
  }

  if (loading || !event) {
    return <div className="min-h-screen flex items-center justify-center bg-[#0B0F1C] text-white">Chargement…</div>;
  }

  const creator = userByUid[event.creator_uid];
  const isParticipant = currentUserUid && event.participants.includes(currentUserUid);

  return (
    <div className="min-h-screen bg-[#0B0F1C] flex flex-col items-center justify-center px-2 py-6">
      <div className="w-full max-w-xl bg-[#171C2B] rounded-2xl shadow-lg overflow-hidden flex flex-col">
        {/* Image de couverture avec overlay et infos */}
        <div className="relative w-full" style={{ aspectRatio: '3/1', maxHeight: 160 }}>
          {event.cover_url && (
            <Image
              src={event.cover_url}
              alt={event.title}
              fill
              className="object-cover w-full h-full"
              style={{ maxHeight: 160 }}
              priority={true}
            />
          )}
          {/* Bouton retour en haut à gauche sur la cover */}
          <button
            className="absolute top-3 left-3 z-20 p-2 rounded-full bg-black/60 hover:bg-amber-400 transition-colors border border-black/40 text-gray-300 hover:text-black shadow-lg"
            aria-label="Retour aux événements"
            title="Retour aux événements"
            onClick={() => router.push('/events')}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" fill="none" viewBox="0 0 24 24"><path fill="currentColor" d="M15.75 19.08a1 1 0 0 1-1.41 1.42l-7.08-7.09a1 1 0 0 1 0-1.41l7.08-7.09a1 1 0 0 1 1.41 1.42l-6.37 6.38 6.37 6.37Z"/></svg>
          </button>

          {/* Boutons édition et suppression sur la cover pour l'organisateur */}
          {currentUserUid === event.creator_uid && (
            <div className="absolute top-3 right-3 z-20 flex gap-2">
              <button
                className="p-2 rounded-full bg-black/60 hover:bg-amber-400 transition-colors border border-black/40 text-gray-300 hover:text-black shadow-lg"
                aria-label="Éditer l'événement"
                title="Éditer l'événement"
                onClick={() => router.push(`/events/${event.id}/edit`)}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="21" height="21" fill="none" viewBox="0 0 24 24"><path fill="currentColor" d="M16.862 5.487a1.662 1.662 0 0 1 2.351 2.35l-9.26 9.26a1 1 0 0 1-.474.263l-3.09.69a.5.5 0 0 1-.6-.6l.69-3.09a1 1 0 0 1 .263-.474l9.12-9.12Zm1.414-1.414a3.662 3.662 0 0 0-5.179 0l-9.12 9.12a3 3 0 0 0-.789 1.422l-.69 3.09a2.5 2.5 0 0 0 2.999 2.998l3.09-.69a3 3 0 0 0 1.422-.789l9.26-9.26a3.662 3.662 0 0 0 0-5.179Z"/></svg>
              </button>
              <button
                className="p-2 rounded-full bg-black/60 hover:bg-red-600 transition-colors border border-black/40 text-gray-300 hover:text-white shadow-lg"
                aria-label="Supprimer l'événement"
                title="Supprimer l'événement"
                onClick={async () => {
                  if (window.confirm('Supprimer définitivement cet événement ? Cette action est irréversible.')) {
                    await supabase.from('events').delete().eq('id', event.id);
                    router.push('/events');
                  }
                }}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" fill="none" viewBox="0 0 24 24"><path fill="currentColor" d="M9 3a3 3 0 0 1 6 0h5a1 1 0 1 1 0 2h-1.05l-.86 13.77A3 3 0 0 1 15.1 21H8.9a3 3 0 0 1-2.99-2.23L5.05 5H4a1 1 0 1 1 0-2h5Zm2 0a1 1 0 0 1 2 0h-2ZM7.07 5l.85 13.77A1 1 0 0 0 8.9 19h6.2a1 1 0 0 0 .99-.86L16.93 5H7.07Zm2.43 3a1 1 0 0 1 2 0v7a1 1 0 1 1-2 0V8Zm4 0a1 1 0 1 1 2 0v7a1 1 0 1 1-2 0V8Z"/></svg>
              </button>
            </div>
          )}
          {/* Overlay gradient + infos */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent flex flex-col justify-end p-4">
            <div className="text-xl font-bold text-white drop-shadow mb-1">{event.title}</div>
            <div className="flex items-center gap-2 text-sm mb-1">
              <span className="">🕒</span>
              <span className="text-gray-200">{formatDate(event.date)}</span>
              <span className="text-amber-400 font-bold">{formatHour(event.date)}</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-gray-300 mb-1">
              <span>📍</span>
              <span>{event.location}</span>
            </div>
          </div>
        </div>
        {/* Infos complémentaires */}
        <div className="flex flex-col gap-4 p-4 pt-3">
          {/* Organisateur */}
          {creator && (
            <div className="flex items-center gap-2">
              <Image
                src={creator.avatar}
                alt={creator.pseudo}
                width={32}
                height={32}
                className="rounded-full object-cover border border-[#232B42]"
              />
              <span className="text-base text-white font-semibold">{creator.pseudo}</span>
              <span className="ml-2 px-2 py-0.5 rounded-full bg-amber-400 text-black text-xs font-bold">Organisateur</span>
            </div>
          )}
          {/* Description */}
          {event.description && (
            <div className="text-sm text-gray-200 italic">{event.description}</div>
          )}
          {/* Participants */}
          <div className="flex flex-col gap-2 mt-2">
            <div className="text-xs text-gray-400 mb-1">
              {event.participants.length} participant{event.participants.length > 1 ? 's' : ''}
            </div>
            <div className="flex flex-col gap-2">
              {event.participants.length > 0 && event.participants.map(uid =>
                userByUid[uid] ? (
                  <div key={uid} className="flex items-center gap-3 bg-[#232B42] rounded-lg px-2 py-1">
                    <Image
                      src={userByUid[uid].avatar}
                      alt={userByUid[uid].pseudo}
                      width={28}
                      height={28}
                      className="rounded-full object-cover border border-[#393c47]"
                    />
                    <span className="text-sm text-white font-medium truncate">{userByUid[uid].pseudo}</span>
                  </div>
                ) : null
              )}
            </div>
          </div>
          {/* Bouton participation */}
          {currentUserUid && (
            <button
              className={`mt-2 px-5 py-2 rounded-full font-semibold text-sm transition-all shadow ${isParticipant
                ? "bg-[#2c2f38] text-gray-300 hover:bg-[#393c47]"
                : "bg-amber-400 text-black hover:bg-amber-300"}`}
              onClick={handleParticipation}
            >
              {isParticipant ? "Je ne peux plus venir 🫤" : "Je participe"}
            </button>
          )}


        </div>
      </div>
    </div>
  );
}
