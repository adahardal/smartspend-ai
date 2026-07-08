"use client";

import { ArrowLeft, Check, LoaderCircle, Sparkles } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/lib/api";

type Category = { id: number; name: string };

type BackendSuggestion = {
  transaction_id: number;
  description: string | null;
  amount: number;
  type: "income" | "expense";
  category_id: number | null;
  category_name: string | null;
};

type Row = BackendSuggestion & { included: boolean; categoryId: string };

const currencyFormatter = new Intl.NumberFormat("tr-TR", {
  style: "currency",
  currency: "TRY",
});

export default function CategorizePage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [appliedCount, setAppliedCount] = useState<number | null>(null);

  const loadCategories = useCallback(async () => {
    const res = await apiFetch("/api/v1/categories");
    if (res.ok) setCategories(await res.json());
  }, []);

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  async function handleSuggest() {
    setLoading(true);
    setMessage("");
    setAppliedCount(null);

    const res = await apiFetch("/api/v1/transactions/categorize/suggest", {
      method: "POST",
    });

    if (res.ok) {
      const data: BackendSuggestion[] = await res.json();
      setRows(
        data.map((s) => ({
          ...s,
          included: s.category_id !== null,
          categoryId: s.category_id !== null ? String(s.category_id) : "",
        }))
      );
    } else {
      const err = await res.json().catch(() => null);
      setMessage(err?.detail ?? "Öneriler alınamadı");
      setRows(null);
    }
    setLoading(false);
  }

  function updateRow(index: number, patch: Partial<Row>) {
    setRows((prev) =>
      prev ? prev.map((r, i) => (i === index ? { ...r, ...patch } : r)) : prev
    );
  }

  const includedCount = useMemo(
    () => rows?.filter((r) => r.included && r.categoryId).length ?? 0,
    [rows]
  );

  async function handleApply() {
    if (!rows) return;
    const assignments = rows
      .filter((r) => r.included && r.categoryId)
      .map((r) => ({
        transaction_id: r.transaction_id,
        category_id: Number(r.categoryId),
      }));

    if (assignments.length === 0) {
      setMessage("Uygulanacak eşleme seçilmedi");
      return;
    }

    setSubmitting(true);
    setMessage("");

    const res = await apiFetch("/api/v1/transactions/categorize/apply", {
      method: "POST",
      body: JSON.stringify({ assignments }),
    });

    if (res.ok) {
      const data = await res.json();
      setAppliedCount(data.updated);
      setRows(null);
    } else {
      const err = await res.json().catch(() => null);
      setMessage(err?.detail ?? "Uygulama başarısız oldu");
    }
    setSubmitting(false);
  }

  return (
    <div>
      <Link
        href="/transactions"
        className="flex items-center gap-1 text-sm text-gray-500 hover:text-black"
      >
        <ArrowLeft className="h-4 w-4" />
        İşlemlere Dön
      </Link>

      <h1 className="mt-2 flex items-center gap-2 text-2xl font-bold">
        <Sparkles className="h-6 w-6" />
        Otomatik Kategorilendir
      </h1>
      <p className="mt-1 text-sm text-gray-500">
        Kategorisiz işlemlerin için en uygun kategori otomatik önerilir.
        Önerileri gözden geçirip onayladıktan sonra uygulanır.
      </p>

      <div className="mt-6 space-y-3 rounded-xl border bg-white p-4 shadow-sm">
        <button
          onClick={handleSuggest}
          disabled={loading}
          className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700 disabled:opacity-50"
        >
          {loading ? (
            <LoaderCircle className="h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="h-4 w-4" />
          )}
          {loading ? "Öneriler hazırlanıyor..." : "Önerileri Getir"}
        </button>

        {message && <p className="text-sm text-red-600">{message}</p>}

        {appliedCount !== null && (
          <p className="flex items-center gap-1.5 text-sm text-green-600">
            <Check className="h-4 w-4" />
            {appliedCount} işlem kategorilendirildi.
          </p>
        )}

        {rows && rows.length === 0 && (
          <p className="text-sm text-gray-500">
            Kategorisiz işlem yok — hepsi zaten kategorili.
          </p>
        )}
      </div>

      {rows && rows.length > 0 && (
        <div className="mt-6 rounded-xl border bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm text-gray-500">
              {rows.length} işlem · {includedCount} tanesi seçili
            </p>
            <button
              onClick={handleApply}
              disabled={submitting || includedCount === 0}
              className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700 disabled:opacity-50"
            >
              {submitting ? (
                <LoaderCircle className="h-4 w-4 animate-spin" />
              ) : (
                <Check className="h-4 w-4" />
              )}
              Onayla ve Uygula ({includedCount})
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-gray-500">
                  <th className="p-2" />
                  <th className="p-2">İşlem</th>
                  <th className="p-2">Tutar</th>
                  <th className="p-2">Önerilen Kategori</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => (
                  <tr
                    key={row.transaction_id}
                    className={`border-b last:border-0 ${
                      !row.category_id ? "bg-amber-50" : ""
                    }`}
                  >
                    <td className="p-2">
                      <input
                        type="checkbox"
                        checked={row.included}
                        onChange={(e) =>
                          updateRow(index, { included: e.target.checked })
                        }
                      />
                    </td>
                    <td className="p-2">
                      {row.description || (
                        <span className="text-gray-400">(açıklama yok)</span>
                      )}
                    </td>
                    <td className="p-2">
                      <span
                        className={
                          row.type === "income" ? "text-green-600" : "text-red-600"
                        }
                      >
                        {row.type === "income" ? "+" : "-"}
                        {currencyFormatter.format(row.amount)}
                      </span>
                    </td>
                    <td className="p-2">
                      <select
                        value={row.categoryId}
                        onChange={(e) =>
                          updateRow(index, { categoryId: e.target.value })
                        }
                        className="rounded border p-1"
                      >
                        <option value="">Kategorisiz</option>
                        {categories.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                      {!row.category_id && (
                        <span className="ml-2 text-xs text-amber-600">
                          Eşleştirilemedi
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
