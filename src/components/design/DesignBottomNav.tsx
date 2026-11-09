"use client";

import { Home, Menu, Search } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * Nav inferior do redesenho: Início, Pesquisar, Menu (substitui a aba
 * "Perfil" do mockup de referência — Configurações, Projetos, Reuniões
 * arquivadas, Conversas e sessões e Sair ficam dentro do Menu, numa etapa
 * futura). Pesquisar e Menu ainda não têm tela própria nesta prévia.
 */
export function DesignBottomNav() {
  const pathname = usePathname();
  const isHome = pathname === "/design";

  return (
    <nav className="fixed inset-x-0 bottom-0 z-10 mx-auto flex h-16 max-w-md border-t border-design-border bg-design-surface-bottom">
      <Link
        href="/design"
        className={`flex flex-1 flex-col items-center justify-center gap-0.5 text-xs font-medium ${
          isHome ? "text-design-accent" : "text-design-text-secondary"
        }`}
      >
        <Home size={22} strokeWidth={isHome ? 2.25 : 2} />
        Início
      </Link>
      <button
        type="button"
        disabled
        className="flex flex-1 flex-col items-center justify-center gap-0.5 text-xs font-medium text-design-text-secondary opacity-60"
      >
        <Search size={22} />
        Pesquisar
      </button>
      <button
        type="button"
        disabled
        className="flex flex-1 flex-col items-center justify-center gap-0.5 text-xs font-medium text-design-text-secondary opacity-60"
      >
        <Menu size={22} />
        Menu
      </button>
    </nav>
  );
}
