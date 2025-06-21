"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/utils/supabaseClient";

export default function LoginPage() {
  const [pseudo, setPseudo] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    // Auth: login with pseudo/password (using email as pseudo@narval.app)
    const { error } = await supabase.auth.signInWithPassword({
      email: `${pseudo}@narval.app`,
      password,
    });
    if (error) {
      setError("Identifiants invalides");
    } else {
      router.push("/");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0B0F1C]">
      <form
        onSubmit={handleLogin}
        className="bg-[#1E293B] p-8 rounded-2xl shadow-lg w-full max-w-sm space-y-6"
      >
        <h1 className="text-2xl font-bold text-[#38BDF8] text-center">Connexion</h1>
        <input
          type="text"
          placeholder="Pseudo"
          value={pseudo}
          onChange={e => setPseudo(e.target.value)}
          className="w-full p-3 rounded-md bg-[#0B0F1C] text-white border border-[#38BDF8] focus:outline-none"
          required
        />
        <input
          type="password"
          placeholder="Mot de passe"
          value={password}
          onChange={e => setPassword(e.target.value)}
          className="w-full p-3 rounded-md bg-[#0B0F1C] text-white border border-[#38BDF8] focus:outline-none"
          required
        />
        {error && <div className="text-[#EF4444] text-center">{error}</div>}
        <button
          type="submit"
          className="w-full bg-[#38BDF8] text-black font-semibold py-3 rounded-lg hover:bg-[#0EA5E9] transition"
        >
          Se connecter
        </button>
      </form>
    </div>
  );
}
