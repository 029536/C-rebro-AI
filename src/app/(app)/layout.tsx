import { signOut } from "./actions";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="flex h-16 items-center justify-between border-b border-border bg-surface px-4">
        <span className="font-semibold text-text">Cérebro IA</span>
        <form action={signOut}>
          <button type="submit" className="text-sm font-medium text-text-secondary">
            Sair
          </button>
        </form>
      </header>
      <main className="flex flex-1 flex-col">{children}</main>
    </div>
  );
}
