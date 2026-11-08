import { BottomNav } from "@/components/BottomNav";
import { signOut } from "./actions";

export default function AppLayout({
  children,
  modal,
}: {
  children: React.ReactNode;
  modal: React.ReactNode;
}) {
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="flex h-16 items-center justify-between border-b border-border bg-surface px-4">
        <span className="font-semibold text-text">Cérebro IA</span>
        <form action={signOut}>
          <button
            type="submit"
            className="flex min-h-11 items-center text-sm font-medium text-text-secondary"
          >
            Sair
          </button>
        </form>
      </header>
      <main className="flex flex-1 flex-col pb-16 md:pb-0">{children}</main>
      {modal}
      <BottomNav />
    </div>
  );
}
