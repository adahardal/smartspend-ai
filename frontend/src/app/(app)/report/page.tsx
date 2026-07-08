"use client";

import { FileText } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/lib/api";
import { Skeleton } from "@/components/skeleton";

type Summary = { income: number; expense: number; net: number };
type CategoryTotal = {
  category_id: number | null;
  category_name: string;
  total: number;
};

const currencyFormatter = new Intl.NumberFormat("tr-TR", {
  style: "currency",
  currency: "TRY",
});

function monthOptions() {
  const options: { value: string; label: string }[] = [];
  const now = new Date();
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const label = d.toLocaleDateString("tr-TR", { month: "long", year: "numeric" });
    options.push({ value, label });
  }
  return options;
}

function monthRange(value: string) {
  const [year, month] = value.split("-").map(Number);
  const dateFrom = `${value}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const dateTo = `${value}-${String(lastDay).padStart(2, "0")}`;
  return { dateFrom, dateTo };
}

export default function ReportPage() {
  const options = useMemo(monthOptions, []);
  const [selected, setSelected] = useState(options[0].value);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [categories, setCategories] = useState<CategoryTotal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const { dateFrom, dateTo } = monthRange(selected);
    setLoading(true);
    setError("");

    Promise.all([
      apiFetch(`/api/v1/summary?date_from=${dateFrom}&date_to=${dateTo}`),
      apiFetch(
        `/api/v1/summary/by-category?type=expense&date_from=${dateFrom}&date_to=${dateTo}`
      ),
    ])
      .then(async ([summaryRes, categoryRes]) => {
        if (!summaryRes.ok || !categoryRes.ok) throw new Error();
        setSummary(await summaryRes.json());
        setCategories(await categoryRes.json());
      })
      .catch(() => setError("Rapor yüklenemedi"))
      .finally(() => setLoading(false));
  }, [selected]);

  const totalExpense = summary?.expense ?? 0;

  return (
    <div className="animate-fade-in-up">
      <h1 className="flex items-center gap-2 text-2xl font-bold">
        <FileText className="h-6 w-6" />
        Aylık Rapor
      </h1>
      <p className="mt-1 text-sm text-gray-500">
        Geçmiş bir ayı seç, o aya ait gelir-gider özetini ve kategori
        dağılımını gör.
      </p>

      <select
        value={selected}
        onChange={(e) => setSelected(e.target.value)}
        className="mt-4 rounded-lg border p-2 text-sm shadow-sm transition-colors focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>

      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

      {loading && (
        <div className="mt-6 space-y-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="rounded-xl border bg-white p-4 shadow-sm">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="mt-2 h-6 w-24" />
              </div>
            ))}
          </div>
          <div className="rounded-xl border bg-white p-4 shadow-sm">
            <Skeleton className="h-4 w-32" />
            <div className="mt-4 space-y-3">
              {[0, 1, 2].map((i) => (
                <div key={i}>
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="mt-1 h-2 w-full" />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {!loading && summary && (
        <div className="animate-fade-in-up">
          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="rounded-xl border bg-white p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md">
              <p className="text-sm text-gray-500">Gelir</p>
              <p className="mt-1 text-xl font-semibold text-green-600">
                {currencyFormatter.format(summary.income)}
              </p>
            </div>
            <div className="rounded-xl border bg-white p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md">
              <p className="text-sm text-gray-500">Gider</p>
              <p className="mt-1 text-xl font-semibold text-red-600">
                {currencyFormatter.format(summary.expense)}
              </p>
            </div>
            <div className="rounded-xl border bg-white p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md">
              <p className="text-sm text-gray-500">Net</p>
              <p className="mt-1 text-xl font-semibold">
                {currencyFormatter.format(summary.net)}
              </p>
            </div>
          </div>

          <div className="mt-6 rounded-xl border bg-white p-4 shadow-sm">
            <h2 className="mb-3 font-semibold">Kategori Dağılımı</h2>
            {categories.length === 0 ? (
              <p className="text-sm text-gray-500">Bu ay gider yok.</p>
            ) : (
              <div className="space-y-3">
                {categories.map((c, i) => {
                  const pct = totalExpense > 0 ? (c.total / totalExpense) * 100 : 0;
                  return (
                    <div
                      key={c.category_id ?? "none"}
                      className="animate-fade-in-up"
                      style={{ animationDelay: `${i * 40}ms` }}
                    >
                      <div className="flex justify-between text-sm">
                        <span>{c.category_name}</span>
                        <span className="text-gray-500">
                          {currencyFormatter.format(c.total)} ({pct.toFixed(0)}%)
                        </span>
                      </div>
                      <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-gray-100">
                        <div
                          className="h-full rounded-full bg-indigo-600 transition-[width] duration-500 ease-out"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
