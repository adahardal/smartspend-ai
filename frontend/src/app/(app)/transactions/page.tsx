"use client";

import {
  Car,
  Ellipsis,
  FileText,
  HeartPulse,
  Pencil,
  Plus,
  Popcorn,
  Search,
  ShoppingCart,
  Sparkles,
  Tag,
  Trash2,
  Upload,
  UtensilsCrossed,
  Wallet,
  X,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/lib/api";
import { Skeleton } from "@/components/skeleton";

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

const CATEGORY_ICONS: Record<string, typeof Tag> = {
  Yemek: UtensilsCrossed,
  Ulaşım: Car,
  Fatura: FileText,
  Market: ShoppingCart,
  Eğlence: Popcorn,
  Sağlık: HeartPulse,
  Maaş: Wallet,
  Diğer: Ellipsis,
};

function CategoryIcon({ name, className }: { name: string; className?: string }) {
  const Icon = CATEGORY_ICONS[name] ?? Tag;
  return <Icon className={className} />;
}

export default function TransactionsPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
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
  const [search, setSearch] = useState("");

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
    setLoading(false);
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

  const visibleTransactions = useMemo(() => {
    if (!search.trim()) return transactions;
    const q = search.trim().toLowerCase();
    return transactions.filter((t) => t.description?.toLowerCase().includes(q));
  }, [transactions, search]);

  const incomeRows = useMemo(
    () => visibleTransactions.filter((t) => t.type === "income"),
    [visibleTransactions]
  );
  const expenseRows = useMemo(
    () => visibleTransactions.filter((t) => t.type === "expense"),
    [visibleTransactions]
  );

  const totals = useMemo(() => {
    const income = incomeRows.reduce((sum, t) => sum + Number(t.amount), 0);
    const expense = expenseRows.reduce((sum, t) => sum + Number(t.amount), 0);
    return { income, expense, net: income - expense };
  }, [incomeRows, expenseRows]);

  function renderRow(t: Transaction) {
    return (
      <li key={t.id} className="flex items-center justify-between p-3 text-sm">
        <div className="flex items-center gap-2">
          <CategoryIcon name={categoryName(t.category_id)} className="h-4 w-4 text-gray-400" />
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
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => startEditing(t)}
            className="text-gray-400 hover:text-black"
            aria-label="İşlemi düzenle"
          >
            <Pencil className="h-4 w-4" />
          </button>
          <button
            onClick={() => handleDeleteTransaction(t.id)}
            className="text-gray-400 hover:text-red-600"
            aria-label="İşlemi sil"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </li>
    );
  }

  return (
    <div className="animate-fade-in-up">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">İşlemler</h1>
        <div className="flex gap-2">
          <Link
            href="/transactions/categorize"
            className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors hover:bg-gray-50"
          >
            <Sparkles className="h-4 w-4" />
            Otomatik Kategorilendir
          </Link>
          <Link
            href="/transactions/import"
            className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors hover:bg-gray-50"
          >
            <Upload className="h-4 w-4" />
            İçe Aktar
          </Link>
        </div>
      </div>

      <div className="mt-6 space-y-3 rounded-xl border bg-white p-4 shadow-sm">
        <h2 className="font-semibold">Kategoriler</h2>

        <div className="flex flex-wrap gap-2">
          {categories.map((c) => (
            <span
              key={c.id}
              className="flex items-center gap-1.5 rounded-full border bg-gray-50 px-3 py-1 text-sm"
            >
              <CategoryIcon name={c.name} className="h-3.5 w-3.5 text-gray-500" />
              {c.name}
              <button
                onClick={() => handleDeleteCategory(c.id)}
                className="text-gray-400 hover:text-red-600"
                aria-label={`${c.name} kategorisini sil`}
              >
                <X className="h-3.5 w-3.5" />
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
            className="w-full rounded-lg border p-2 text-sm"
          />
          <button
            onClick={handleAddCategory}
            disabled={categorySubmitting || !newCategoryName.trim()}
            className="flex items-center gap-1 rounded-lg bg-indigo-600 px-4 text-sm font-medium text-white transition-all hover:bg-indigo-700 active:scale-[0.98] disabled:opacity-50"
          >
            <Plus className="h-4 w-4" />
            Ekle
          </button>
        </div>
      </div>

      <div className="mt-6 space-y-3 rounded-xl border bg-white p-4 shadow-sm">
        <h2 className="font-semibold">
          {editingId ? "İşlemi Düzenle" : "Yeni İşlem Ekle"}
        </h2>

        <div className="flex gap-2">
          <select
            value={type}
            onChange={(e) => setType(e.target.value as "income" | "expense")}
            className="rounded-lg border p-2 text-sm"
          >
            <option value="expense">Gider</option>
            <option value="income">Gelir</option>
          </select>

          <input
            type="number"
            placeholder="Tutar"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full rounded-lg border p-2 text-sm"
          />
        </div>

        <select
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          className="w-full rounded-lg border p-2 text-sm"
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
          className="w-full rounded-lg border p-2 text-sm"
        />

        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="w-full rounded-lg border p-2 text-sm"
        />

        <div className="flex gap-2">
          <button
            onClick={handleSubmitTransaction}
            disabled={submitting || !amount}
            className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-indigo-600 p-2 text-sm font-medium text-white transition-all hover:bg-indigo-700 active:scale-[0.98] disabled:opacity-50"
          >
            {!editingId && <Plus className="h-4 w-4" />}
            {submitting ? "Kaydediliyor..." : editingId ? "Güncelle" : "Ekle"}
          </button>
          {editingId && (
            <button
              onClick={resetForm}
              className="rounded-lg border px-4 text-sm hover:bg-gray-50"
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
          className="rounded-lg border bg-white p-2 text-sm"
        >
          <option value="all">Tümü</option>
          <option value="expense">Gider</option>
          <option value="income">Gelir</option>
        </select>

        <select
          value={filterCategoryId}
          onChange={(e) => setFilterCategoryId(e.target.value)}
          className="rounded-lg border bg-white p-2 text-sm"
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
          className="rounded-lg border bg-white p-2 text-sm"
          aria-label="Başlangıç tarihi"
        />
        <input
          type="date"
          value={filterDateTo}
          onChange={(e) => setFilterDateTo(e.target.value)}
          className="rounded-lg border bg-white p-2 text-sm"
          aria-label="Bitiş tarihi"
        />

        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Açıklamada ara..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border bg-white p-2 pl-8 text-sm"
          />
        </div>
      </div>

      <div className="mt-4 flex justify-between rounded-xl border bg-white p-3 text-sm shadow-sm">
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

      {loading && (
        <div className="mt-4 space-y-2 overflow-hidden rounded-xl border bg-white shadow-sm">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="flex items-center justify-between p-3">
              <div className="flex items-center gap-3">
                <Skeleton className="h-8 w-8 rounded-full" />
                <div>
                  <Skeleton className="h-3.5 w-32" />
                  <Skeleton className="mt-1.5 h-3 w-20" />
                </div>
              </div>
              <Skeleton className="h-4 w-16" />
            </div>
          ))}
        </div>
      )}

      {!loading && visibleTransactions.length === 0 && (
        <div className="animate-fade-in-up mt-4 rounded-xl border bg-white p-4 text-sm text-gray-500 shadow-sm">
          Henüz işlem yok.
        </div>
      )}

      {!loading && filterType !== "expense" && incomeRows.length > 0 && (
        <div className="animate-fade-in-up mt-6">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-green-700">Gelir</h2>
            <span className="text-sm font-medium text-green-600">
              {currencyFormatter.format(totals.income)}
            </span>
          </div>
          <ul className="divide-y rounded-xl border bg-white shadow-sm">
            {incomeRows.map(renderRow)}
          </ul>
        </div>
      )}

      {!loading && filterType !== "income" && expenseRows.length > 0 && (
        <div className="animate-fade-in-up mt-6" style={{ animationDelay: "60ms" }}>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-red-700">Gider</h2>
            <span className="text-sm font-medium text-red-600">
              {currencyFormatter.format(totals.expense)}
            </span>
          </div>
          <ul className="divide-y rounded-xl border bg-white shadow-sm">
            {expenseRows.map(renderRow)}
          </ul>
        </div>
      )}
    </div>
  );
}
