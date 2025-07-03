"use client";
import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/utils/supabaseClient";
import Image from "next/image";

export default function EditEventPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(true);
  const [event, setEvent] = useState<any>(null);
  const [title, setTitle] = useState("");
  const [location, setLocation] = useState("");
  const [date, setDate] = useState("");
  const [hour, setHour] = useState("");
  const [description, setDescription] = useState("");
  const [imageFile, setImageFile] = useState<File|null>(null);
  const [imagePreview, setImagePreview] = useState<string|null>(null);
  const [currentUserUid, setCurrentUserUid] = useState<string|null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setCurrentUserUid(data.user?.id ?? null));
  }, []);

  useEffect(() => {
    if (!id) return;
    const fetchEvent = async () => {
      setLoading(true);
      const { data } = await supabase.from("events").select("*").eq("id", id).single();
      setEvent(data);
      setTitle(data.title || "");
      setLocation(data.location || "");
      setDate(data.date ? data.date.slice(0, 10) : "");
      setHour(data.date ? data.date.slice(11, 16) : "");
      setDescription(data.description || "");
      setImagePreview(data.cover_url || null);
      setLoading(false);
    };
    fetchEvent();
  }, [id]);

  function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !location.trim() || !date || !hour) return;
    let cover_url = event.cover_url;
    if (imageFile) {
      const fileExt = imageFile.name.split('.').pop();
      const filePath = `events/${id}.${fileExt}`;
      const { error: uploadError } = await supabase.storage.from("events").upload(filePath, imageFile, { upsert: true });
      if (!uploadError) {
        const { data: urlData } = supabase.storage.from("events").getPublicUrl(filePath);
        cover_url = urlData.publicUrl;
      }
    }
    const fullDate = date + "T" + hour;
    await supabase.from("events").update({
      title,
      location,
      date: fullDate,
      description,
      cover_url
    }).eq("id", id);
    router.push(`/events/${id}`);
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center text-white bg-[#0B0F1C]">Chargement…</div>;
  if (!event) return <div className="min-h-screen flex items-center justify-center text-white bg-[#0B0F1C]">Événement introuvable</div>;
  if (currentUserUid !== event.creator_uid) return <div className="min-h-screen flex items-center justify-center text-white bg-[#0B0F1C]">Accès refusé</div>;

  return (
    <div className="min-h-screen bg-[#0B0F1C] flex flex-col items-center justify-center px-2 py-6">
      <div className="w-full max-w-xl bg-[#171C2B] rounded-2xl shadow-lg overflow-hidden flex flex-col p-5 relative">
        {/* Bouton retour en haut à gauche */}
        <button
          className="absolute top-4 left-4 z-20 p-2 rounded-full bg-black/60 hover:bg-amber-400 transition-colors border border-black/40 text-gray-300 hover:text-black shadow-lg"
          aria-label="Retour à l'événement"
          title="Retour à l'événement"
          onClick={() => router.push(`/events/${id}`)}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" fill="none" viewBox="0 0 24 24"><path fill="currentColor" d="M15.75 19.08a1 1 0 0 1-1.41 1.42l-7.08-7.09a1 1 0 0 1 0-1.41l7.08-7.09a1 1 0 0 1 1.41 1.42l-6.37 6.38 6.37 6.37Z"/></svg>
        </button>
        <h1 className="text-xl font-bold text-white mb-4">Modifier l'événement</h1>
        <form className="flex flex-col gap-5" onSubmit={handleSubmit}>
          {/* Image upload */}
          <div>
            <div className="aspect-[3/1] w-full bg-black rounded-lg overflow-hidden flex items-center justify-center cursor-pointer border-2 border-dashed border-gray-600 hover:border-amber-400 transition"
              style={{ maxHeight: 120 }}
              onClick={() => fileInputRef.current?.click()}>
              {imagePreview ? (
                <img src={imagePreview} alt="aperçu" className="object-cover w-full h-full" style={{maxHeight: 120}} />
              ) : (
                <span className="text-gray-500">Clique pour changer l'image (3:1)</span>
              )}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                ref={fileInputRef}
                onChange={handleImageChange}
              />
            </div>
            <div className="text-xs text-gray-400 mt-1">Image facultative, ratio 3:1 conseillé. Laisse vide pour conserver l'actuelle.</div>
          </div>
          {/* Titre */}
          <input
            className="px-3 py-2 rounded bg-[#232B42] text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-400"
            placeholder="Titre de l'événement"
            value={title}
            maxLength={60}
            onChange={e => setTitle(e.target.value)}
            required
          />
          {/* Lieu */}
          <input
            className="px-3 py-2 rounded bg-[#232B42] text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-400"
            placeholder="Lieu"
            value={location}
            maxLength={60}
            onChange={e => setLocation(e.target.value)}
            required
          />
          {/* Date & heure */}
          <div className="flex gap-2">
            <input
              type="date"
              className="flex-1 px-3 py-2 rounded bg-[#232B42] text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-400"
              value={date}
              onChange={e => setDate(e.target.value)}
              required
            />
            <input
              type="time"
              className="flex-1 px-3 py-2 rounded bg-[#232B42] text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-400"
              value={hour}
              onChange={e => setHour(e.target.value)}
              required
            />
          </div>
          {/* Description */}
          <textarea
            className="px-3 py-2 rounded bg-[#232B42] text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-400"
            placeholder="Description (optionnel, 200 caractères max)"
            value={description}
            maxLength={200}
            onChange={e => setDescription(e.target.value)}
            rows={3}
          />
          <button
            type="submit"
            className="mt-2 px-5 py-2 rounded-full font-semibold text-sm bg-amber-400 text-black hover:bg-amber-300 transition-all shadow"
          >
            Enregistrer les modifications
          </button>
        </form>
      </div>
    </div>
  );
}
