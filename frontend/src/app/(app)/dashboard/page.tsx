import { Info, TrendingDown, TrendingUp, Wallet } from "lucide-react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { DashboardCharts } from "./dashboard-charts";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

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

type Highlight = {
  kind: "up" | "down" | "info";
  text: string;
};

type PayPeriodBalance = {
  configured: boolean;
  period_start: string | null;
  income: number;
  expense: number;
  balance: number;
};

const periodDateFormatter = new Intl.DateTimeFormat("tr-TR", {
  day: "numeric",
  month: "long",
});

const currencyFormatter = new Intl.NumberFormat("tr-TR", {
  style: "currency",
  currency: "TRY",
});

function firstDayOfMonthISO() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
}

function formatMonthLabel(isoMonth: string) {
  const [year, month] = isoMonth.split("-").map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString("tr-TR", {
    month: "short",
  });
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const authHeaders = { Authorization: `Bearer ${session?.access_token}` };
  const dateFrom = firstDayOfMonthISO();

  let income = 0;
  let expense = 0;
  let net = 0;
  let categoryTotals: CategoryTotal[] = [];
  let monthlyTotals: MonthlyTotal[] = [];
  let highlights: Highlight[] = [];
  let payPeriod: PayPeriodBalance | null = null;

  try {
    const [summaryRes, byCategoryRes, monthlyRes, highlightsRes, payPeriodRes] =
      await Promise.all([
        fetch(`${API_URL}/api/v1/summary?date_from=${dateFrom}`, {
          headers: authHeaders,
          cache: "no-store",
        }),
        fetch(`${API_URL}/api/v1/summary/by-category?type=expense&date_from=${dateFrom}`, {
          headers: authHeaders,
          cache: "no-store",
        }),
        fetch(`${API_URL}/api/v1/summary/monthly?months=6`, {
          headers: authHeaders,
          cache: "no-store",
        }),
        fetch(`${API_URL}/api/v1/insights/highlights`, {
          headers: authHeaders,
          cache: "no-store",
        }),
        fetch(`${API_URL}/api/v1/insights/pay-period-balance`, {
          headers: authHeaders,
          cache: "no-store",
        }),
      ]);

    if (summaryRes.ok) {
      const summary = await summaryRes.json();
      income = summary.income;
      expense = summary.expense;
      net = summary.net;
    }
    if (byCategoryRes.ok) {
      categoryTotals = await byCategoryRes.json();
    }
    if (monthlyRes.ok) {
      const raw: MonthlyTotal[] = await monthlyRes.json();
      monthlyTotals = raw.map((m) => ({ ...m, month: formatMonthLabel(m.month) }));
    }
    if (highlightsRes.ok) {
      highlights = await highlightsRes.json();
    }
    if (payPeriodRes.ok) {
      payPeriod = await payPeriodRes.json();
    }
  } catch {
    // backend kapalıysa kartlar 0 görünür
  }

  return (
    <div className="animate-fade-in-up">
      <h1 className="text-2xl font-bold">Dashboard</h1>
      <p className="mt-2 text-gray-600">
        Hoş geldin, {user?.user_metadata?.full_name || user?.email} 👋
      </p>

      {payPeriod?.configured && (
        <div className="animate-fade-in-up mt-6 rounded-xl border bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Wallet className="h-4 w-4" />
            Cebindeki Paran
          </div>
          <p
            className={`mt-1 text-2xl font-bold ${
              payPeriod.balance < 0 ? "text-red-600" : "text-gray-900"
            }`}
          >
            {currencyFormatter.format(payPeriod.balance)}
          </p>
          <p className="mt-1 text-xs text-gray-400">
            {payPeriod.period_start &&
              periodDateFormatter.format(new Date(`${payPeriod.period_start}T00:00:00`))}{" "}
            – bugün · {currencyFormatter.format(payPeriod.income)} gelir,{" "}
            {currencyFormatter.format(payPeriod.expense)} gider
          </p>
        </div>
      )}

      {highlights.length > 0 && (
        <div
          className="animate-fade-in-up mt-6 rounded-xl border bg-white p-4 shadow-sm"
          style={{ animationDelay: "80ms" }}
        >
          <h2 className="mb-3 font-semibold">Öne Çıkanlar</h2>
          <ul className="space-y-2">
            {highlights.map((h, i) => {
              const Icon =
                h.kind === "up" ? TrendingUp : h.kind === "down" ? TrendingDown : Info;
              const color =
                h.kind === "up"
                  ? "text-red-600"
                  : h.kind === "down"
                    ? "text-green-600"
                    : "text-gray-500";
              return (
                <li
                  key={i}
                  className="animate-fade-in-up flex items-start gap-2 text-sm"
                  style={{ animationDelay: `${140 + i * 60}ms` }}
                >
                  <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${color}`} />
                  <span className="text-gray-700">{h.text}</span>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <div className="animate-fade-in-up" style={{ animationDelay: "120ms" }}>
        <DashboardCharts
          income={income}
          expense={expense}
          net={net}
          categoryTotals={categoryTotals}
          monthlyTotals={monthlyTotals}
        />
      </div>

      <Link
        href="/transactions"
        className="animate-fade-in-up mt-6 inline-block rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-all hover:bg-indigo-700 hover:shadow-md active:scale-[0.98]"
        style={{ animationDelay: "200ms" }}
      >
        İşlemlere Git
      </Link>
    </div>
  );
}
