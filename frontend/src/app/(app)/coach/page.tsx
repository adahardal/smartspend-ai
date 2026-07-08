"use client";

import { MessageCircle, Send, Sparkle } from "lucide-react";
import { useRef, useState } from "react";
import { apiFetch } from "@/lib/api";

const SUGGESTIONS = [
  "Bu ay neden bu kadar harcadım?",
  "Geçen aya göre nerede daha çok harcadım?",
  "En çok hangi kategoriye para gidiyor?",
  "Bütçelerimde durumum nasıl?",
];

export default function CoachPage() {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [asked, setAsked] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const abortRef = useRef<AbortController | null>(null);

  async function ask(q: string) {
    const trimmed = q.trim();
    if (!trimmed || loading) return;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setError("");
    setAnswer("");
    setAsked(trimmed);
    setQuestion("");

    try {
      const res = await apiFetch("/api/v1/coach/ask", {
        method: "POST",
        body: JSON.stringify({ question: trimmed }),
        signal: controller.signal,
      });

      if (!res.ok || !res.body) {
        let detail = "Koç şu an yanıt veremiyor.";
        try {
          const data = await res.json();
          if (data?.detail) detail = data.detail;
        } catch {
          // non-JSON error body, keep default
        }
        setError(detail);
        setLoading(false);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        setAnswer((prev) => prev + decoder.decode(value, { stream: true }));
      }
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        setError("Bağlantı hatası. Tekrar dene.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <h1 className="flex items-center gap-2 text-2xl font-bold">
        <MessageCircle className="h-6 w-6" />
        Finans Koçu
      </h1>
      <p className="mt-1 text-sm text-gray-500">
        Harcamalarınla ilgili merak ettiğini sor; verilerine bakıp yanıtlayayım.
      </p>

      <div className="mt-6 flex flex-wrap gap-2">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            onClick={() => ask(s)}
            disabled={loading}
            className="rounded-full border bg-white px-3 py-1.5 text-sm text-gray-600 shadow-sm transition-colors hover:border-gray-400 hover:text-black disabled:opacity-50"
          >
            {s}
          </button>
        ))}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          ask(question);
        }}
        className="mt-4 flex gap-2"
      >
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Bir soru yaz..."
          className="flex-1 rounded-lg border p-2 text-sm shadow-sm"
        />
        <button
          type="submit"
          disabled={loading || !question.trim()}
          className="flex items-center gap-1 rounded-lg bg-indigo-600 px-4 text-sm font-medium text-white transition-colors hover:bg-indigo-700 disabled:opacity-50"
        >
          <Send className="h-4 w-4" />
          Sor
        </button>
      </form>

      {(asked || loading || answer || error) && (
        <div className="mt-6 rounded-xl border bg-white p-4 shadow-sm">
          {asked && (
            <p className="mb-3 flex items-start gap-2 text-sm font-medium text-gray-700">
              <Sparkle className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" />
              {asked}
            </p>
          )}
          {error ? (
            <p className="text-sm text-red-600">{error}</p>
          ) : (
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-gray-800">
              {answer}
              {loading && !answer && (
                <span className="text-gray-400">Düşünüyor...</span>
              )}
              {loading && answer && (
                <span className="ml-0.5 inline-block h-4 w-1.5 animate-pulse bg-gray-400 align-middle" />
              )}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
