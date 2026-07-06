"use client";

import { PiggyBank, Scale, TrendingDown, TrendingUp } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type CategoryTotal = {
  category_id: number | null;
  category_name: string;
  total: number;
};

type MonthlyTotal = {
  month: string;
  income: number;
  expense: number;
};

const COLORS = [
  "#111827",
  "#4b5563",
  "#9ca3af",
  "#f87171",
  "#fb923c",
  "#facc15",
  "#34d399",
  "#60a5fa",
  "#a78bfa",
  "#f472b6",
];

const currencyFormatter = new Intl.NumberFormat("tr-TR", {
  style: "currency",
  currency: "TRY",
});

const compactCurrencyFormatter = new Intl.NumberFormat("tr-TR", {
  style: "currency",
  currency: "TRY",
  notation: "compact",
});

export function DashboardCharts({
  income,
  expense,
  net,
  categoryTotals,
  monthlyTotals,
}: {
  income: number;
  expense: number;
  net: number;
  categoryTotals: CategoryTotal[];
  monthlyTotals: MonthlyTotal[];
}) {
  return (
    <div className="mt-6 space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <TrendingUp className="h-4 w-4" />
            Bu Ay Gelir
          </div>
          <p className="mt-1 text-xl font-semibold text-green-600">
            {currencyFormatter.format(income)}
          </p>
        </div>
        <div className="rounded-xl border bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <TrendingDown className="h-4 w-4" />
            Bu Ay Gider
          </div>
          <p className="mt-1 text-xl font-semibold text-red-600">
            {currencyFormatter.format(expense)}
          </p>
        </div>
        <div className="rounded-xl border bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Scale className="h-4 w-4" />
            Net
          </div>
          <p className="mt-1 text-xl font-semibold">{currencyFormatter.format(net)}</p>
        </div>
      </div>

      <div className="rounded-xl border bg-white p-4 shadow-sm">
        <h2 className="mb-2 flex items-center gap-2 font-semibold">
          <PiggyBank className="h-4 w-4" />
          Bu Ay Nereye Gitti Param?
        </h2>
        {categoryTotals.length === 0 ? (
          <p className="text-sm text-gray-500">Bu ay henüz gider yok.</p>
        ) : (
          <ResponsiveContainer width="100%" height={320}>
            <PieChart margin={{ top: 10, right: 10, bottom: 10, left: 10 }}>
              <Pie
                data={categoryTotals}
                dataKey="total"
                nameKey="category_name"
                cx="50%"
                cy="50%"
                outerRadius={90}
                labelLine={false}
                label={({ percent }: { percent?: number }) =>
                  percent && percent > 0.04 ? `${Math.round(percent * 100)}%` : ""
                }
              >
                {categoryTotals.map((entry, index) => (
                  <Cell
                    key={entry.category_id ?? "none"}
                    fill={COLORS[index % COLORS.length]}
                  />
                ))}
              </Pie>
              <Tooltip formatter={(value) => currencyFormatter.format(Number(value))} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="rounded-xl border bg-white p-4 shadow-sm">
        <h2 className="mb-2 font-semibold">Son 6 Ay</h2>
        {monthlyTotals.every((m) => m.income === 0 && m.expense === 0) ? (
          <p className="text-sm text-gray-500">Henüz yeterli veri yok.</p>
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={monthlyTotals}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="month" fontSize={12} />
              <YAxis
                fontSize={12}
                tickFormatter={(value) => compactCurrencyFormatter.format(Number(value))}
              />
              <Tooltip formatter={(value) => currencyFormatter.format(Number(value))} />
              <Legend />
              <Bar dataKey="income" name="Gelir" fill="#34d399" radius={[4, 4, 0, 0]} />
              <Bar dataKey="expense" name="Gider" fill="#f87171" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
