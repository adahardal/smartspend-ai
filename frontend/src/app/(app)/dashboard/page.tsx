import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { DashboardCharts } from "./dashboard-charts";
import { LogoutButton } from "./logout-button";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

type CategoryTotal = {
  category_id: number | null;
  category_name: string;
  total: number;
};

function firstDayOfMonthISO() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
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

  try {
    const [summaryRes, byCategoryRes] = await Promise.all([
      fetch(`${API_URL}/api/v1/summary?date_from=${dateFrom}`, {
        headers: authHeaders,
        cache: "no-store",
      }),
      fetch(`${API_URL}/api/v1/summary/by-category?type=expense&date_from=${dateFrom}`, {
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
  } catch {
    // backend kapalıysa kartlar 0 görünür
  }

  return (
    <main className="mx-auto max-w-2xl p-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <LogoutButton />
      </div>
      <p className="mt-2 text-gray-600">Hoş geldin, {user?.email} 👋</p>

      <DashboardCharts
        income={income}
        expense={expense}
        net={net}
        categoryTotals={categoryTotals}
      />

      <Link
        href="/transactions"
        className="mt-6 inline-block rounded bg-black px-4 py-2 text-sm text-white"
      >
        İşlemlere Git
      </Link>
    </main>
  );
}
