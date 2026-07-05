import { createClient } from "@/lib/supabase/server";
import { LogoutButton } from "./logout-button";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Oturumdan access token'ı al
  const {
    data: { session },
  } = await supabase.auth.getSession();

  // Backend'e token'la istek at
  let backendStatus = "Backend'e ulaşılamadı ❌";
  try {
    const res = await fetch("http://localhost:8000/api/v1/me", {
      headers: {
        Authorization: `Bearer ${session?.access_token}`,
      },
      cache: "no-store",
    });
    if (res.ok) {
      const data = await res.json();
      backendStatus = `Backend seni tanıdı ✅ user_id: ${data.user_id}`;
    } else {
      backendStatus = `Backend reddetti (${res.status}) ❌`;
    }
  } catch {
    // backend kapalıysa buraya düşer
  }

  return (
    <main className="p-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <LogoutButton />
      </div>
      <p className="mt-2 text-gray-600">Hoş geldin, {user?.email} 👋</p>
      <p className="mt-4 rounded border p-3 text-sm">{backendStatus}</p>
    </main>
  );
}