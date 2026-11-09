/** Marca pequena de duas cores (azul/coral) — não há um arquivo de logo real; é um ícone simples como placeholder. */
export function LogoMark({ size = 28 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 28 28"
      fill="none"
      aria-hidden="true"
      className="shrink-0"
    >
      <circle cx="14" cy="14" r="13" style={{ fill: "var(--design-accent-soft)" }} />
      <path
        d="M14 1a13 13 0 0 1 0 26 13 13 0 0 1 0-26Z"
        style={{ fill: "var(--design-accent)" }}
        opacity="0.92"
      />
      <path
        d="M14 14 27 10A13 13 0 0 1 14 27Z"
        style={{ fill: "var(--design-record)" }}
        opacity="0.9"
      />
    </svg>
  );
}
