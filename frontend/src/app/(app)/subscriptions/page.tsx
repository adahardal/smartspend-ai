"use client";

import { Repeat } from "lucide-react";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { Skeleton } from "@/components/skeleton";

type Subscription = {
  description: string;
  category_name: string | null;
  amount: number;
  occurrences: number;
  first_date: string;
  last_date: string;
  next_expected_date: string;
  confidence: "high" | "medium";
};

const currencyFormatter = new Intl.NumberFormat("tr-TR", {
  style: "currency",
  currency: "TRY",
});

const dateFormatter = new Intl.DateTimeFormat("tr-TR", {
  day: "numeric",
  month: "long",
});

export default function SubscriptionsPage() {
  const [subscriptions, setSubscriptions] = useState<Subscription[] | null>(
    null
  );
  const [error, setError] = useState("");

  useEffect(() => {
    apiFetch("/api/v1/insights/subscriptions")
      .then(async (res) => {
        if (!res.ok) throw new Error();
        setSubscriptions(await res.json());
      })
      .catch(() => setError("Abonelikler yüklenemedi"));
  }, []);

  const total = (subscriptions ?? []).reduce((sum, s) => sum + s.amount, 0);

  return (
    <div className="animate-fade-in-up">
      <h1 className="flex items-center gap-2 text-2xl font-bold">
        <Repeat className="h-6 w-6" />
        Abonelikler
      </h1>
      <p className="mt-1 text-sm text-gray-500">
        Geçmiş işlemlerinden düzenli tekrar eden ödemeleri otomatik tespit
        eder.
      </p>

      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

      {subscriptions === null && !error && (
        <div className="mt-6 space-y-3">
          <div className="rounded-xl border bg-white p-4 shadow-sm">
            <Skeleton className="h-3 w-28" />
            <Skeleton className="mt-2 h-7 w-40" />
          </div>
          {[0, 1].map((i) => (
            <div key={i} className="rounded-xl border bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-16" />
              </div>
              <Skeleton className="mt-3 h-3 w-32" />
            </div>
          ))}
        </div>
      )}

      {subscriptions !== null && subscriptions.length === 0 && (
        <div className="animate-fade-in-up mt-6 rounded-xl border bg-white p-4 text-sm text-gray-500 shadow-sm">
          Henüz tekrarlayan bir ödeme tespit edilmedi. En az iki ay üst üste
          aynı tutarda gelen işlemler burada listelenir.
        </div>
      )}

      {subscriptions !== null && subscriptions.length > 0 && (
        <>
          <div className="animate-fade-in-up mt-6 rounded-xl border bg-white p-4 shadow-sm">
            <p className="text-sm text-gray-500">Tahmini aylık toplam</p>
            <p className="text-2xl font-bold">
              {currencyFormatter.format(total)}
            </p>
          </div>

          <div className="mt-4 space-y-3">
            {subscriptions.map((s, i) => (
              <div
                key={s.description}
                className="animate-fade-in-up rounded-xl border bg-white p-4 shadow-sm transition-shadow hover:shadow-md"
                style={{ animationDelay: `${80 + i * 50}ms` }}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-medium">{s.description}</span>
                    {s.category_name && (
                      <span className="ml-2 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">
                        {s.category_name}
                      </span>
                    )}
                  </div>
                  <span className="font-semibold">
                    {currencyFormatter.format(s.amount)}
                  </span>
                </div>
                <div className="mt-2 flex items-center justify-between text-sm text-gray-500">
                  <span>
                    {s.occurrences} kez ·{" "}
                    {s.confidence === "high" ? "yüksek güven" : "olası"}
                  </span>
                  <span>
                    Sıradaki: {dateFormatter.format(new Date(s.next_expected_date))}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
