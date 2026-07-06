"use client";

import { useEffect } from "react";

export default function ErrorPage({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-4 text-center">
      <h1 className="text-2xl font-bold">Bir şeyler ters gitti</h1>
      <p className="text-gray-600">
        Beklenmedik bir hata oluştu. Tekrar denemek ister misin?
      </p>
      <button
        onClick={unstable_retry}
        className="rounded-lg bg-black px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
      >
        Tekrar Dene
      </button>
    </main>
  );
}
