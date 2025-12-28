"use client";
import { useState } from "react";
import { supabase } from "@/utils/supabaseClient";

interface NewAuctionButtonProps {
  onCreated?: () => void;
  lotTitle?: string;
  lotDescription?: string;
  lotImage?: string;
  currentBid?: number;
  deadlineIso?: string; // ISO string in UTC
  label?: string;
}

export default function NewAuctionButton({
  onCreated,
  lotTitle = "1 carte aléatoire",
  lotDescription = "Commune ou rare",
  lotImage = "carte unique.png",
  currentBid = 1,
  deadlineIso = "2025-07-18T20:00:00.000Z", // 22h heure de Paris = 20h UTC
  label = "Créer l'enchère 1 carte aléatoire",
}: NewAuctionButtonProps) {
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState("");

  // Debug logs & comments for easier debug & readability
  const handleCreateAuction = async () => {
    setLoading(true);
    setFeedback("");
    try {
      // 1) Clôture préventive des enchères en cours pour éviter les doublons d'état
      console.debug("[ADMIN][AUCTION] Close existing 'en_cours' before insert");
      const { error: closeErr } = await supabase
        .from("enchere")
        .update({ statut: "terminee" })
        .eq("statut", "en_cours");
      if (closeErr) {
        console.warn("[ADMIN][AUCTION] Erreur clôture en_cours:", closeErr);
      }

      // 2) Construction de l'objet enchère
      const payload = {
        lot_title: lotTitle,
        lot_description: lotDescription,
        lot_image: lotImage,
        current_bid: currentBid,
        current_leader_uid: null as string | null,
        deadline: deadlineIso,
        statut: "en_cours",
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
        {loading ? "Création..." : label}
      </button>
      {feedback && <div className="mt-2 text-yellow-200 font-semibold text-center">{feedback}</div>}
    </div>
  );
}
