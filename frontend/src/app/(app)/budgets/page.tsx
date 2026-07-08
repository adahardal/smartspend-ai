"use client";

import { Check, Pencil, Plus, Target, Trash2, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/lib/api";
import { Skeleton } from "@/components/skeleton";

type Category = { id: number; name: string };

type Budget = {
  id: number;
  category_id: number;
  category_name: string;
  amount: number;
  spent: number;
  remaining: number;
};

const currencyFormatter = new Intl.NumberFormat("tr-TR", {
  style: "currency",
  currency: "TRY",
});

export default function BudgetsPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const [categoryId, setCategoryId] = useState("");
  const [amount, setAmount] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editAmount, setEditAmount] = useState("");

  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);

  const loadCategories = useCallback(async () => {
    const res = await apiFetch("/api/v1/categories");
    if (res.ok) setCategories(await res.json());
  }, []);

  const loadBudgets = useCallback(async () => {
    const res = await apiFetch("/api/v1/budgets");
    if (res.ok) setBudgets(await res.json());
    else setMessage("Bütçeler yüklenemedi");
    setLoading(false);
  }, []);

  useEffect(() => {
    loadCategories();
    loadBudgets();
  }, [loadCategories, loadBudgets]);

  const budgetedIds = useMemo(
    () => new Set(budgets.map((b) => b.category_id)),
    [budgets]
  );
  const availableCategories = categories.filter((c) => !budgetedIds.has(c.id));

  async function handleSave() {
    if (!categoryId || !amount) return;
    setSubmitting(true);
    setMessage("");

    const res = await apiFetch("/api/v1/budgets", {
      method: "PUT",
      body: JSON.stringify({
        category_id: Number(categoryId),
        amount: Number(amount),
      }),
    });

    if (res.ok) {
      setCategoryId("");
      setAmount("");
      await loadBudgets();
    } else {
      setMessage("Bütçe kaydedilemedi");
    }
    setSubmitting(false);
  }

  async function handleDelete(id: number) {
    if (!window.confirm("Bu bütçeyi silmek istediğine emin misin?")) return;
    const res = await apiFetch(`/api/v1/budgets/${id}`, { method: "DELETE" });
    if (res.ok) await loadBudgets();
    else setMessage("Bütçe silinemedi");
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
    if (!window.confirm(`${selectedIds.size} bütçeyi silmek istediğine emin misin?`)) return;

    setBulkDeleting(true);
    const results = await Promise.all(
      [...selectedIds].map((id) => apiFetch(`/api/v1/budgets/${id}`, { method: "DELETE" }))
    );
    if (results.some((r) => !r.ok)) setMessage("Bazı bütçeler silinemedi");
    setSelectedIds(new Set());
    await loadBudgets();
    setBulkDeleting(false);
  }

  function startEdit(b: Budget) {
    setEditingId(b.id);
    setEditAmount(String(b.amount));
    setMessage("");
  }

  async function handleUpdate(b: Budget) {
    if (!editAmount) return;
    const res = await apiFetch("/api/v1/budgets", {
      method: "PUT",
      body: JSON.stringify({
        category_id: b.category_id,
        amount: Number(editAmount),
      }),
    });
    if (res.ok) {
      setEditingId(null);
      setEditAmount("");
      await loadBudgets();
    } else {
      setMessage("Bütçe güncellenemedi");
    }
  }

  return (
    <div className="animate-fade-in-up">
      <h1 className="flex items-center gap-2 text-2xl font-bold">
        <Target className="h-6 w-6" />
        Bütçeler
      </h1>
      <p className="mt-1 text-sm text-gray-500">
        Kategori bazında aylık harcama limiti belirle, bu ay ne kadarını
        kullandığını takip et.
      </p>

      <div className="mt-6 space-y-3 rounded-xl border bg-white p-4 shadow-sm">
        <h2 className="font-semibold">Bütçe Ekle / Güncelle</h2>
        <div className="flex flex-wrap gap-2">
          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className="rounded-lg border p-2 text-sm"
          >
            <option value="">Kategori seç</option>
            {availableCategories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <input
            type="number"
            placeholder="Aylık limit"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-40 rounded-lg border p-2 text-sm"
          />
          <button
            onClick={handleSave}
            disabled={submitting || !categoryId || !amount}
            className="flex items-center gap-1 rounded-lg bg-indigo-600 px-4 text-sm font-medium text-white transition-all hover:bg-indigo-700 active:scale-[0.98] disabled:opacity-50"
          >
            <Plus className="h-4 w-4" />
            Kaydet
          </button>
        </div>
        {availableCategories.length === 0 && categories.length > 0 && (
          <p className="text-sm text-gray-500">
            Tüm kategoriler için bütçe belirlenmiş. Değiştirmek için aşağıdan
            silip yeniden ekleyebilirsin.
          </p>
        )}
        {message && <p className="text-sm text-red-600">{message}</p>}
      </div>

      <div className="mt-6 space-y-3">
        {loading && (
          <>
            {[0, 1, 2].map((i) => (
              <div key={i} className="rounded-xl border bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-4" />
                </div>
                <Skeleton className="mt-3 h-2 w-full" />
                <div className="mt-2 flex justify-between">
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="h-3 w-16" />
                </div>
              </div>
            ))}
          </>
        )}
        {!loading && budgets.length === 0 && (
          <div className="animate-fade-in-up rounded-xl border bg-white p-4 text-sm text-gray-500 shadow-sm">
            Henüz bütçe yok. Yukarıdan bir kategori için limit belirle.
          </div>
        )}
        {!loading && selectedIds.size > 0 && (
          <div className="animate-fade-in-up flex items-center justify-between rounded-xl border border-indigo-200 bg-indigo-50 p-3 text-sm">
            <span className="font-medium text-indigo-700">
              {selectedIds.size} bütçe seçili
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
        {budgets.map((b, i) => {
          const ratio = b.amount > 0 ? b.spent / b.amount : 0;
          const pct = Math.min(ratio * 100, 100);
          const over = b.remaining < 0;
          const barColor = over
            ? "bg-red-500"
            : ratio >= 0.8
              ? "bg-amber-500"
              : "bg-green-500";
          return (
            <div
              key={b.id}
              className="animate-fade-in-up rounded-xl border bg-white p-4 shadow-sm transition-shadow hover:shadow-md"
              style={{ animationDelay: `${i * 50}ms` }}
            >
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 font-medium">
                  <input
                    type="checkbox"
                    checked={selectedIds.has(b.id)}
                    onChange={() => toggleSelected(b.id)}
                    className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500/40"
                    aria-label="Bütçeyi seç"
                  />
                  {b.category_name}
                </span>
                {editingId === b.id ? (
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      value={editAmount}
                      onChange={(e) => setEditAmount(e.target.value)}
                      className="w-28 rounded border p-1 text-sm"
                      autoFocus
                    />
                    <button
                      onClick={() => handleUpdate(b)}
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
                      onClick={() => startEdit(b)}
                      className="text-gray-400 hover:text-black"
                      aria-label="Bütçeyi düzenle"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(b.id)}
                      className="text-gray-400 hover:text-red-600"
                      aria-label="Bütçeyi sil"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </div>

              <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-gray-100">
                <div
                  className={`h-full rounded-full transition-[width] duration-500 ease-out ${barColor}`}
                  style={{ width: `${pct}%` }}
                />
              </div>

              <div className="mt-2 flex justify-between text-sm">
                <span className="text-gray-500">
                  {currencyFormatter.format(b.spent)} /{" "}
                  {currencyFormatter.format(b.amount)}
                </span>
                <span className={over ? "font-medium text-red-600" : "text-gray-600"}>
                  {over
                    ? `${currencyFormatter.format(-b.remaining)} aşıldı`
                    : `${currencyFormatter.format(b.remaining)} kaldı`}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
