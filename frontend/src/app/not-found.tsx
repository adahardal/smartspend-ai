import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-4 text-center">
      <h1 className="text-2xl font-bold">Sayfa bulunamadı</h1>
      <p className="text-gray-600">Aradığın sayfa mevcut değil.</p>
      <Link
        href="/dashboard"
        className="rounded-lg bg-black px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
      >
        Dashboard&apos;a Dön
      </Link>
    </main>
  );
}
