"use client";

import {
  FileText,
  LayoutDashboard,
  MessageCircle,
  Receipt,
  Repeat,
  Settings,
  Target,
  Wallet,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogoutButton } from "./logout-button";

const links = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/transactions", label: "İşlemler", icon: Receipt },
  { href: "/budgets", label: "Bütçeler", icon: Target },
  { href: "/subscriptions", label: "Abonelikler", icon: Repeat },
  { href: "/report", label: "Rapor", icon: FileText },
  { href: "/coach", label: "Koç", icon: MessageCircle },
];

export function NavBar({ userEmail }: { userEmail: string | null }) {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-10 border-b bg-white/80 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-6 py-3">
        <div className="flex shrink-0 items-center gap-2 font-semibold whitespace-nowrap">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-indigo-600 text-white">
            <Wallet className="h-4 w-4" />
          </span>
          <span className="hidden sm:inline">SmartSpend AI</span>
        </div>

        <nav className="flex items-center gap-1">
          {links.map(({ href, label, icon: Icon }) => {
            const active = pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                  active ? "bg-indigo-600 text-white" : "text-gray-600 hover:bg-gray-100"
                }`}
              >
                <Icon className="h-4 w-4" />
                <span className="hidden sm:inline">{label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-3">
          {userEmail && (
            <span className="hidden text-sm text-gray-500 md:inline">{userEmail}</span>
          )}
          <Link
            href="/settings"
            aria-label="Profil ve Ayarlar"
            className={`rounded-lg p-1.5 transition-colors ${
              pathname.startsWith("/settings")
                ? "bg-indigo-600 text-white"
                : "text-gray-500 hover:bg-gray-100"
            }`}
          >
            <Settings className="h-4 w-4" />
          </Link>
          <LogoutButton />
        </div>
      </div>
    </header>
  );
}
