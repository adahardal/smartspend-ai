"use client";

import { AlertTriangle, Bell, BellOff, Settings as SettingsIcon, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { createClient } from "@/lib/supabase/client";
import {
  getCurrentPushSubscription,
  isPushSupported,
  subscribeToPush,
  unsubscribeFromPush,
} from "@/lib/push";

const DELETE_CONFIRM_WORD = "SİL";

export default function SettingsPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [periodStartDay, setPeriodStartDay] = useState("");
  const [loading, setLoading] = useState(true);
  const [savingName, setSavingName] = useState(false);
  const [savingPeriod, setSavingPeriod] = useState(false);
  const [nameMessage, setNameMessage] = useState("");
  const [periodMessage, setPeriodMessage] = useState("");

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  const [pushSubscribed, setPushSubscribed] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);
  const [pushMessage, setPushMessage] = useState("");

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

    getCurrentPushSubscription().then((sub) => setPushSubscribed(!!sub));
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

  async function handleEnablePush() {
    setPushBusy(true);
    setPushMessage("");
    const result = await subscribeToPush();
    if (result.ok) {
      setPushSubscribed(true);
    } else {
      setPushMessage(result.error ?? "Bildirimler açılamadı");
    }
    setPushBusy(false);
  }

  async function handleDisablePush() {
    setPushBusy(true);
    setPushMessage("");
    await unsubscribeFromPush();
    setPushSubscribed(false);
    setPushBusy(false);
  }

  async function handleDeleteAccount() {
    setDeleting(true);
    setDeleteError("");

    const res = await apiFetch("/api/v1/settings/account", { method: "DELETE" });
    if (res.ok) {
      const supabase = createClient();
      await supabase.auth.signOut();
      router.push("/login");
      router.refresh();
    } else {
      setDeleteError("Hesap silinemedi. Tekrar dene.");
      setDeleting(false);
    }
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

      {isPushSupported() && (
        <div
          className="animate-fade-in-up mt-4 space-y-3 rounded-xl border bg-white p-4 shadow-sm"
          style={{ animationDelay: "90ms" }}
        >
          <h2 className="font-semibold">Bildirimler</h2>
          <p className="text-sm text-gray-500">
            Bir bütçenin limitine yaklaştığında (%80 ve üzeri) telefonuna/tarayıcına
            bildirim gönderelim.
          </p>
          {pushSubscribed ? (
            <button
              onClick={handleDisablePush}
              disabled={pushBusy}
              className="flex items-center gap-1.5 rounded-lg border px-4 py-2 text-sm font-medium transition-colors hover:bg-gray-50 disabled:opacity-50"
            >
              <BellOff className="h-4 w-4" />
              {pushBusy ? "İşleniyor..." : "Bildirimleri Kapat"}
            </button>
          ) : (
            <button
              onClick={handleEnablePush}
              disabled={pushBusy}
              className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-all hover:bg-indigo-700 active:scale-[0.98] disabled:opacity-50"
            >
              <Bell className="h-4 w-4" />
              {pushBusy ? "İşleniyor..." : "Bildirimleri Aç"}
            </button>
          )}
          {pushMessage && <p className="text-sm text-red-600">{pushMessage}</p>}
        </div>
      )}

      <div
        className="animate-fade-in-up mt-4 space-y-3 rounded-xl border border-red-200 bg-white p-4 shadow-sm"
        style={{ animationDelay: "150ms" }}
      >
        <h2 className="flex items-center gap-2 font-semibold text-red-700">
          <AlertTriangle className="h-4 w-4" />
          Tehlikeli Bölge
        </h2>
        <p className="text-sm text-gray-500">
          Hesabını sildiğinde tüm işlemlerin, kategorilerin, bütçelerin,
          aboneliklerin ve ayarların kalıcı olarak silinir. Bu işlem geri
          alınamaz.
        </p>

        {!showDeleteConfirm ? (
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="flex items-center gap-1.5 rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-50"
          >
            <Trash2 className="h-4 w-4" />
            Hesabımı Sil
          </button>
        ) : (
          <div className="space-y-2 rounded-lg bg-red-50 p-3">
            <p className="text-sm font-medium text-red-700">
              Emin misin? Devam etmek için aşağıya{" "}
              <span className="font-bold">{DELETE_CONFIRM_WORD}</span> yaz.
            </p>
            <input
              type="text"
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              className="w-full rounded-lg border border-red-300 p-2 text-sm shadow-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/20"
            />
            <div className="flex gap-2">
              <button
                onClick={handleDeleteAccount}
                disabled={deleteConfirmText !== DELETE_CONFIRM_WORD || deleting}
                className="flex items-center gap-1.5 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition-all hover:bg-red-700 active:scale-[0.98] disabled:opacity-50"
              >
                <Trash2 className="h-4 w-4" />
                {deleting ? "Siliniyor..." : "Kalıcı Olarak Sil"}
              </button>
              <button
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setDeleteConfirmText("");
                  setDeleteError("");
                }}
                className="rounded-lg border px-4 py-2 text-sm hover:bg-gray-50"
              >
                Vazgeç
              </button>
            </div>
            {deleteError && <p className="text-sm text-red-600">{deleteError}</p>}
          </div>
        )}
      </div>
    </div>
  );
}
