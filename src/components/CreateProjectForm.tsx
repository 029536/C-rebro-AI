"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function CreateProjectForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!name.trim()) return;
    setSubmitting(true);
    try {
      const response = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      });
      if (!response.ok) throw new Error("falha ao criar projeto");
      const data: { id: string } = await response.json();
      router.push(`/projetos/${data.id}`);
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-[52px] items-center rounded-xl bg-accent px-5 text-sm font-semibold text-white"
      >
        Novo projeto
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-2">
      <input
        autoFocus
        value={name}
        onChange={(event) => setName(event.target.value)}
        placeholder="Nome do projeto"
        className="h-11 flex-1 rounded-lg border border-border bg-surface px-3 text-sm text-text outline-none focus:border-accent"
      />
      <button
        type="submit"
        disabled={submitting || !name.trim()}
        className="flex h-11 items-center rounded-lg bg-accent px-4 text-sm font-semibold text-white disabled:opacity-60"
      >
        Criar
      </button>
    </form>
  );
}
