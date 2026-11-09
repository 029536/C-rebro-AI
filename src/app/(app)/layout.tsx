import { User } from "lucide-react";
import Link from "next/link";
import { BottomNav } from "@/components/BottomNav";
import { LogoMark } from "@/components/LogoMark";
import { createClient } from "@/lib/supabase/server";

export default async function AppLayout({
  children,
  modal,
}: {
  children: React.ReactNode;
  modal: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const email = user?.email ?? null;

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="flex h-14 items-center justify-between border-b border-border bg-surface px-4">
        <div className="flex items-center gap-2">
          <LogoMark />
          <span className="font-semibold text-text">Cérebro IA</span>
        </div>
        <Link
          href="/perfil"
          aria-label="Perfil"
          className="flex h-10 w-10 items-center justify-center rounded-full bg-accent-soft text-sm font-semibold text-accent"
        >
          {email ? email.charAt(0).toUpperCase() : <User size={18} />}
        </Link>
      </header>
      <main className="flex flex-1 flex-col pb-16 md:pb-0">{children}</main>
      {modal}
      <BottomNav />
    </div>
  );
}
