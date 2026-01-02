"use client";
import { useState, useRef, useEffect } from "react";
import { supabase } from "@/utils/supabaseClient";
import { useRouter } from "next/navigation";
import { grantXp } from "../../xp/xpService";
import { XP_VALUES } from "../../xp/xpRules";

const DEFAULT_COVER = "/default-event-cover.jpg"; // À placer dans /public (1920x1080 conseillé)

export default function NewEventPage() {
  const [title, setTitle] = useState("");
  const [location, setLocation] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [description, setDescription] = useState("");
  const [imageFile, setImageFile] = useState<File|null>(null);
  const [imagePreview, setImagePreview] = useState<string|null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Récupérer l'utilisateur connecté
  const [currentUserUid, setCurrentUserUid] = useState<string|null>(null);
  
  // Récupérer l'UID utilisateur connecté au montage
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setCurrentUserUid(data.user?.id ?? null));
  }, []);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    setImageFile(file);
    if (file) {
      const reader = new FileReader();
      reader.onload = ev => setImagePreview(ev.target?.result as string);
      reader.readAsDataURL(file);
    } else {
      setImagePreview(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!title.trim() || !location.trim() || !date || !time) {
      setError("Merci de remplir tous les champs obligatoires.");
      return;
    }
    if (!currentUserUid) {
      setError("Utilisateur non connecté");
      return;
    }
    setLoading(true);
    let cover_url = DEFAULT_COVER;
    // 1. Upload image si présente
    if (imageFile) {
      const ext = imageFile.name.split('.').pop();
      const fileName = `event_${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
      const { data: upData, error: upErr } = await supabase.storage.from('events').upload(fileName, imageFile, { upsert: false });
      if (upErr) {
        setError("Erreur lors de l'upload de l'image : " + upErr.message);
        setLoading(false);
        return;
      }
      const { data: pubUrl } = supabase.storage.from('events').getPublicUrl(fileName);
      if (pubUrl?.publicUrl) {
        cover_url = pubUrl.publicUrl;
      }
    }
    // 2. Format date
    const eventDate = new Date(`${date}T${time}`);
    // 3. Insert en base (récupère l'id pour la dédup XP)
    const { data: evRows, error: insErr } = await supabase
      .from('events')
      .insert({
        title: title.trim(),
        location: location.trim(),
        // Stocke la date/heure locale France (Europe/Paris)
        date: `${date}T${time}:00+02:00`,
        description: description.trim() || null,
        cover_url,
        creator_uid: currentUserUid,
        participants: [currentUserUid],
        narval_status: { creator_claimed: false, participants_claimed: [] },
        created_at: new Date().toISOString()
      })
      .select('id')
      .limit(1);
    if (insErr) {
      setError("Erreur lors de la création de l'événement : " + insErr.message);
      setLoading(false);
      return;
    }
    // 4. XP: Création d'événement (+15) – idempotent via dedupe
    try {
      const eventId = (evRows && evRows[0] && evRows[0].id) || null;
      const dedupe = eventId ? `PARTY_CREATE:${eventId}` : `PARTY_CREATE:${currentUserUid}:${title}:${date}`;
      console.debug('[XP][Events][Create] grant +', XP_VALUES.PARTY_CREATED, { eventId, dedupe });
      await grantXp(currentUserUid, 'PARTY_CREATED', XP_VALUES.PARTY_CREATED, { eventId, title }, dedupe);
    } catch (e) {
      console.debug('[XP][Events][Create] error', e);
    }
    setLoading(false);
    router.push("/events");
  };

  return (
    <div className="min-h-screen bg-[#0B0F1C] text-white flex flex-col items-center pt-6 px-2">
      <div className="w-full max-w-xl bg-[#171C2B] rounded-2xl shadow-lg overflow-hidden flex flex-col p-5 relative">
        {/* Bouton retour en haut à gauche */}
        <button
          className="absolute top-4 left-4 z-20 p-2 rounded-full bg-black/60 hover:bg-amber-400 transition-colors border border-black/40 text-gray-300 hover:text-black shadow-lg"
          aria-label="Retour aux événements"
          title="Retour aux événements"
          onClick={() => router.push('/events')}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" fill="none" viewBox="0 0 24 24"><path fill="currentColor" d="M15.75 19.08a1 1 0 0 1-1.41 1.42l-7.08-7.09a1 1 0 0 1 0-1.41l7.08-7.09a1 1 0 0 1 1.41 1.42l-6.37 6.38 6.37 6.37Z"/></svg>
        </button>
        <h1 className="text-2xl font-bold text-amber-400 mb-2">Créer un événement</h1>
        <form className="flex flex-col gap-5" onSubmit={handleSubmit}>
          {/* Image upload */}
          <div>
            <div className="aspect-[3/1] w-full bg-black rounded-lg overflow-hidden flex items-center justify-center cursor-pointer border-2 border-dashed border-gray-600 hover:border-amber-400 transition"
              style={{ maxHeight: 120 }}
              onClick={() => fileInputRef.current?.click()}>
              {imagePreview ? (
                <img src={imagePreview} alt="aperçu" className="object-cover w-full h-full" style={{maxHeight: 120}} />
              ) : (
                <span className="text-gray-500">Clique pour ajouter une image (3:1)</span>
              )}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                ref={fileInputRef}
                onChange={handleImageChange}
              />
            </div>
            <div className="text-xs text-gray-400 mt-1">Image facultative, ratio 3:1 conseillé. Si tu n’en mets pas, une image par défaut sera utilisée.</div>
          </div>
          {/* Titre */}
          <input
            type="text"
            className="bg-[#232B42] rounded px-3 py-2 text-white placeholder-gray-400 outline-none"
            placeholder="Titre de l'événement *"
            value={title}
            onChange={e => setTitle(e.target.value)}
            maxLength={80}
            required
          />
          {/* Lieu */}
          <input
            type="text"
            className="bg-[#232B42] rounded px-3 py-2 text-white placeholder-gray-400 outline-none"
            placeholder="Lieu *"
            value={location}
            onChange={e => setLocation(e.target.value)}
            maxLength={80}
            required
          />
          {/* Date et heure */}
          <div className="flex gap-2">
            <input
              type="date"
              className="bg-[#232B42] rounded px-3 py-2 text-white placeholder-gray-400 outline-none w-1/2"
              value={date}
              onChange={e => setDate(e.target.value)}
              required
            />
            <input
              type="time"
              className="bg-[#232B42] rounded px-3 py-2 text-white placeholder-gray-400 outline-none w-1/2"
              value={time}
              onChange={e => setTime(e.target.value)}
              required
            />
          </div>
          {/* Description */}
          <textarea
            className="bg-[#232B42] rounded px-3 py-2 text-white placeholder-gray-400 outline-none min-h-[64px]"
            placeholder="Description (facultatif, max 200 caractères)"
            value={description}
            onChange={e => setDescription(e.target.value.slice(0, 200))}
            maxLength={200}
          />
          {error && <div className="text-red-400 text-sm">{error}</div>}
          <button
            type="submit"
            className="bg-amber-400 hover:bg-amber-300 text-black font-bold rounded px-4 py-2 mt-2 transition disabled:opacity-50"
            disabled={loading}
          >
            {loading ? "Création en cours…" : "Créer l’événement"}
          </button>
        </form>
      </div>
    </div>
  );
}
