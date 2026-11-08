"use client";

import { X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

/**
 * Painel da ficha da reunião: tela cheia no celular, painel lateral de
 * verdade no desktop (a lista continua visível, só escurecida). Usado pela
 * rota interceptada `@modal/(.)reunioes/[id]`; fecha com `router.back()`.
 */
export function Modal({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") router.back();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [router]);

  return (
    <div className="fixed inset-0 z-20 flex justify-end bg-black/40 md:bg-black/20">
      <div className="flex h-full w-full flex-col bg-background md:max-w-xl md:border-l md:border-border md:shadow-xl">
        <div className="flex h-14 shrink-0 items-center justify-end border-b border-border bg-surface px-2">
          <button
            type="button"
            onClick={() => router.back()}
            aria-label="Fechar"
            className="flex h-11 w-11 items-center justify-center text-text-secondary"
          >
            <X size={22} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}
