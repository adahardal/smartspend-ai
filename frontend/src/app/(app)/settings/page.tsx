"use client";

import { Settings as SettingsIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { createClient } from "@/lib/supabase/client";

export default function SettingsPage() {
  const [name, setName] = useState("");
  const [periodStartDay, setPeriodStartDay] = useState("");
  const [loading, setLoading] = useState(true);
  const [savingName, setSavingName] = useState(false);
  const [savingPeriod, setSavingPeriod] = useState(false);
  const [nameMessage, setNameMessage] = useState("");
  const [periodMessage, setPeriodMessage] = useState("");

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      setName(data.user?.user_metadata?.full_name ?? "");
    });

    apiFetch("/api/v1/settings")
      .then(async (res) => {
        if (res.ok) {
          const data = await res.json();
          if (data.period_start_day) setPeriodStartDay(String(data.period_start_day));
        }
      })
      .finally(() => setLoading(false));
  }, []);

  async function handleSaveName() {
    if (!name.trim()) return;
    setSavingName(true);
    setNameMessage("");

    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({
      data: { full_name: name.trim() },
    });

    setNameMessage(error ? "İsim kaydedilemedi" : "İsim güncellendi");
    setSavingName(false);
  }

  async function handleSavePeriod() {
    setSavingPeriod(true);
    setPeriodMessage("");

    const day = periodStartDay ? Number(periodStartDay) : null;
    const res = await apiFetch("/api/v1/settings", {
      method: "PUT",
      body: JSON.stringify({ period_start_day: day }),
    });

    setPeriodMessage(res.ok ? "Kaydedildi" : "Kaydedilemedi");
    setSavingPeriod(false);
  }

  if (loading) return null;

  return (
    <div className="animate-fade-in-up max-w-lg">
      <h1 className="flex items-center gap-2 text-2xl font-bold">
        <SettingsIcon className="h-6 w-6" />
        Profil ve Ayarlar
      </h1>

      <div className="mt-6 space-y-3 rounded-xl border bg-white p-4 shadow-sm">
        <h2 className="font-semibold">İsim</h2>
        <p className="text-sm text-gray-500">
          Dashboard'da bu isimle karşılanırsın.
        </p>
        <div className="flex gap-2">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="flex-1 rounded-lg border p-2 text-sm shadow-sm transition-colors focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
          />
          <button
            onClick={handleSaveName}
            disabled={savingName || !name.trim()}
            className="rounded-lg bg-indigo-600 px-4 text-sm font-medium text-white transition-all hover:bg-indigo-700 active:scale-[0.98] disabled:opacity-50"
          >
            {savingName ? "Kaydediliyor..." : "Kaydet"}
          </button>
        </div>
        {nameMessage && <p className="text-sm text-gray-500">{nameMessage}</p>}
      </div>

      <div className="animate-fade-in-up mt-4 space-y-3 rounded-xl border bg-white p-4 shadow-sm" style={{ animationDelay: "60ms" }}>
        <h2 className="font-semibold">Dönem Başlangıç Günü</h2>
        <p className="text-sm text-gray-500">
          Ayın kaçında maaşın/gelir döngün başlıyorsa onu gir. Dashboard&apos;da
          o günden bugüne kadar gerçekleşen gelir-giderine göre &quot;cebindeki
          paran&quot; hesaplanır — henüz gerçekleşmemiş ödemeler (ör. ayın
          8&apos;indeki kira, bugün 7&apos;siyse) düşülmez.
        </p>
        <div className="flex gap-2">
          <input
            type="number"
            min={1}
            max={31}
            placeholder="Örn: 15"
            value={periodStartDay}
            onChange={(e) => setPeriodStartDay(e.target.value)}
            className="w-32 rounded-lg border p-2 text-sm shadow-sm transition-colors focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
          />
          <button
            onClick={handleSavePeriod}
            disabled={savingPeriod}
            className="rounded-lg bg-indigo-600 px-4 text-sm font-medium text-white transition-all hover:bg-indigo-700 active:scale-[0.98] disabled:opacity-50"
          >
            {savingPeriod ? "Kaydediliyor..." : "Kaydet"}
          </button>
        </div>
        {periodMessage && <p className="text-sm text-gray-500">{periodMessage}</p>}
      </div>
    </div>
  );
}
