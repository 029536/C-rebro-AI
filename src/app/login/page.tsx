import type { Metadata } from "next";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = {
  title: "Entrar — Cérebro IA",
};

export default function LoginPage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-8 px-4 py-16">
      <div className="flex flex-col items-center gap-1 text-center">
        <h1 className="text-2xl font-semibold text-text">Cérebro IA</h1>
        <p className="text-text-secondary">Entre para acessar suas reuniões.</p>
      </div>
      <LoginForm />
    </main>
  );
}
