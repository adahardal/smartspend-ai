"use client";

import {
  FileText,
  LayoutDashboard,
  MessageCircle,
  Receipt,
  Repeat,
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
      <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-6 py-3">
        <div className="flex items-center gap-2 font-semibold">
          <Wallet className="h-5 w-5" />
          SmartSpend AI
        </div>

        <nav className="flex items-center gap-1">
          {links.map(({ href, label, icon: Icon }) => {
            const active = pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                  active ? "bg-black text-white" : "text-gray-600 hover:bg-gray-100"
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
          <LogoutButton />
        </div>
      </div>
    </header>
  );
}
