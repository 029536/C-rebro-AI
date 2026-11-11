"use client";

import { Upload, X } from "lucide-react";
import { useRef, useState } from "react";

export type CompanyContextData = {
  context: string;
  vocabulary: string;
  letterhead: string;
  letterhead_logo: string | null;
};

const MAX_LOGO_BYTES = 150 * 1024;
const LETTERHEAD_MAX_LINES = 5;

function parseVocabulary(value: string): string[] {
  return value
    .split(",")
    .map((term) => term.trim())
    .filter(Boolean);
}

async function fileToDataUri(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("falha ao ler o arquivo"));
    reader.readAsDataURL(file);
  });
}

/** Tela de Configurações: contexto da empresa, vocabulário e cabeçalho da ata. */
export function CompanyContextForm({ initial }: { initial: CompanyContextData }) {
  const [context, setContext] = useState(initial.context);
  const [contextSaved, setContextSaved] = useState(false);
  const [contextSaving, setContextSaving] = useState(false);

  const [vocabularyInput, setVocabularyInput] = useState("");
  const [vocabularyTerms, setVocabularyTerms] = useState(parseVocabulary(initial.vocabulary));
  const [vocabularySaved, setVocabularySaved] = useState(false);

  const [letterhead, setLetterhead] = useState(initial.letterhead);
  const [letterheadLogo, setLetterheadLogo] = useState(initial.letterhead_logo);
  const [letterheadSaving, setLetterheadSaving] = useState(false);
  const [letterheadSaved, setLetterheadSaved] = useState(false);
  const [logoError, setLogoError] = useState<string | null>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);

  async function patch(body: Partial<CompanyContextData>) {
    const response = await fetch("/api/company-context", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return response.ok;
  }

  async function saveContext() {
    setContextSaving(true);
    const ok = await patch({ context });
    setContextSaving(false);
    if (ok) {
      setContextSaved(true);
      setTimeout(() => setContextSaved(false), 1500);
    }
  }

  async function saveVocabulary(nextTerms: string[]) {
    setVocabularyTerms(nextTerms);
    const ok = await patch({ vocabulary: nextTerms.join(", ") });
    if (ok) {
      setVocabularySaved(true);
      setTimeout(() => setVocabularySaved(false), 1500);
    }
  }

  function addVocabularyTerm() {
    const term = vocabularyInput.trim();
    if (!term || vocabularyTerms.includes(term)) {
      setVocabularyInput("");
      return;
    }
    setVocabularyInput("");
    saveVocabulary([...vocabularyTerms, term]);
  }

  function removeVocabularyTerm(term: string) {
    saveVocabulary(vocabularyTerms.filter((item) => item !== term));
  }

  async function saveLetterhead() {
    const lineCount = letterhead.split("\n").filter((line) => line.trim()).length;
    if (lineCount > LETTERHEAD_MAX_LINES) {
      setLogoError(`O cabeçalho deve ter no máximo ${LETTERHEAD_MAX_LINES} linhas.`);
      return;
    }
    setLogoError(null);
    setLetterheadSaving(true);
    const ok = await patch({ letterhead });
    setLetterheadSaving(false);
    if (ok) {
      setLetterheadSaved(true);
      setTimeout(() => setLetterheadSaved(false), 1500);
    }
  }

  async function handleLogoSelected(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setLogoError(null);
    if (file.size > MAX_LOGO_BYTES) {
      setLogoError("A imagem precisa ter no máximo 150 KB — escolha um logo menor.");
      if (logoInputRef.current) logoInputRef.current.value = "";
      return;
    }
    if (!file.type.startsWith("image/")) {
      setLogoError("Escolha um arquivo de imagem.");
      return;
    }
    const dataUri = await fileToDataUri(file);
    setLetterheadLogo(dataUri);
    await patch({ letterhead_logo: dataUri });
    if (logoInputRef.current) logoInputRef.current.value = "";
  }

  async function removeLogo() {
    setLetterheadLogo(null);
    await patch({ letterhead_logo: null });
  }

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-2 rounded-2xl border border-border bg-surface p-4 shadow-sm">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-text-secondary">
          Contexto da empresa
        </h2>
        <p className="text-xs text-text-secondary">
          Nome, o que a empresa faz, produtos, sócios/equipe, público e o tom desejado nas
          respostas do Claude. Texto livre.
        </p>
        <textarea
          value={context}
          onChange={(event) => setContext(event.target.value)}
          rows={6}
          placeholder="Ex.: Saber Crescer é uma empresa de educação... Sócios: ... Produtos: ... Público: ... Tom: direto e objetivo."
          className="rounded-lg border border-border bg-background p-3 text-sm text-text outline-none"
        />
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={saveContext}
            disabled={contextSaving}
            className="flex h-10 items-center justify-center rounded-lg bg-accent px-5 text-sm font-semibold text-white disabled:opacity-60"
          >
            {contextSaving ? "Salvando..." : "Salvar"}
          </button>
          {contextSaved && <span className="text-xs font-semibold text-accent">Salvo.</span>}
        </div>
      </section>

      <section className="flex flex-col gap-2 rounded-2xl border border-border bg-surface p-4 shadow-sm">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-text-secondary">Vocabulário</h2>
        <p className="text-xs text-text-secondary">
          Termos, nomes próprios e siglas (ex.: Saber Crescer, Lumi, ENEM) — ajuda o Whisper a
          transcrever certo e o Claude a grafar os nomes do jeito certo.
        </p>
        <div className="flex flex-wrap gap-2">
          {vocabularyTerms.map((term) => (
            <span
              key={term}
              className="flex items-center gap-1.5 rounded-full bg-accent-soft px-3 py-1 text-xs font-medium text-accent"
            >
              {term}
              <button type="button" onClick={() => removeVocabularyTerm(term)} aria-label={`Remover ${term}`}>
                <X size={12} />
              </button>
            </span>
          ))}
          {vocabularyTerms.length === 0 && (
            <span className="text-xs text-text-secondary">Nenhum termo cadastrado ainda.</span>
          )}
        </div>
        <div className="flex gap-2">
          <input
            value={vocabularyInput}
            onChange={(event) => setVocabularyInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                addVocabularyTerm();
              }
            }}
            placeholder="Adicionar termo..."
            className="h-10 flex-1 rounded-lg border border-border bg-background px-3 text-sm text-text outline-none"
          />
          <button
            type="button"
            onClick={addVocabularyTerm}
            className="flex h-10 items-center justify-center rounded-lg border border-border px-4 text-sm font-semibold text-accent"
          >
            Adicionar
          </button>
        </div>
        {vocabularySaved && <span className="text-xs font-semibold text-accent">Salvo.</span>}
      </section>

      <section className="flex flex-col gap-2 rounded-2xl border border-border bg-surface p-4 shadow-sm">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-text-secondary">
          Cabeçalho da ata
        </h2>
        <p className="text-xs text-text-secondary">
          Nome da empresa, endereço/contatos e rodapé — até {LETTERHEAD_MAX_LINES} linhas. Aparece
          no topo da ata exibida e nas exportações.
        </p>
        <textarea
          value={letterhead}
          onChange={(event) => setLetterhead(event.target.value)}
          rows={LETTERHEAD_MAX_LINES}
          placeholder={"Saber Crescer\nRua Exemplo, 123 — Cidade/UF\ncontato@sabercrescer.com.br"}
          className="rounded-lg border border-border bg-background p-3 text-sm text-text outline-none"
        />

        <div className="flex items-center gap-3">
          {letterheadLogo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={letterheadLogo} alt="Logo da empresa" className="h-12 w-auto rounded border border-border" />
          ) : (
            <span className="text-xs text-text-secondary">Sem logo.</span>
          )}
          <label className="flex h-10 items-center gap-1.5 rounded-lg border border-border px-3 text-xs font-semibold text-accent">
            <Upload size={14} />
            {letterheadLogo ? "Trocar logo" : "Enviar logo"}
            <input ref={logoInputRef} type="file" accept="image/*" onChange={handleLogoSelected} className="hidden" />
          </label>
          {letterheadLogo && (
            <button type="button" onClick={removeLogo} className="text-xs font-semibold text-record">
              Remover
            </button>
          )}
        </div>
        {logoError && <p className="text-xs text-record">{logoError}</p>}

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={saveLetterhead}
            disabled={letterheadSaving}
            className="flex h-10 items-center justify-center rounded-lg bg-accent px-5 text-sm font-semibold text-white disabled:opacity-60"
          >
            {letterheadSaving ? "Salvando..." : "Salvar"}
          </button>
          {letterheadSaved && <span className="text-xs font-semibold text-accent">Salvo.</span>}
        </div>
      </section>
    </div>
  );
}
