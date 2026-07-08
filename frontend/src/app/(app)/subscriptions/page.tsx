"use client";

import { Check, Pencil, Plus, Repeat, Trash2, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { DateField } from "@/components/date-field";
import { Skeleton } from "@/components/skeleton";

type Subscription = {
  description: string;
  category_name: string | null;
  amount: number;
  occurrences: number;
  first_date: string;
  last_date: string;
  next_expected_date: string;
  confidence: "high" | "medium";
};

type ManualSubscription = {
  id: number;
  name: string;
  amount: number;
  category_name: string | null;
  next_billing_date: string | null;
};

type Category = { id: number; name: string };

const currencyFormatter = new Intl.NumberFormat("tr-TR", {
  style: "currency",
  currency: "TRY",
});

const dateFormatter = new Intl.DateTimeFormat("tr-TR", {
  day: "numeric",
  month: "long",
});

export default function SubscriptionsPage() {
  const [subscriptions, setSubscriptions] = useState<Subscription[] | null>(null);
  const [manual, setManual] = useState<ManualSubscription[] | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [error, setError] = useState("");

  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [nextBillingDate, setNextBillingDate] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editAmount, setEditAmount] = useState("");

  const loadManual = useCallback(async () => {
    const res = await apiFetch("/api/v1/insights/subscriptions/manual");
    if (res.ok) setManual(await res.json());
  }, []);

  useEffect(() => {
    apiFetch("/api/v1/insights/subscriptions")
      .then(async (res) => {
        if (!res.ok) throw new Error();
        setSubscriptions(await res.json());
      })
      .catch(() => setError("Abonelikler yüklenemedi"));

    apiFetch("/api/v1/categories").then(async (res) => {
      if (res.ok) setCategories(await res.json());
    });

    loadManual();
  }, [loadManual]);

  const detectedTotal = (subscriptions ?? []).reduce((sum, s) => sum + s.amount, 0);
  const manualTotal = (manual ?? []).reduce((sum, s) => sum + s.amount, 0);
  const total = detectedTotal + manualTotal;

  async function handleAdd() {
    if (!name.trim() || !amount) return;
    setSubmitting(true);
    setError("");

    const res = await apiFetch("/api/v1/insights/subscriptions/manual", {
      method: "POST",
      body: JSON.stringify({
        name: name.trim(),
        amount: Number(amount),
        category_id: categoryId ? Number(categoryId) : null,
        next_billing_date: nextBillingDate || null,
      }),
    });

    if (res.ok) {
      setName("");
      setAmount("");
      setCategoryId("");
      setNextBillingDate("");
      await loadManual();
    } else {
      setError("Abonelik eklenemedi");
    }
    setSubmitting(false);
  }

  async function handleDelete(id: number) {
    if (!window.confirm("Bu aboneliği silmek istediğine emin misin?")) return;
    const res = await apiFetch(`/api/v1/insights/subscriptions/manual/${id}`, {
      method: "DELETE",
    });
    if (res.ok) await loadManual();
    else setError("Abonelik silinemedi");
  }

  function startEdit(s: ManualSubscription) {
    setEditingId(s.id);
    setEditName(s.name);
    setEditAmount(String(s.amount));
  }

  async function handleUpdate(s: ManualSubscription) {
    if (!editName.trim() || !editAmount) return;
    const res = await apiFetch(`/api/v1/insights/subscriptions/manual/${s.id}`, {
      method: "PUT",
      body: JSON.stringify({
        name: editName.trim(),
        amount: Number(editAmount),
        category_id: null,
        next_billing_date: s.next_billing_date,
      }),
    });
    if (res.ok) {
      setEditingId(null);
      await loadManual();
    } else {
      setError("Abonelik güncellenemedi");
    }
  }

  return (
    <div className="animate-fade-in-up">
      <h1 className="flex items-center gap-2 text-2xl font-bold">
        <Repeat className="h-6 w-6" />
        Abonelikler
      </h1>
      <p className="mt-1 text-sm text-gray-500">
        Geçmiş işlemlerinden otomatik tespit edilenler + kendi eklediklerin,
        tek yerde.
      </p>

      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

      {(subscriptions === null || manual === null) && !error && (
        <div className="mt-6 space-y-3">
          <div className="rounded-xl border bg-white p-4 shadow-sm">
            <Skeleton className="h-3 w-28" />
            <Skeleton className="mt-2 h-7 w-40" />
          </div>
          {[0, 1].map((i) => (
            <div key={i} className="rounded-xl border bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-16" />
              </div>
              <Skeleton className="mt-3 h-3 w-32" />
            </div>
          ))}
        </div>
      )}

      {subscriptions !== null && manual !== null && (
        <>
          {total > 0 && (
            <div className="animate-fade-in-up mt-6 rounded-xl border bg-white p-4 shadow-sm">
              <p className="text-sm text-gray-500">Tahmini aylık toplam</p>
              <p className="text-2xl font-bold">{currencyFormatter.format(total)}</p>
            </div>
          )}

          {subscriptions.length === 0 && manual.length === 0 && (
            <div className="animate-fade-in-up mt-6 rounded-xl border bg-white p-4 text-sm text-gray-500 shadow-sm">
              Henüz bir abonelik yok. Aşağıdan kendi ekleyebilir ya da en az
              iki ay tekrar eden işlemlerin otomatik tespit edilmesini
              bekleyebilirsin.
            </div>
          )}

          {subscriptions.length > 0 && (
            <div className="mt-6">
              <h2 className="mb-2 text-sm font-semibold text-gray-700">
                Otomatik Tespit Edilenler
              </h2>
              <div className="space-y-3">
                {subscriptions.map((s, i) => (
                  <div
                    key={s.description}
                    className="animate-fade-in-up rounded-xl border bg-white p-4 shadow-sm transition-shadow hover:shadow-md"
                    style={{ animationDelay: `${80 + i * 50}ms` }}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="font-medium">{s.description}</span>
                        {s.category_name && (
                          <span className="ml-2 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">
                            {s.category_name}
                          </span>
                        )}
                      </div>
                      <span className="font-semibold">
                        {currencyFormatter.format(s.amount)}
                      </span>
                    </div>
                    <div className="mt-2 flex items-center justify-between text-sm text-gray-500">
                      <span>
                        {s.occurrences} kez ·{" "}
                        {s.confidence === "high" ? "yüksek güven" : "olası"}
                      </span>
                      <span>
                        Sıradaki: {dateFormatter.format(new Date(s.next_expected_date))}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="mt-6">
            <h2 className="mb-2 text-sm font-semibold text-gray-700">Eklediklerin</h2>

            <div className="space-y-3 rounded-xl border bg-white p-4 shadow-sm">
              <div className="flex flex-wrap gap-2">
                <input
                  type="text"
                  placeholder="Abonelik adı"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-40 rounded-lg border p-2 text-sm"
                />
                <input
                  type="number"
                  placeholder="Aylık tutar"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-32 rounded-lg border p-2 text-sm"
                />
                <select
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  className="rounded-lg border p-2 text-sm"
                >
                  <option value="">Kategori (opsiyonel)</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
                <DateField
                  value={nextBillingDate}
                  onChange={setNextBillingDate}
                  placeholder="Sıradaki fatura (opsiyonel)"
                />
                <button
                  onClick={handleAdd}
                  disabled={submitting || !name.trim() || !amount}
                  className="flex items-center gap-1 rounded-lg bg-indigo-600 px-4 text-sm font-medium text-white transition-all hover:bg-indigo-700 active:scale-[0.98] disabled:opacity-50"
                >
                  <Plus className="h-4 w-4" />
                  Ekle
                </button>
              </div>
            </div>

            {manual.length > 0 && (
              <div className="mt-3 space-y-3">
                {manual.map((s) => (
                  <div key={s.id} className="rounded-xl border bg-white p-4 shadow-sm">
                    <div className="flex items-center justify-between">
                      {editingId === s.id ? (
                        <div className="flex flex-1 items-center gap-1">
                          <input
                            type="text"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            className="w-32 rounded border p-1 text-sm"
                            autoFocus
                          />
                          <input
                            type="number"
                            value={editAmount}
                            onChange={(e) => setEditAmount(e.target.value)}
                            className="w-24 rounded border p-1 text-sm"
                          />
                        </div>
                      ) : (
                        <div>
                          <span className="font-medium">{s.name}</span>
                          {s.category_name && (
                            <span className="ml-2 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">
                              {s.category_name}
                            </span>
                          )}
                        </div>
                      )}

                      <div className="flex items-center gap-3">
                        {editingId !== s.id && (
                          <span className="font-semibold">
                            {currencyFormatter.format(s.amount)}
                          </span>
                        )}
                        {editingId === s.id ? (
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => handleUpdate(s)}
                              className="text-gray-400 hover:text-green-600"
                              aria-label="Kaydet"
                            >
                              <Check className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => setEditingId(null)}
                              className="text-gray-400 hover:text-black"
                              aria-label="Vazgeç"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex gap-3">
                            <button
                              onClick={() => startEdit(s)}
                              className="text-gray-400 hover:text-black"
                              aria-label="Düzenle"
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleDelete(s.id)}
                              className="text-gray-400 hover:text-red-600"
                              aria-label="Sil"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                    {s.next_billing_date && editingId !== s.id && (
                      <p className="mt-2 text-sm text-gray-500">
                        Sıradaki: {dateFormatter.format(new Date(s.next_billing_date))}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
