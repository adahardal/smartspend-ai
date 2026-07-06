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

  try {
    const [summaryRes, byCategoryRes, monthlyRes] = await Promise.all([
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
  } catch {
    // backend kapalıysa kartlar 0 görünür
  }

  return (
    <div>
      <h1 className="text-2xl font-bold">Dashboard</h1>
      <p className="mt-2 text-gray-600">Hoş geldin, {user?.email} 👋</p>

      <DashboardCharts
        income={income}
        expense={expense}
        net={net}
        categoryTotals={categoryTotals}
        monthlyTotals={monthlyTotals}
      />

      <Link
        href="/transactions"
        className="mt-6 inline-block rounded-lg bg-black px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-800"
      >
        İşlemlere Git
      </Link>
    </div>
  );
}
