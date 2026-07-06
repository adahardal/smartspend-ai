"use client";

import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

type CategoryTotal = {
  category_id: number | null;
  category_name: string;
  total: number;
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

export function DashboardCharts({
  income,
  expense,
  net,
  categoryTotals,
}: {
  income: number;
  expense: number;
  net: number;
  categoryTotals: CategoryTotal[];
}) {
  return (
    <div className="mt-6 space-y-6">
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded border p-4">
          <p className="text-sm text-gray-500">Bu Ay Gelir</p>
          <p className="text-xl font-semibold text-green-600">
            {currencyFormatter.format(income)}
          </p>
        </div>
        <div className="rounded border p-4">
          <p className="text-sm text-gray-500">Bu Ay Gider</p>
          <p className="text-xl font-semibold text-red-600">
            {currencyFormatter.format(expense)}
          </p>
        </div>
        <div className="rounded border p-4">
          <p className="text-sm text-gray-500">Net</p>
          <p className="text-xl font-semibold">{currencyFormatter.format(net)}</p>
        </div>
      </div>

      <div className="rounded border p-4">
        <h2 className="mb-2 font-semibold">Bu Ay Nereye Gitti Param?</h2>
        {categoryTotals.length === 0 ? (
          <p className="text-sm text-gray-500">Bu ay henüz gider yok.</p>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie
                data={categoryTotals}
                dataKey="total"
                nameKey="category_name"
                cx="50%"
                cy="50%"
                outerRadius={100}
                label={(entry: { name?: string }) => entry.name ?? ""}
              >
                {categoryTotals.map((entry, index) => (
                  <Cell
                    key={entry.category_id ?? "none"}
                    fill={COLORS[index % COLORS.length]}
                  />
                ))}
              </Pie>
              <Tooltip formatter={(value) => currencyFormatter.format(Number(value))} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
