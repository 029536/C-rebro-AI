import { CompanyContextForm } from "@/components/CompanyContextForm";
import { createClient } from "@/lib/supabase/server";

export default async function ConfiguracoesPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("company_context")
    .select("context, vocabulary, letterhead, letterhead_logo")
    .maybeSingle();

  return (
    <div className="flex flex-1 flex-col gap-4 p-4">
      <h1 className="text-xl font-semibold text-text">Configurações</h1>
      <CompanyContextForm
        initial={data ?? { context: "", vocabulary: "", letterhead: "", letterhead_logo: null }}
      />
    </div>
  );
}
