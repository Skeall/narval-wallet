"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/utils/supabaseClient";

export default function LogoutPage() {
  const router = useRouter();

  useEffect(() => {
    const doLogout = async () => {
      await supabase.auth.signOut();
      // Efface potentiellement d'autres infos locales si besoin ici
      router.replace("/"); // Redirige vers la home après déconnexion
    };
    doLogout();
  }, [router]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#0B0F1C]">
      <div className="text-2xl font-bold text-amber-400 mb-4">Déconnexion…</div>
      <div className="text-gray-300 text-base">Merci d'avoir utilisé Narval !</div>
    </div>
  );
}
