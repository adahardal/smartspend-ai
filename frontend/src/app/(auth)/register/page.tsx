"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function RegisterPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleRegister(e?: React.FormEvent) {
    e?.preventDefault();
    setLoading(true);
    setMessage("");

    const supabase = createClient();
    const { error } = await supabase.auth.signUp({ email, password });

    if (error) {
      setMessage("Hata: " + error.message);
    } else {
      setMessage("Kayıt başarılı! E-postana doğrulama linki gönderildi.");
    }
    setLoading(false);
  }

  async function handleGoogleLogin() {
    setMessage("");
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      setMessage("Hata: " + error.message);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-4">
        <h1 className="text-2xl font-bold">SmartSpend AI — Kayıt Ol</h1>

        <form onSubmit={handleRegister} className="space-y-4">
          <input
            type="email"
            placeholder="E-posta"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded border p-2"
          />

          <input
            type="password"
            placeholder="Şifre (en az 6 karakter)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded border p-2"
          />

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded bg-black p-2 text-white disabled:opacity-50"
          >
            {loading ? "Kaydediliyor..." : "Kayıt Ol"}
          </button>
        </form>

        {message && <p className="text-sm">{message}</p>}

        <div className="flex items-center gap-2 text-xs text-gray-400">
          <div className="h-px flex-1 bg-gray-200" />
          veya
          <div className="h-px flex-1 bg-gray-200" />
        </div>

        <button
          onClick={handleGoogleLogin}
          className="w-full rounded border p-2 font-medium hover:bg-gray-50"
        >
          Google ile Devam Et
        </button>
      </div>
    </main>
  );
}