import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/session";

// No Next.js 16+ este arquivo substitui o antigo middleware.ts (renomeado para "proxy").
export function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    // .mjs cobre public/pdf.worker.min.mjs (worker do pdf.js): é estático, não
    // precisa do custo de checar sessão a cada carga, e evita qualquer problema
    // de cookie não ir junto na requisição que o navegador faz para o Worker.
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|mjs)$).*)",
  ],
};
