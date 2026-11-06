import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/session";

// No Next.js 16+ este arquivo substitui o antigo middleware.ts (renomeado para "proxy").
export function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
