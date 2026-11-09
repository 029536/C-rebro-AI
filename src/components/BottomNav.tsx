"use client";

import { Home, Search, User } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  { href: "/", label: "Início", icon: Home },
  { href: "/pesquisar", label: "Pesquisar", icon: Search },
  { href: "/perfil", label: "Perfil", icon: User },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-10 flex h-16 border-t border-border bg-surface-bottom md:hidden">
      {ITEMS.map((item) => {
        const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex flex-1 flex-col items-center justify-center gap-0.5 text-xs font-medium ${
              active ? "text-accent" : "text-text-secondary"
            }`}
          >
            <Icon size={22} strokeWidth={active ? 2.25 : 2} />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
