/** Marca pequena do cabeçalho: "AI" numa badge em duas cores. Não há arquivo de logo real. */
export function LogoMark({ size = 32 }: { size?: number }) {
  return (
    <span
      aria-hidden="true"
      style={{ width: size, height: size, background: "linear-gradient(135deg, var(--accent) 55%, var(--record) 100%)" }}
      className="flex shrink-0 items-center justify-center rounded-xl text-xs font-bold text-white"
    >
      AI
    </span>
  );
}
