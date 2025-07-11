"use client";
import { useState } from "react";
import { supabase } from "@/utils/supabaseClient";

export default function NewAuctionButton({ onCreated }: { onCreated?: () => void }) {
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState("");

  // Debug logs & comments for easier debug & readability
  const handleCreateAuction = async () => {
    setLoading(true);
    setFeedback("");
    try {
      // Construction de l'objet enchère
      const payload = {
        lot_title: "1 carte aléatoire",
        lot_description: "Commune ou rare",
        lot_image: "carte unique.png",
        current_bid: 1,
        current_leader_uid: null,
        deadline: "2025-07-18T20:00:00.000Z", // 22h heure de Paris = 20h UTC
        statut: "en_cours"
      };
      console.debug("[ADMIN][AUCTION] Payload envoyé:", payload);
      const { error } = await supabase.from("enchere").insert(payload);
      if (error) {
        setFeedback("❌ Erreur création: " + error.message);
        console.error("[ADMIN][AUCTION] Erreur création:", error);
      } else {
        setFeedback("✅ Nouvelle enchère créée !");
        if (onCreated) onCreated();
      }
    } catch (e: any) {
      setFeedback("❌ Exception JS: " + (e.message || e));
      console.error("[ADMIN][AUCTION] Exception JS:", e);
    }
    setLoading(false);
  };

  return (
    <div className="mt-6 flex flex-col items-center">
      <button
        className="bg-yellow-500 hover:bg-yellow-600 text-slate-900 font-bold py-2 px-6 rounded-full shadow-lg mt-2 disabled:opacity-60"
        onClick={handleCreateAuction}
        disabled={loading}
      >
        {loading ? "Création..." : "Créer l'enchère 1 carte aléatoire"}
      </button>
      {feedback && <div className="mt-2 text-yellow-200 font-semibold text-center">{feedback}</div>}
    </div>
  );
}
