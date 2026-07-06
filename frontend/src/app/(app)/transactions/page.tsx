"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/lib/api";

type Category = { id: number; name: string };

type Transaction = {
  id: number;
  amount: number;
  type: "income" | "expense";
  category_id: number | null;
  description: string | null;
  date: string;
};

const todayISO = () => new Date().toISOString().slice(0, 10);

const currencyFormatter = new Intl.NumberFormat("tr-TR", {
  style: "currency",
  currency: "TRY",
});

export default function TransactionsPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [message, setMessage] = useState("");

  const [editingId, setEditingId] = useState<number | null>(null);
  const [amount, setAmount] = useState("");
  const [type, setType] = useState<"income" | "expense">("expense");
  const [categoryId, setCategoryId] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(todayISO());
  const [submitting, setSubmitting] = useState(false);

  const [filterType, setFilterType] = useState<"all" | "income" | "expense">("all");
  const [filterCategoryId, setFilterCategoryId] = useState("");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");

  const [newCategoryName, setNewCategoryName] = useState("");
  const [categorySubmitting, setCategorySubmitting] = useState(false);

  const loadCategories = useCallback(async () => {
    const res = await apiFetch("/api/v1/categories");
    if (res.ok) {
      setCategories(await res.json());
    }
  }, []);

  const loadTransactions = useCallback(async () => {
    const params = new URLSearchParams();
    if (filterType !== "all") params.set("type", filterType);
    if (filterCategoryId) params.set("category_id", filterCategoryId);
    if (filterDateFrom) params.set("date_from", filterDateFrom);
    if (filterDateTo) params.set("date_to", filterDateTo);

    const res = await apiFetch(`/api/v1/transactions?${params.toString()}`);
    if (res.ok) {
      setTransactions(await res.json());
    } else {
      setMessage("İşlemler yüklenemedi");
    }
  }, [filterType, filterCategoryId, filterDateFrom, filterDateTo]);

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  useEffect(() => {
    loadTransactions();
  }, [loadTransactions]);

  function resetForm() {
    setEditingId(null);
    setAmount("");
    setType("expense");
    setCategoryId("");
    setDescription("");
    setDate(todayISO());
  }

  function startEditing(t: Transaction) {
    setEditingId(t.id);
    setAmount(String(t.amount));
    setType(t.type);
    setCategoryId(t.category_id ? String(t.category_id) : "");
    setDescription(t.description ?? "");
    setDate(t.date);
  }

  async function handleSubmitTransaction() {
    setSubmitting(true);
    setMessage("");

    const payload = {
      amount: Number(amount),
      type,
      category_id: categoryId ? Number(categoryId) : null,
      description: description || null,
      date,
    };

    const res = await apiFetch(
      editingId ? `/api/v1/transactions/${editingId}` : "/api/v1/transactions",
      {
        method: editingId ? "PUT" : "POST",
        body: JSON.stringify(payload),
      }
    );

    if (res.ok) {
      resetForm();
      await loadTransactions();
    } else {
      setMessage(editingId ? "İşlem güncellenemedi" : "İşlem eklenemedi");
    }
    setSubmitting(false);
  }

  async function handleDeleteTransaction(id: number) {
    if (!window.confirm("Bu işlemi silmek istediğine emin misin?")) return;

    const res = await apiFetch(`/api/v1/transactions/${id}`, { method: "DELETE" });
    if (res.ok) {
      if (editingId === id) resetForm();
      await loadTransactions();
    } else {
      setMessage("İşlem silinemedi");
    }
  }

  async function handleAddCategory() {
    setCategorySubmitting(true);
    setMessage("");

    const res = await apiFetch("/api/v1/categories", {
      method: "POST",
      body: JSON.stringify({ name: newCategoryName }),
    });

    if (res.ok) {
      setNewCategoryName("");
      await loadCategories();
    } else {
      setMessage("Kategori eklenemedi");
    }
    setCategorySubmitting(false);
  }

  async function handleDeleteCategory(id: number) {
    if (!window.confirm("Bu kategoriyi silmek istediğine emin misin?")) return;

    const res = await apiFetch(`/api/v1/categories/${id}`, { method: "DELETE" });
    if (res.ok) {
      if (categoryId === String(id)) setCategoryId("");
      if (filterCategoryId === String(id)) setFilterCategoryId("");
      await loadCategories();
      await loadTransactions();
    } else {
      setMessage("Kategori silinemedi");
    }
  }

  function categoryName(id: number | null) {
    if (id === null) return "—";
    return categories.find((c) => c.id === id)?.name ?? "—";
  }

  const totals = useMemo(() => {
    const income = transactions
      .filter((t) => t.type === "income")
      .reduce((sum, t) => sum + Number(t.amount), 0);
    const expense = transactions
      .filter((t) => t.type === "expense")
      .reduce((sum, t) => sum + Number(t.amount), 0);
    return { income, expense, net: income - expense };
  }, [transactions]);

  return (
    <main className="mx-auto max-w-2xl p-8">
      <h1 className="text-2xl font-bold">İşlemler</h1>

      <div className="mt-6 space-y-3 rounded border p-4">
        <h2 className="font-semibold">Kategoriler</h2>

        <div className="flex flex-wrap gap-2">
          {categories.map((c) => (
            <span
              key={c.id}
              className="flex items-center gap-1 rounded-full border px-3 py-1 text-sm"
            >
              {c.name}
              <button
                onClick={() => handleDeleteCategory(c.id)}
                className="text-gray-400 hover:text-red-600"
                aria-label={`${c.name} kategorisini sil`}
              >
                ×
              </button>
            </span>
          ))}
        </div>

        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Yeni kategori adı"
            value={newCategoryName}
            onChange={(e) => setNewCategoryName(e.target.value)}
            className="w-full rounded border p-2"
          />
          <button
            onClick={handleAddCategory}
            disabled={categorySubmitting || !newCategoryName.trim()}
            className="rounded bg-black px-4 text-white disabled:opacity-50"
          >
            Ekle
          </button>
        </div>
      </div>

      <div className="mt-6 space-y-3 rounded border p-4">
        <h2 className="font-semibold">
          {editingId ? "İşlemi Düzenle" : "Yeni İşlem Ekle"}
        </h2>

        <div className="flex gap-2">
          <select
            value={type}
            onChange={(e) => setType(e.target.value as "income" | "expense")}
            className="rounded border p-2"
          >
            <option value="expense">Gider</option>
            <option value="income">Gelir</option>
          </select>

          <input
            type="number"
            placeholder="Tutar"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full rounded border p-2"
          />
        </div>

        <select
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          className="w-full rounded border p-2"
        >
          <option value="">Kategori seç (opsiyonel)</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>

        <input
          type="text"
          placeholder="Açıklama (opsiyonel)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="w-full rounded border p-2"
        />

        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="w-full rounded border p-2"
        />

        <div className="flex gap-2">
          <button
            onClick={handleSubmitTransaction}
            disabled={submitting || !amount}
            className="w-full rounded bg-black p-2 text-white disabled:opacity-50"
          >
            {submitting ? "Kaydediliyor..." : editingId ? "Güncelle" : "Ekle"}
          </button>
          {editingId && (
            <button
              onClick={resetForm}
              className="rounded border px-4 text-sm hover:bg-gray-50"
            >
              Vazgeç
            </button>
          )}
        </div>

        {message && <p className="text-sm text-red-600">{message}</p>}
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value as "all" | "income" | "expense")}
          className="rounded border p-2"
        >
          <option value="all">Tümü</option>
          <option value="expense">Gider</option>
          <option value="income">Gelir</option>
        </select>

        <select
          value={filterCategoryId}
          onChange={(e) => setFilterCategoryId(e.target.value)}
          className="rounded border p-2"
        >
          <option value="">Tüm kategoriler</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>

        <input
          type="date"
          value={filterDateFrom}
          onChange={(e) => setFilterDateFrom(e.target.value)}
          className="rounded border p-2"
          aria-label="Başlangıç tarihi"
        />
        <input
          type="date"
          value={filterDateTo}
          onChange={(e) => setFilterDateTo(e.target.value)}
          className="rounded border p-2"
          aria-label="Bitiş tarihi"
        />
      </div>

      <div className="mt-4 flex justify-between rounded border p-3 text-sm">
        <span className="text-green-600">
          Gelir: {currencyFormatter.format(totals.income)}
        </span>
        <span className="text-red-600">
          Gider: {currencyFormatter.format(totals.expense)}
        </span>
        <span className="font-semibold">
          Net: {currencyFormatter.format(totals.net)}
        </span>
      </div>

      <ul className="mt-4 divide-y rounded border">
        {transactions.length === 0 && (
          <li className="p-4 text-sm text-gray-500">Henüz işlem yok.</li>
        )}
        {transactions.map((t) => (
          <li key={t.id} className="flex items-center justify-between p-3 text-sm">
            <div>
              <span className={t.type === "income" ? "text-green-600" : "text-red-600"}>
                {t.type === "income" ? "+" : "-"}
                {currencyFormatter.format(t.amount)}
              </span>
              <span className="ml-2 text-gray-500">
                {categoryName(t.category_id)} · {t.date}
              </span>
              {t.description && <span className="ml-2">{t.description}</span>}
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => startEditing(t)}
                className="text-gray-400 hover:text-black"
              >
                Düzenle
              </button>
              <button
                onClick={() => handleDeleteTransaction(t.id)}
                className="text-gray-400 hover:text-red-600"
              >
                Sil
              </button>
            </div>
          </li>
        ))}
      </ul>
    </main>
  );
}
