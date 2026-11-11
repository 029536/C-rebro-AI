"use client";

import { Search } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

type SearchResult = { kind: string; meeting_id: string; title: string; snippet: string; rank: number };

const KIND_LABEL: Record<string, string> = {
  reuniao: "Reunião",
  ata: "Ata",
  parecer: "Parecer",
  tarefa: "Tarefa",
};

const KIND_STYLE: Record<string, string> = {
  reuniao: "bg-accent-soft text-accent",
  ata: "bg-badge-ata-bg text-badge-ata-text",
  parecer: "bg-badge-parecer-bg text-badge-parecer-text",
  tarefa: "bg-badge-andamento-bg text-badge-andamento-text",
};

export default function PesquisarPage() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const trimmed = query.trim();

    debounceRef.current = setTimeout(async () => {
      if (trimmed.length < 2) {
        setResults([]);
        setSearching(false);
        setError(null);
        return;
      }

      setSearching(true);
      try {
        const response = await fetch(`/api/search?q=${encodeURIComponent(trimmed)}`);
        const data = await response.json();
        if (!response.ok) {
          setError(data?.error ?? "Não foi possível pesquisar agora.");
          setResults([]);
        } else {
          setError(null);
          setResults(data.results ?? []);
        }
      } catch {
        setError("Não foi possível pesquisar agora.");
      } finally {
        setSearching(false);
      }
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  return (
    <div className="flex flex-1 flex-col gap-4 p-4">
      <h1 className="text-2xl font-bold text-text">Pesquisar</h1>
      <div className="flex h-14 items-center gap-2 rounded-xl border border-border bg-surface px-4">
        <Search size={18} className="text-text-secondary" />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Buscar por cliente, título, participante..."
          className="flex-1 bg-transparent text-text outline-none placeholder:text-text-secondary"
        />
      </div>

      {error && <p className="text-sm text-record">{error}</p>}
      {searching && <p className="text-text-secondary">Pesquisando...</p>}

      {!searching && query.trim().length >= 2 && results.length === 0 && !error && (
        <p className="text-text-secondary">Nada encontrado para &ldquo;{query.trim()}&rdquo;.</p>
      )}

      <div className="flex flex-col gap-2">
        {results.map((result, index) => (
          <Link
            key={`${result.kind}-${result.meeting_id}-${index}`}
            href={`/reunioes/${result.meeting_id}`}
            className="flex flex-col gap-1 rounded-xl border border-border bg-surface p-4 shadow-sm"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="font-semibold text-text">{result.title}</span>
              <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${KIND_STYLE[result.kind] ?? "bg-border text-text-secondary"}`}>
                {KIND_LABEL[result.kind] ?? result.kind}
              </span>
            </div>
            <p className="text-sm text-text-secondary">{result.snippet}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
