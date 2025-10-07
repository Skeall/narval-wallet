"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/utils/supabaseClient";
import LazyRevealImage from "../components/LazyRevealImage";

interface Souvenir {
  id: string;
  author_uid: string;
  media_url: string;
  media_type: "image" | "video";
  text: string | null;
  tagged_users: string[];
  reactions: Record<string, string[]> | null;
  created_at: string;
}

interface User {
  uid: string;
  pseudo: string;
  avatar: string;
}

const EMOJIS = ["❤️", "😂", "🫠", "👏", "🔥"];

export default function SouvenirsPage() {
  // ... états existants ...
  const [editMode, setEditMode] = useState(false);
  const [editText, setEditText] = useState("");
  const [editTagged, setEditTagged] = useState<Set<string>>(new Set());
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState("");
  // ... états existants ...
  const [formOpen, setFormOpen] = useState(false);
  const [formText, setFormText] = useState("");
  const [formTagged, setFormTagged] = useState<Set<string>>(new Set());
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState("");
  const [imageFile, setImageFile] = useState<File|null>(null);
  const [imagePreview, setImagePreview] = useState<string|null>(null);

  // Handler image
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

  // Handler tag
  const toggleTagUser = (uid: string) => {
    setFormTagged(prev => {
      const next = new Set(prev);
      if (next.has(uid)) next.delete(uid);
      else next.add(uid);
      return next;
    });
  };

  // Handler submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    if (!hasCurrentUser) { setFormError("Utilisateur courant introuvable. Veuillez vous reconnecter."); return; }
    if (!imageFile) { setFormError("Merci de sélectionner une image."); return; }
    if (formText.length > 80) { setFormError("80 caractères max"); return; }
    setFormLoading(true);
    try {
      // 1. Upload image dans Supabase Storage
      const fileExt = imageFile.name.split('.').pop();
      const fileName = `souvenir_${Date.now()}_${Math.random().toString(36).slice(2)}.${fileExt}`;
      const { data: upData, error: upErr } = await supabase.storage.from('souvenirs').upload(fileName, imageFile, { upsert: false });
      console.log('Résultat upload:', upData, upErr);
      if (upErr) {
        setFormError("Erreur lors de l'upload de l'image : " + upErr.message);
        setFormLoading(false);
        return;
      }
      // 2. Récupérer l’URL publique
      const { data: pubUrl } = supabase.storage.from('souvenirs').getPublicUrl(fileName);
      console.log('URL publique générée:', pubUrl);
      if (!pubUrl?.publicUrl) {
        setFormError("URL publique introuvable après upload");
        setFormLoading(false);
        return;
      }
      // 3. Insérer en base
      const { error: insErr } = await supabase.from('souvenirs').insert({
        author_uid: currentUserUid,
        media_url: pubUrl.publicUrl,
        media_type: 'image',
        text: formText.trim() || null,
        tagged_users: Array.from(formTagged),
        created_at: new Date().toISOString()
      });
      if (insErr) throw insErr;
      // 4. Reset et rafraîchir
      setFormOpen(false);
      setFormText("");
      setFormTagged(new Set());
      setImageFile(null);
      setImagePreview(null);
      setFormLoading(false);
      setFormError("");
      fetchSouvenirs();
    } catch (err: any) {
      setFormError(err.message || "Erreur lors de la publication");
      setFormLoading(false);
    }
  };


  const [souvenirs, setSouvenirs] = useState<Souvenir[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [modalSouvenir, setModalSouvenir] = useState<Souvenir | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  // Perf: pagination & lazy loading to avoid initial freeze
  const PAGE_SIZE = 24; // simple, small pages for fluid feel
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    fetchUsers();
    // first page load
    fetchSouvenirs(true);
  }, []);



  const fetchUsers = async () => {
    const { data } = await supabase.from("users").select("uid, pseudo, avatar").order("pseudo");
    setUsers(data || []);
  };

  // Paginated fetch. If reset=true, reload from page 0.
  const fetchSouvenirs = async (reset: boolean = false) => {
    try {
      if (reset) {
        console.debug("[Souvenirs] Reset list and load first page");
        setLoading(true);
        setPage(0);
        setHasMore(true);
        setSouvenirs([]);
      } else {
        setLoadingMore(true);
      }

      const currentPage = reset ? 0 : page + 1;
      const from = currentPage * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      const { data, error } = await supabase
        .from("souvenirs")
        .select("*")
        .order("created_at", { ascending: false })
        .range(from, to);
      if (error) {
        console.debug("[Souvenirs] fetch page error:", error.message);
      }
      const rows = data || [];
      // Append or set
      setSouvenirs(prev => reset ? rows : [...prev, ...rows]);
      setPage(currentPage);
      setHasMore(rows.length === PAGE_SIZE);
    } catch (e) {
      console.debug("[Souvenirs] fetch exception:", e);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  // Filtrage : n'affiche que les souvenirs où TOUS les selectedUsers sont présents dans tagged_users
  const filteredSouvenirs = selectedUsers.size === 0
    ? souvenirs
    : souvenirs.filter(s => Array.from(selectedUsers).every(uid => s.tagged_users.includes(uid)));

  // Utilitaires pour mapping UID → user
  const userByUid = Object.fromEntries(users.map(u => [u.uid, u]));

  // Réactions (optimiste, pas de persistance ici)
  const handleToggleReaction = (souvenirId: string, emoji: string, currentUserUid: string) => {
    setSouvenirs(prev => prev.map(s => {
      if (s.id !== souvenirId) return s;
      const reactions = s.reactions ? { ...s.reactions } : {};
      const arr = reactions[emoji] || [];
      if (arr.includes(currentUserUid)) {
        reactions[emoji] = arr.filter(uid => uid !== currentUserUid);
      } else {
        reactions[emoji] = [...arr, currentUserUid];
      }
      return { ...s, reactions };
    }));
    // TODO: Persister côté Supabase (patch reactions)
  };

  // Sélection/désélection d'un joueur pour le filtre
  const toggleUserFilter = (uid: string) => {
    setSelectedUsers(prev => {
      const next = new Set(prev);
      if (next.has(uid)) next.delete(uid);
      else next.add(uid);
      return next;
    });
  };

  // Ouvre le modal (affichage détaillé)
  const openModal = (souvenir: Souvenir) => {
    setModalSouvenir(souvenir);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setModalSouvenir(null);
  };

  // Récupérer l'utilisateur courant via Supabase Auth
  const [currentUserUid, setCurrentUserUid] = useState<string | null>(null);
  const hasCurrentUser = Boolean(currentUserUid);
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setCurrentUserUid(data.user?.id ?? null);
    });
  }, []);

  // Infinite scroll sentinel
  const [sentinelEl, setSentinelEl] = useState<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!sentinelEl || !hasMore || loadingMore) return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            console.debug("[Souvenirs] Sentinel visible → load more");
            fetchSouvenirs(false);
          }
        });
      },
      { root: null, rootMargin: "300px", threshold: 0.01 }
    );
    observer.observe(sentinelEl);
    return () => observer.disconnect();
  }, [sentinelEl, hasMore, loadingMore]);

  return (
    <div className="min-h-screen bg-[#0B0F1C] text-white flex flex-col items-center pb-8">
      {/* Header */}
      <div className="w-full max-w-xl flex items-center justify-between px-4 py-4">
        <h1 className="text-2xl font-bold text-amber-400">Souvenirs partagés <span role="img" aria-label="caméra">📸</span></h1>
        <button className="text-2xl bg-sky-700 hover:bg-sky-600 text-white rounded-full w-10 h-10 flex items-center justify-center shadow-lg transition" onClick={() => setFormOpen(true)}>
          ➕
        </button>
      </div>

      {/* Filtre avatars - mobile first, 6 visibles, scrollable, bulles rondes */}
      <div className="w-full max-w-xl px-3 py-2 mb-3">
        <div className="flex flex-nowrap gap-3 overflow-x-auto scrollbar-hide" style={{ WebkitOverflowScrolling: 'touch' }}>
          {users.map((u) => (
            <div
              key={u.uid}
              onClick={() => toggleUserFilter(u.uid)}
              className={`flex-shrink-0 w-12 h-12 rounded-full border-2 ${selectedUsers.has(u.uid) ? 'border-amber-400 scale-110 shadow-lg' : 'border-transparent'} bg-[#181F2E] flex items-center justify-center transition cursor-pointer`}
              style={{ minWidth: 48, minHeight: 48 }}
            >
              <img
                src={u.avatar || "/avatar-paysage.jpg"}
                alt={u.pseudo}
                className="w-10 h-10 rounded-full object-cover"
                draggable={false}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Mur de souvenirs : galerie 3x3 Instagram */}
      <div className="w-full max-w-xl flex flex-col gap-4 px-2">
        <div className="w-full mt-6">
          {filteredSouvenirs.length === 0 ? (
            <div className="text-gray-400 mt-10 text-center">Aucun souvenir partagé pour cette sélection.</div>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {filteredSouvenirs.map((souvenir) => (
                <div key={souvenir.id} className="flex flex-col w-full">
                  <button
                    className="aspect-square w-full bg-black overflow-hidden rounded-[4px] focus:outline-none"
                    onClick={() => openModal(souvenir)}
                    tabIndex={0}
                    aria-label="Voir le souvenir"
                  >
                    {souvenir.media_type === "image" && (
                      <LazyRevealImage
                        src={souvenir.media_url}
                        alt={souvenir.text || "souvenir"}
                        className="relative w-full h-full"
                        imgClassName="aspect-square"
                      />
                    )}
                  </button>
                  {/* Réactions sous la miniature */}
                  {souvenir.reactions && Object.entries(souvenir.reactions).some(([_, arr]) => arr.length > 0) && (
                    <div className="flex flex-row justify-center items-center gap-2 mt-1 text-sm text-gray-200">
                      {Object.entries(souvenir.reactions).map(([emoji, arr]) =>
                        arr.length > 0 ? (
                          <span key={emoji} className="flex items-center gap-1">
                            {emoji} <span className="font-semibold">{arr.length}</span>
                          </span>
                        ) : null
                      )}
                    </div>
                  )}
                </div>
              ))}
              {/* Infinite scroll sentinel */}
              {hasMore && (
                <div ref={setSentinelEl} className="col-span-3 h-8" aria-hidden />
              )}
            </div>
          )}
        </div>
      </div>

      {/* Modal détail souvenir */}
      {modalOpen && modalSouvenir && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/80 backdrop-blur-sm" onClick={closeModal}>
          <div className="relative bg-[#181F2E] rounded-2xl shadow-xl p-4 max-w-md w-full flex flex-col items-center max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
  {/* Bouton fermer */}
  <button
    className="absolute top-2 right-2 text-gray-400 hover:text-red-400 text-2xl p-1 z-30"
    onClick={closeModal}
    aria-label="Fermer"
    style={{ lineHeight: 1 }}
  >×</button>
            {/* Bouton modifier */}
            {!editMode && (
              <button
                className="absolute top-2 right-12 text-xl text-gray-400 hover:text-amber-400 p-1 rounded-full z-20"
                title="Modifier le souvenir"
                onClick={() => {
                  setEditMode(true);
                  setEditText(modalSouvenir.text || "");
                  setEditTagged(new Set(modalSouvenir.tagged_users));
                }}
                aria-label="Modifier le souvenir"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 3.487a2.06 2.06 0 0 1 2.916 2.915l-9.193 9.193a2 2 0 0 1-.878.51l-3.057.815a.5.5 0 0 1-.614-.614l.815-3.057a2 2 0 0 1 .51-.878l9.193-9.193ZM15.75 6.75l1.5 1.5" />
                </svg>
              </button>
            )}
            {/* Media grand */}
            <div className="w-full aspect-square bg-black mb-2 relative rounded-xl overflow-hidden">
              {modalSouvenir.media_type === "image" ? (
                <LazyRevealImage
                  src={modalSouvenir.media_url}
                  alt={modalSouvenir.text || "souvenir"}
                  className="relative w-full h-full"
                  imgClassName="object-cover w-full h-full rounded-xl"
                />
              ) : (
                <video src={modalSouvenir.media_url} controls className="object-cover w-full h-full rounded-xl" />
              )}
            </div>
            {/* Texte */}
            {editMode ? (
  <>
    <textarea
  className="w-full min-h-[48px] max-h-[120px] rounded-lg bg-[#232B42] text-white p-3 resize-vertical text-base mb-2 focus:outline-none focus:ring-2 focus:ring-amber-400 placeholder-gray-400"
  maxLength={80}
  value={editText}
  onChange={e => setEditText(e.target.value)}
  placeholder="Titre ou description du souvenir"
  style={{ width: '100%', fontSize: '1rem', boxSizing: 'border-box' }}
/>
    {/* Sélection multi-avatar */}
    <div className="mb-2">
      <div className="text-sm text-gray-300 mb-1">Taguer des amis :</div>
      <div className="flex flex-wrap gap-2">
        {users.map(u => (
          <div key={u.uid} onClick={() => {
            setEditTagged(prev => {
              const next = new Set(prev);
              if (next.has(u.uid)) next.delete(u.uid);
              else next.add(u.uid);
              return next;
            });
          }}
            className={`w-9 h-9 rounded-full border-2 ${editTagged.has(u.uid) ? 'border-amber-400 scale-110 shadow-lg' : 'border-transparent'} bg-[#232B42] flex items-center justify-center transition cursor-pointer`}>
            <img src={u.avatar || "/avatar-paysage.jpg"} alt={u.pseudo} className="w-7 h-7 rounded-full object-cover" />
          </div>
        ))}
      </div>
    </div>
    {/* Boutons édition */}
    <div className="flex gap-2 mt-2 w-full">
      <button
        className="flex-1 bg-amber-400 hover:bg-amber-300 text-black font-bold py-2 rounded-xl shadow-lg transition disabled:opacity-60"
        disabled={editLoading}
        onClick={async () => {
          setEditLoading(true);
          setEditError("");
          const { error } = await supabase.from('souvenirs').update({
            text: editText.trim() || null,
            tagged_users: Array.from(editTagged)
          }).eq('id', modalSouvenir.id);
          setEditLoading(false);
          if (error) {
            setEditError(error.message || "Erreur lors de la mise à jour");
          } else {
            setEditMode(false);
            setEditError("");
            // Rafraîchir la liste locale et la modale
            setSouvenirs(prev => prev.map(s => s.id === modalSouvenir.id ? { ...s, text: editText.trim() || null, tagged_users: Array.from(editTagged) } : s));
            setModalSouvenir(s => s ? { ...s, text: editText.trim() || null, tagged_users: Array.from(editTagged) } : s);
          }
        }}
      >Enregistrer les modifications</button>
      <button
        className="flex-1 bg-gray-700 hover:bg-gray-600 text-white font-bold py-2 rounded-xl shadow-lg transition"
        onClick={() => { setEditMode(false); setEditError(""); }}
        disabled={editLoading}
      >Annuler</button>
    </div>
    {editError && <div className="text-red-400 text-center text-sm mt-1">{editError}</div>}
  </>
) : modalSouvenir.text && (
  <div className="text-lg text-white font-semibold mb-2 text-center">{modalSouvenir.text}</div>
)}
{/* Auteur */}
<div className="flex items-center gap-2 mb-3">
              <span className="text-sm text-gray-300">👤 Proposé par</span>
              {userByUid[modalSouvenir.author_uid] && (
                <img src={userByUid[modalSouvenir.author_uid].avatar || "/avatar-paysage.jpg"} alt={userByUid[modalSouvenir.author_uid].pseudo} className="w-7 h-7 rounded-full object-cover" />
              )}
              <span className="text-sm font-semibold text-amber-300">{userByUid[modalSouvenir.author_uid]?.pseudo || "?"}</span>
            </div>
            {/* Joueurs tagués */}
            <div className="flex flex-row gap-1 mb-2">
              {modalSouvenir.tagged_users.map(uid => userByUid[uid] && (
                <img key={uid} src={userByUid[uid].avatar || "/avatar-paysage.jpg"} alt={userByUid[uid].pseudo} className="w-7 h-7 rounded-full border-2 border-white/30 object-cover" />
              ))}
            </div>
            {/* Réactions */}
            <div className="flex flex-row gap-2 mb-2">
              {EMOJIS.map(e => (
                <button
                  key={e}
                  className={`rounded-full bg-[#232B42] px-2 py-1 text-lg shadow hover:scale-110 active:scale-95 transition-all border-2 ${currentUserUid && modalSouvenir.reactions?.[e]?.includes(currentUserUid) ? 'border-amber-400' : 'border-transparent'}`}
                  onClick={() => currentUserUid && handleToggleReaction(modalSouvenir.id, e, currentUserUid)}
                  disabled={!currentUserUid}
                >
                  {e} <span className="text-xs font-semibold">{modalSouvenir.reactions?.[e]?.length || ""}</span>
                </button>
              ))}
            </div>
            {/* Menu suppression */}
            <button className="absolute top-2 right-2 text-2xl text-gray-400 hover:text-red-400 p-1 rounded-full" title="Demander la suppression">
              ⋮
            </button>
            <button className="mt-3 text-gray-300 hover:text-red-400 text-sm underline" onClick={closeModal}>Fermer</button>
          </div>
        </div>
      )}
    {/* Modal formulaire d’ajout de souvenir */}
    {formOpen && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm" onClick={() => setFormOpen(false)}>
        <div className="relative bg-[#181F2E] rounded-2xl shadow-xl p-5 max-w-md w-full flex flex-col items-center mx-2" onClick={e => e.stopPropagation()}>
          <h2 className="text-xl font-bold text-amber-400 mb-3">Nouveau souvenir 📸</h2>
          <form className="w-full flex flex-col gap-4" onSubmit={handleSubmit}>
            {/* Image upload */}
            <label className="flex flex-col items-center gap-2 cursor-pointer">
              {imagePreview ? (
                <img src={imagePreview} alt="preview" className="w-32 h-32 rounded-xl object-cover border-2 border-sky-400" />
              ) : (
                <div className="w-32 h-32 flex items-center justify-center rounded-xl bg-[#232B42] text-sky-300 text-4xl border-2 border-dashed border-sky-400">📸</div>
              )}
              <input type="file" accept="image/*" className="hidden" onChange={handleImageChange} required />
              <span className="text-xs text-gray-400">Image obligatoire</span>
            </label>
            {/* Texte */}
            <textarea
              className="w-full rounded-lg bg-[#232B42] text-white p-2 resize-none text-base"
              maxLength={80}
              placeholder="Un souvenir à partager ?…"
              value={formText}
              onChange={e => setFormText(e.target.value)}
            />
            {/* Joueurs tagués */}
            <div>
              <div className="text-sm text-gray-300 mb-2">Taguer des amis :</div>
              <div className="flex flex-wrap gap-2">
                {users.map(u => (
                  <div key={u.uid} onClick={() => toggleTagUser(u.uid)}
                    className={`w-10 h-10 rounded-full border-2 ${formTagged.has(u.uid) ? 'border-amber-400 scale-110 shadow-lg' : 'border-transparent'} bg-[#232B42] flex items-center justify-center transition cursor-pointer`}>
                    <img src={u.avatar || "/avatar-paysage.jpg"} alt={u.pseudo} className="w-8 h-8 rounded-full object-cover" />
                  </div>
                ))}
              </div>
            </div>
            {/* Bouton publier */}
            <button type="submit" className="w-full bg-amber-400 hover:bg-amber-300 text-black font-bold py-2 rounded-xl mt-2 text-lg shadow-lg transition disabled:opacity-60" disabled={formLoading || !hasCurrentUser}>
              {formLoading ? "Publication…" : "Publier"}
            </button>
            {formError && <div className="text-red-400 text-center text-sm mt-1">{formError}</div>}
          </form>
          <button className="absolute top-2 right-2 text-gray-400 hover:text-red-400 text-2xl p-1" onClick={() => setFormOpen(false)} aria-label="Fermer">×</button>
        </div>
      </div>
    )}
  </div>
  );
}
