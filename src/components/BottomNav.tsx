"use client";

import { FolderOpen, Mic, Settings, Users } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  { href: "/", label: "Reuniões", icon: Users },
  { href: "/nova", label: "Nova", icon: Mic },
  { href: "/projetos", label: "Projetos", icon: FolderOpen },
  { href: "/configuracoes", label: "Configurações", icon: Settings },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-10 flex h-16 border-t border-border bg-surface md:hidden">
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
