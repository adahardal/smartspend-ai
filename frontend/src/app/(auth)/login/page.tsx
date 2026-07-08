"use client";

import { Wallet } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { AuthBrandPanel } from "@/components/auth-brand-panel";
import { GoogleIcon } from "@/components/google-icon";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleLogin(e?: React.FormEvent) {
    e?.preventDefault();
    setLoading(true);
    setMessage("");

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setMessage("Hata: " + error.message);
      setLoading(false);
    } else {
      router.push("/dashboard");
    }
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
    <main className="flex min-h-screen">
      <AuthBrandPanel />

      <div className="flex w-full flex-col justify-center px-6 py-12 lg:w-1/2 lg:px-16">
        <div className="mx-auto w-full max-w-sm">
          <div className="mb-8 flex items-center gap-2 text-lg font-semibold lg:hidden">
            <Wallet className="h-6 w-6 text-indigo-600" />
            SmartSpend AI
          </div>

          <h1 className="text-2xl font-bold text-gray-900">Tekrar hoş geldin</h1>
          <p className="mt-1 text-sm text-gray-500">
            Devam etmek için hesabına giriş yap.
          </p>

          <form onSubmit={handleLogin} className="mt-6 space-y-4">
            <div>
              <label htmlFor="email" className="mb-1 block text-sm font-medium text-gray-700">
                E-posta
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="ornek@eposta.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border p-2.5 text-sm shadow-sm transition-colors focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>

            <div>
              <label htmlFor="password" className="mb-1 block text-sm font-medium text-gray-700">
                Şifre
              </label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg border p-2.5 text-sm shadow-sm transition-colors focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-indigo-600 p-2.5 text-sm font-medium text-white shadow-sm transition-all hover:bg-indigo-700 active:scale-[0.98] disabled:opacity-50"
            >
              {loading ? "Giriş yapılıyor..." : "Giriş Yap"}
            </button>
          </form>

          {message && (
            <p className="mt-3 rounded-lg bg-red-50 p-2.5 text-sm text-red-600">{message}</p>
          )}

          <div className="my-6 flex items-center gap-2 text-xs text-gray-400">
            <div className="h-px flex-1 bg-gray-200" />
            veya
            <div className="h-px flex-1 bg-gray-200" />
          </div>

          <button
            onClick={handleGoogleLogin}
            className="flex w-full items-center justify-center gap-2 rounded-lg border p-2.5 text-sm font-medium shadow-sm transition-colors hover:bg-gray-50"
          >
            <GoogleIcon className="h-4 w-4" />
            Google ile Giriş Yap
          </button>

          <p className="mt-6 text-center text-sm text-gray-500">
            Hesabın yok mu?{" "}
            <Link href="/register" className="font-medium text-indigo-600 hover:text-indigo-700">
              Kayıt ol
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
