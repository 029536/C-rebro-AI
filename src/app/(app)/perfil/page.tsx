import { Archive, ChevronRight, FolderOpen, Settings } from "lucide-react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "../actions";

export default async function PerfilPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const email = user?.email ?? "";

  return (
    <div className="flex flex-1 flex-col gap-6 p-4">
      <div className="flex items-center gap-3">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-accent-soft text-lg font-semibold text-accent">
          {email ? email.charAt(0).toUpperCase() : "?"}
        </span>
        <div>
          <p className="font-semibold text-text">{email || "Sua conta"}</p>
          <p className="text-sm text-text-secondary">Saber Crescer</p>
        </div>
      </div>

      <nav className="flex flex-col divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface shadow-sm">
        <Link href="/configuracoes" className="flex min-h-14 items-center justify-between px-4 text-text">
          <span className="flex items-center gap-3">
            <Settings size={20} className="text-text-secondary" />
            Configurações
          </span>
          <ChevronRight size={18} className="text-text-secondary" />
        </Link>
        <Link href="/projetos" className="flex min-h-14 items-center justify-between px-4 text-text">
          <span className="flex items-center gap-3">
            <FolderOpen size={20} className="text-text-secondary" />
            Projetos
          </span>
          <ChevronRight size={18} className="text-text-secondary" />
        </Link>
        <Link href="/?arquivadas=1" className="flex min-h-14 items-center justify-between px-4 text-text">
          <span className="flex items-center gap-3">
            <Archive size={20} className="text-text-secondary" />
            Reuniões arquivadas
          </span>
          <ChevronRight size={18} className="text-text-secondary" />
        </Link>
      </nav>

      <form action={signOut}>
        <button type="submit" className="flex min-h-11 items-center font-semibold text-record">
          Sair
        </button>
      </form>
    </div>
  );
}
