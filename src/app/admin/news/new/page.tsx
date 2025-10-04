"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/utils/supabaseClient";

export default function AdminNewsNewPage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [authorized, setAuthorized] = useState<boolean | null>(null);

  // debug: guard route - only admin users allowed
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const { data: auth } = await supabase.auth.getUser();
        const uid = auth.user?.id;
        if (!uid) {
          setAuthorized(false);
          return;
        }
        const { data: user } = await supabase
          .from("users")
          .select("role")
          .eq("uid", uid)
          .single();
        const isAdmin = user?.role === "admin" || user?.role === "superadmin";
        setAuthorized(!!isAdmin);
      } catch (e) {
        console.log("[AdminNewsNew][auth] error", e);
        setAuthorized(false);
      }
    };
    checkAuth();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);
    if (!title.trim() || !description.trim()) {
      setErrorMsg("Titre et description sont requis.");
      return;
    }
    setSubmitting(true);
    try {
      // debug: insert news (created_at should default server-side). Fallback client time.
      const payload: any = {
        title: title.trim(),
        description: description.trim(),
      };
      if (imageUrl.trim()) payload.image_url = imageUrl.trim();
      const { error } = await supabase.from("news").insert(payload);
      if (error) throw error;
      router.push("/admin/news");
    } catch (e: any) {
      console.log("[AdminNewsNew][insert] error", e);
      setErrorMsg(e.message || "Impossible d'ajouter la news.");
    } finally {
      setSubmitting(false);
    }
  }

  if (authorized === null) {
    return (
      <div className="min-h-screen bg-[#0B0F1C] text-white flex items-center justify-center">Vérification…</div>
    );
  }
  if (authorized === false) {
    return (
      <div className="min-h-screen bg-[#0B0F1C] text-white flex items-center justify-center">Accès refusé</div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0B0F1C] text-white flex flex-col items-center py-8">
      <div className="w-full max-w-xl px-4">
        <h1 className="text-xl font-extrabold text-sky-300 drop-shadow-glow mb-4">Ajouter une news</h1>
        <form onSubmit={handleSubmit} className="bg-[#171C2B] rounded-2xl border border-[#232B42] p-4 flex flex-col gap-4">
          <div>
            <label className="block text-sm text-gray-300 mb-1">Titre</label>
            <input
              className="w-full rounded-xl bg-[#0B0F1C] border border-[#232B42] px-3 py-2 outline-none focus:border-sky-500"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Titre de la nouveauté"
              required
            />
          </div>
          <div>
            <label className="block text-sm text-gray-300 mb-1">Description</label>
            <textarea
              className="w-full rounded-xl bg-[#0B0F1C] border border-[#232B42] px-3 py-2 outline-none focus:border-sky-500 min-h-[140px]"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Description détaillée"
              required
            />
          </div>
          <div>
            <label className="block text-sm text-gray-300 mb-1">Image (URL, optionnelle)</label>
            <input
              className="w-full rounded-xl bg-[#0B0F1C] border border-[#232B42] px-3 py-2 outline-none focus:border-sky-500"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              placeholder="https://…"
            />
          </div>
          {errorMsg && <div className="text-red-400 text-sm">{errorMsg}</div>}
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              className="px-4 py-2 rounded-xl bg-[#2b3146] hover:bg-[#343b55]"
              onClick={() => router.push("/admin/news")}
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 rounded-xl bg-amber-400 text-black font-bold hover:bg-amber-300 disabled:opacity-60"
            >
              {submitting ? "Ajout…" : "Ajouter"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
