"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/utils/supabaseClient";

interface NewsRow {
  id: string;
  title: string;
  description: string;
  image_url?: string | null;
  created_at: string;
}

export default function AdminNewsListPage() {
  const [items, setItems] = useState<NewsRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setErrorMsg(null);
      try {
        // debug: fetch all news ordered by creation desc
        const { data, error } = await supabase
          .from("news")
          .select("id, title, description, image_url, created_at")
          .order("created_at", { ascending: false });
        if (error) throw error;
        setItems((data || []) as NewsRow[]);
      } catch (e: any) {
        console.log("[AdminNews][fetch] error", e);
        setErrorMsg(e.message || "Erreur lors du chargement des news");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  async function handleDelete(id: string) {
    try {
      // debug: delete by id
      const { error } = await supabase.from("news").delete().eq("id", id);
      if (error) throw error;
      setItems(list => list.filter(n => n.id !== id));
    } catch (e) {
      console.log("[AdminNews][delete] error", e);
      alert("Suppression impossible. Voir console.");
    }
  }

  return (
    <div className="min-h-screen bg-[#0B0F1C] text-white flex flex-col items-center py-8">
      <div className="w-full max-w-xl px-4 flex items-center justify-between mb-6">
        <h1 className="text-xl font-extrabold text-sky-300 drop-shadow-glow">Nouveautés</h1>
        <Link
          href="/admin/news/new"
          className="px-4 py-2 bg-amber-400 text-black font-bold rounded-xl hover:bg-amber-300 shadow"
        >
          Ajouter une news
        </Link>
      </div>

      <div className="w-full max-w-xl px-4">
        {loading && <div className="text-gray-400">Chargement…</div>}
        {errorMsg && <div className="text-red-400">{errorMsg}</div>}
        {!loading && items.length === 0 && (
          <div className="text-gray-400">Aucune news.</div>
        )}
        <div className="flex flex-col gap-4">
          {items.map(n => (
            <div key={n.id} className="bg-[#171C2B] rounded-2xl border border-[#232B42] p-4 flex gap-3">
              {n.image_url ? (
                <img src={n.image_url} alt={n.title} className="w-20 h-20 object-cover rounded-lg" />
              ) : (
                <div className="w-20 h-20 rounded-lg bg-[#0B0F1C] border border-[#232B42]" />
              )}
              <div className="flex-1">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-bold text-white">{n.title}</div>
                    <div className="text-xs text-gray-400">{new Date(n.created_at).toLocaleString("fr-FR")}</div>
                  </div>
                  <button
                    onClick={() => handleDelete(n.id)}
                    className="text-xs px-3 py-1 rounded-full bg-[#2b3146] hover:bg-[#343b55]"
                  >
                    Supprimer
                  </button>
                </div>
                <p className="text-gray-300 text-sm mt-2 line-clamp-3">{n.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
