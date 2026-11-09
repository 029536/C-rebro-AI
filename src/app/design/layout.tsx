// Prévia visual do redesenho (rota temporária, atrás do login — o proxy já
// protege tudo exceto /login). Layout próprio, sem o cabeçalho/nav do app
// em produção: aqui o objetivo é só aprovar o visual antes de ligar aos
// dados reais.
export default function DesignLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-full bg-design-bg font-sans text-design-text">
      <div className="mx-auto flex min-h-full max-w-md flex-col">{children}</div>
    </div>
  );
}
