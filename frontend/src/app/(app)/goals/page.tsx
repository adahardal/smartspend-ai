"use client";

import { Check, Minus, Pencil, PiggyBank, Plus, Trash2, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { DateField } from "@/components/date-field";
import { Skeleton } from "@/components/skeleton";

type Goal = {
  id: number;
  name: string;
  target_amount: number;
  current_amount: number;
  target_date: string | null;
  remaining: number;
  percent: number;
  completed: boolean;
};

const currencyFormatter = new Intl.NumberFormat("tr-TR", {
  style: "currency",
  currency: "TRY",
});

const dateFormatter = new Intl.DateTimeFormat("tr-TR", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

export default function GoalsPage() {
  const [goals, setGoals] = useState<Goal[] | null>(null);
  const [error, setError] = useState("");

  const [name, setName] = useState("");
  const [targetAmount, setTargetAmount] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editTarget, setEditTarget] = useState("");
  const [editDate, setEditDate] = useState("");

  const [contributingId, setContributingId] = useState<number | null>(null);
  const [contributeAmount, setContributeAmount] = useState("");

  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);

  const loadGoals = useCallback(async () => {
    const res = await apiFetch("/api/v1/savings-goals");
    if (res.ok) setGoals(await res.json());
    else setError("Hedefler yüklenemedi");
  }, []);

  useEffect(() => {
    loadGoals();
  }, [loadGoals]);

  async function handleAdd() {
    if (!name.trim() || !targetAmount) return;
    setSubmitting(true);
    setError("");

    const res = await apiFetch("/api/v1/savings-goals", {
      method: "POST",
      body: JSON.stringify({
        name: name.trim(),
        target_amount: Number(targetAmount),
        target_date: targetDate || null,
      }),
    });

    if (res.ok) {
      setName("");
      setTargetAmount("");
      setTargetDate("");
      await loadGoals();
    } else {
      setError("Hedef eklenemedi");
    }
    setSubmitting(false);
  }

  function startEdit(g: Goal) {
    setEditingId(g.id);
    setEditName(g.name);
    setEditTarget(String(g.target_amount));
    setEditDate(g.target_date ?? "");
  }

  async function handleUpdate(g: Goal) {
    if (!editName.trim() || !editTarget) return;
    const res = await apiFetch(`/api/v1/savings-goals/${g.id}`, {
      method: "PUT",
      body: JSON.stringify({
        name: editName.trim(),
        target_amount: Number(editTarget),
        target_date: editDate || null,
      }),
    });
    if (res.ok) {
      setEditingId(null);
      await loadGoals();
    } else {
      setError("Hedef güncellenemedi");
    }
  }

  async function handleContribute(id: number, sign: 1 | -1) {
    if (!contributeAmount) return;
    const res = await apiFetch(`/api/v1/savings-goals/${id}/contribute`, {
      method: "POST",
      body: JSON.stringify({ amount: sign * Number(contributeAmount) }),
    });
    if (res.ok) {
      setContributingId(null);
      setContributeAmount("");
      await loadGoals();
    } else {
      setError("İşlem yapılamadı");
    }
  }

  async function handleDelete(id: number) {
    if (!window.confirm("Bu hedefi silmek istediğine emin misin?")) return;
    const res = await apiFetch(`/api/v1/savings-goals/${id}`, { method: "DELETE" });
    if (res.ok) await loadGoals();
    else setError("Hedef silinemedi");
  }

  function toggleSelected(id: number) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleBulkDelete() {
    if (selectedIds.size === 0) return;
    if (!window.confirm(`${selectedIds.size} hedefi silmek istediğine emin misin?`)) return;

    setBulkDeleting(true);
    const results = await Promise.all(
      [...selectedIds].map((id) =>
        apiFetch(`/api/v1/savings-goals/${id}`, { method: "DELETE" })
      )
    );
    if (results.some((r) => !r.ok)) setError("Bazı hedefler silinemedi");
    setSelectedIds(new Set());
    await loadGoals();
    setBulkDeleting(false);
  }

  return (
    <div className="animate-fade-in-up">
      <h1 className="flex items-center gap-2 text-2xl font-bold">
        <PiggyBank className="h-6 w-6" />
        Tasarruf Hedefleri
      </h1>
      <p className="mt-1 text-sm text-gray-500">
        Bir hedef koy (ör. tatil için 10.000 TL), zamanla ne kadar biriktirdiğini
        işle.
      </p>

      <div className="mt-6 space-y-3 rounded-xl border bg-white p-4 shadow-sm">
        <h2 className="font-semibold">Yeni Hedef</h2>
        <div className="flex flex-wrap gap-2">
          <input
            type="text"
            placeholder="Hedef adı"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-40 rounded-lg border p-2 text-sm"
          />
          <input
            type="number"
            placeholder="Hedef tutar"
            value={targetAmount}
            onChange={(e) => setTargetAmount(e.target.value)}
            className="w-32 rounded-lg border p-2 text-sm"
          />
          <DateField
            value={targetDate}
            onChange={setTargetDate}
            placeholder="Hedef tarih (opsiyonel)"
          />
          <button
            onClick={handleAdd}
            disabled={submitting || !name.trim() || !targetAmount}
            className="flex items-center gap-1 rounded-lg bg-indigo-600 px-4 text-sm font-medium text-white transition-all hover:bg-indigo-700 active:scale-[0.98] disabled:opacity-50"
          >
            <Plus className="h-4 w-4" />
            Ekle
          </button>
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>

      {goals === null && (
        <div className="mt-6 space-y-3">
          {[0, 1].map((i) => (
            <div key={i} className="rounded-xl border bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-16" />
              </div>
              <Skeleton className="mt-3 h-2 w-full" />
            </div>
          ))}
        </div>
      )}

      {goals !== null && goals.length === 0 && (
        <div className="animate-fade-in-up mt-6 rounded-xl border bg-white p-4 text-sm text-gray-500 shadow-sm">
          Henüz bir hedef yok. Yukarıdan ilk hedefini ekle.
        </div>
      )}

      {goals !== null && selectedIds.size > 0 && (
        <div className="animate-fade-in-up mt-3 flex items-center justify-between rounded-xl border border-indigo-200 bg-indigo-50 p-3 text-sm">
          <span className="font-medium text-indigo-700">
            {selectedIds.size} hedef seçili
          </span>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSelectedIds(new Set())}
              className="text-indigo-600 hover:text-indigo-800"
            >
              Seçimi kaldır
            </button>
            <button
              onClick={handleBulkDelete}
              disabled={bulkDeleting}
              className="flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white transition-all hover:bg-red-700 active:scale-[0.98] disabled:opacity-50"
            >
              <Trash2 className="h-4 w-4" />
              {bulkDeleting ? "Siliniyor..." : "Seçilenleri Sil"}
            </button>
          </div>
        </div>
      )}

      {goals !== null && goals.length > 0 && (
        <div className="mt-4 space-y-3">
          {goals.map((g, i) => (
            <div
              key={g.id}
              className="animate-fade-in-up rounded-xl border bg-white p-4 shadow-sm transition-shadow hover:shadow-md"
              style={{ animationDelay: `${i * 50}ms` }}
            >
              <div className="flex items-center justify-between">
                {editingId === g.id ? (
                  <div className="flex flex-1 flex-wrap items-center gap-1">
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="w-28 rounded border p-1 text-sm"
                      autoFocus
                    />
                    <input
                      type="number"
                      value={editTarget}
                      onChange={(e) => setEditTarget(e.target.value)}
                      className="w-24 rounded border p-1 text-sm"
                    />
                    <DateField value={editDate} onChange={setEditDate} className="text-xs" />
                    <button
                      onClick={() => handleUpdate(g)}
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
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(g.id)}
                      onChange={() => toggleSelected(g.id)}
                      className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500/40"
                      aria-label="Hedefi seç"
                    />
                    <span className="font-medium">{g.name}</span>
                    {g.completed && (
                      <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                        Tamamlandı 🎉
                      </span>
                    )}
                  </div>
                )}

                {editingId !== g.id && (
                  <div className="flex gap-3">
                    <button
                      onClick={() => startEdit(g)}
                      className="text-gray-400 hover:text-black"
                      aria-label="Düzenle"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(g.id)}
                      className="text-gray-400 hover:text-red-600"
                      aria-label="Sil"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </div>

              <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-gray-100">
                <div
                  className={`h-full rounded-full transition-[width] duration-500 ease-out ${
                    g.completed ? "bg-green-500" : "bg-indigo-600"
                  }`}
                  style={{ width: `${g.percent}%` }}
                />
              </div>

              <div className="mt-2 flex items-center justify-between text-sm">
                <span className="text-gray-500">
                  {currencyFormatter.format(g.current_amount)} /{" "}
                  {currencyFormatter.format(g.target_amount)} (%{g.percent.toFixed(0)})
                </span>
                {g.target_date && (
                  <span className="text-gray-400">
                    Hedef: {dateFormatter.format(new Date(`${g.target_date}T00:00:00`))}
                  </span>
                )}
              </div>

              {contributingId === g.id ? (
                <div className="mt-3 flex items-center gap-2">
                  <input
                    type="number"
                    placeholder="Tutar"
                    value={contributeAmount}
                    onChange={(e) => setContributeAmount(e.target.value)}
                    className="w-28 rounded-lg border p-1.5 text-sm"
                    autoFocus
                  />
                  <button
                    onClick={() => handleContribute(g.id, 1)}
                    disabled={!contributeAmount}
                    className="flex items-center gap-1 rounded-lg bg-green-600 px-2.5 py-1.5 text-xs font-medium text-white transition-all hover:bg-green-700 active:scale-[0.98] disabled:opacity-50"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Ekle
                  </button>
                  <button
                    onClick={() => handleContribute(g.id, -1)}
                    disabled={!contributeAmount}
                    className="flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors hover:bg-gray-50 disabled:opacity-50"
                  >
                    <Minus className="h-3.5 w-3.5" />
                    Çıkar
                  </button>
                  <button
                    onClick={() => {
                      setContributingId(null);
                      setContributeAmount("");
                    }}
                    className="text-sm text-gray-400 hover:text-black"
                  >
                    Vazgeç
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setContributingId(g.id)}
                  className="mt-3 text-sm font-medium text-indigo-600 hover:text-indigo-800"
                >
                  Para ekle/çıkar
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
