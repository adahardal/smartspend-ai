"use client";

import {
  ArrowLeft,
  Check,
  CircleAlert,
  FileSpreadsheet,
  LoaderCircle,
  Upload,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/lib/api";

type Category = { id: number; name: string };

type BackendImportRow = {
  row_number: number;
  amount: number | null;
  type: string;
  category_id: number | null;
  category_name_hint: string | null;
  description: string | null;
  date: string | null;
  error: string | null;
};

type PreviewRow = {
  rowNumber: number;
  included: boolean;
  amount: string;
  type: "income" | "expense";
  categoryId: string;
  description: string;
  date: string;
  error: string | null;
};

function toPreviewRow(r: BackendImportRow): PreviewRow {
  return {
    rowNumber: r.row_number,
    included: !r.error,
    amount: r.amount != null ? String(r.amount) : "",
    type: r.type === "income" ? "income" : "expense",
    categoryId: r.category_id != null ? String(r.category_id) : "",
    description: r.description ?? "",
    date: r.date ?? "",
    error: r.error,
  };
}

export default function ImportTransactionsPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [rows, setRows] = useState<PreviewRow[] | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [importedCount, setImportedCount] = useState<number | null>(null);

  const loadCategories = useCallback(async () => {
    const res = await apiFetch("/api/v1/categories");
    if (res.ok) setCategories(await res.json());
  }, []);

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  async function handlePreview() {
    if (!file) return;
    setLoadingPreview(true);
    setMessage("");
    setImportedCount(null);

    const formData = new FormData();
    formData.append("file", file);

    const res = await apiFetch("/api/v1/transactions/import/preview", {
      method: "POST",
      body: formData,
    });

    if (res.ok) {
      const data: BackendImportRow[] = await res.json();
      setRows(data.map(toPreviewRow));
    } else {
      const data = await res.json().catch(() => null);
      setMessage(data?.detail ?? "Dosya okunamadı");
      setRows(null);
    }
    setLoadingPreview(false);
  }

  function updateRow(index: number, patch: Partial<PreviewRow>) {
    setRows((prev) =>
      prev ? prev.map((r, i) => (i === index ? { ...r, ...patch } : r)) : prev
    );
  }

  const includedCount = useMemo(
    () => rows?.filter((r) => r.included).length ?? 0,
    [rows]
  );
  const errorCount = useMemo(() => rows?.filter((r) => r.error).length ?? 0, [rows]);

  async function handleConfirm() {
    if (!rows) return;
    const included = rows.filter((r) => r.included);

    const invalid = included.find(
      (r) => !r.date || !r.amount || Number(r.amount) <= 0
    );
    if (invalid) {
      setMessage(
        `Satır ${invalid.rowNumber}: geçerli bir tarih ve tutar gir ya da satırı işaretten kaldır.`
      );
      return;
    }

    setSubmitting(true);
    setMessage("");

    const payload = {
      rows: included.map((r) => ({
        amount: Number(r.amount),
        type: r.type,
        category_id: r.categoryId ? Number(r.categoryId) : null,
        description: r.description || null,
        date: r.date,
      })),
    };

    const res = await apiFetch("/api/v1/transactions/import/confirm", {
      method: "POST",
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      const data = await res.json();
      setImportedCount(data.imported);
      setRows(null);
      setFile(null);
    } else {
      const data = await res.json().catch(() => null);
      setMessage(data?.detail ?? "İçe aktarma başarısız oldu");
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

      <h1 className="mt-2 text-2xl font-bold">CSV / Excel İçe Aktar</h1>
      <p className="mt-1 text-sm text-gray-500">
        Dosyanda <strong>Tarih</strong> ve <strong>Tutar</strong> sütunları olmalı.
        Opsiyonel olarak <strong>Açıklama</strong>, <strong>Tür</strong> (Gelir/Gider)
        ve <strong>Kategori</strong> sütunları da tanınır.
      </p>

      <div className="mt-6 space-y-3 rounded-xl border bg-white p-4 shadow-sm">
        <input
          type="file"
          accept=".csv,.xlsx"
          onChange={(e) => {
            setFile(e.target.files?.[0] ?? null);
            setRows(null);
            setImportedCount(null);
          }}
          className="text-sm"
        />

        <button
          onClick={handlePreview}
          disabled={!file || loadingPreview}
          className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700 disabled:opacity-50"
        >
          {loadingPreview ? (
            <LoaderCircle className="h-4 w-4 animate-spin" />
          ) : (
            <FileSpreadsheet className="h-4 w-4" />
          )}
          Önizle
        </button>

        {message && <p className="text-sm text-red-600">{message}</p>}

        {importedCount !== null && (
          <p className="flex items-center gap-1.5 text-sm text-green-600">
            <Check className="h-4 w-4" />
            {importedCount} işlem başarıyla içe aktarıldı.
          </p>
        )}
      </div>

      {rows && rows.length > 0 && (
        <div className="mt-6 rounded-xl border bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm text-gray-500">
              {rows.length} satır bulundu
              {errorCount > 0 && `, ${errorCount} tanesi hatalı`} · {includedCount} tanesi
              seçili
            </p>
            <button
              onClick={handleConfirm}
              disabled={submitting || includedCount === 0}
              className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700 disabled:opacity-50"
            >
              {submitting ? (
                <LoaderCircle className="h-4 w-4 animate-spin" />
              ) : (
                <Upload className="h-4 w-4" />
              )}
              Onayla ve İçe Aktar ({includedCount})
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-gray-500">
                  <th className="p-2" />
                  <th className="p-2">Tarih</th>
                  <th className="p-2">Tür</th>
                  <th className="p-2">Tutar</th>
                  <th className="p-2">Kategori</th>
                  <th className="p-2">Açıklama</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => (
                  <tr
                    key={row.rowNumber}
                    className={`border-b last:border-0 ${row.error ? "bg-red-50" : ""}`}
                  >
                    <td className="p-2">
                      <input
                        type="checkbox"
                        checked={row.included}
                        onChange={(e) => updateRow(index, { included: e.target.checked })}
                      />
                    </td>
                    <td className="p-2">
                      <input
                        type="date"
                        value={row.date}
                        onChange={(e) => updateRow(index, { date: e.target.value })}
                        className="w-36 rounded border p-1"
                      />
                    </td>
                    <td className="p-2">
                      <select
                        value={row.type}
                        onChange={(e) =>
                          updateRow(index, { type: e.target.value as "income" | "expense" })
                        }
                        className="rounded border p-1"
                      >
                        <option value="expense">Gider</option>
                        <option value="income">Gelir</option>
                      </select>
                    </td>
                    <td className="p-2">
                      <input
                        type="number"
                        value={row.amount}
                        onChange={(e) => updateRow(index, { amount: e.target.value })}
                        className="w-24 rounded border p-1"
                      />
                    </td>
                    <td className="p-2">
                      <select
                        value={row.categoryId}
                        onChange={(e) => updateRow(index, { categoryId: e.target.value })}
                        className="rounded border p-1"
                      >
                        <option value="">Kategorisiz</option>
                        {categories.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="p-2">
                      <input
                        type="text"
                        value={row.description}
                        onChange={(e) => updateRow(index, { description: e.target.value })}
                        className="w-full min-w-32 rounded border p-1"
                      />
                      {row.error && (
                        <p className="mt-1 flex items-center gap-1 text-xs text-red-600">
                          <CircleAlert className="h-3 w-3" />
                          {row.error}
                        </p>
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
