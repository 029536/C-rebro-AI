import { extractText, getAnthropicClient } from "./anthropic";
import { COPILOT_NO_CONTRIBUTION, copilotSystemPrompt, copilotUserMessage, type CopilotKind } from "./prompts";

const MOCK_OPINION =
  "Opinião simulada (MOCK_AI=1): antes de prometer a integração, vale confirmar se o sistema do cliente expõe uma API de verdade — sem isso o prazo muda. Próximo passo: pedir a documentação técnica antes da próxima reunião.";
const MOCK_QUESTIONS =
  "1) O sistema do cliente tem uma API documentada?\n2) Quem decide o prazo final dessa integração?";
const MOCK_ANSWER = "Resposta simulada (MOCK_AI=1): com base no que foi dito, ainda não há decisão sobre isso.";
const MAX_TOKENS = 4_000;

const MOCK_BY_KIND: Record<CopilotKind, string> = {
  opiniao: MOCK_OPINION,
  pergunta: MOCK_QUESTIONS,
  resposta: MOCK_ANSWER,
};

/**
 * Pede uma opinião/pergunta/resposta ao copiloto, em texto livre. `null`
 * quando o Claude não teve nada a acrescentar (só acontece no tipo
 * "opiniao" — "pergunta" e "resposta" sempre respondem algo).
 *
 * O prompt de sistema (company/meeting context) é estável entre pedidos da
 * mesma reunião e vai com `cache_control: ephemeral`: resumo, última
 * opinião, pergunta do usuário e transcrição recente — que mudam a cada
 * pedido — ficam na mensagem do usuário, fora do prefixo cacheado.
 */
export async function generateOpinion(params: {
  kind: CopilotKind;
  companyContext: string;
  meetingContext?: string;
  summary?: string | null;
  previousOpinion?: string | null;
  question?: string | null;
  recentTranscript: string;
}): Promise<string | null> {
  if (process.env.MOCK_AI === "1") {
    return MOCK_BY_KIND[params.kind];
  }

  const message = await getAnthropicClient().messages.create({
    model: process.env.CLAUDE_MODEL || "claude-sonnet-5-5",
    max_tokens: MAX_TOKENS,
    system: [
      {
        type: "text",
        text: copilotSystemPrompt({
          companyContext: params.companyContext,
          meetingContext: params.meetingContext,
        }),
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [
      {
        role: "user",
        content: copilotUserMessage({
          kind: params.kind,
          summary: params.summary,
          previousOpinion: params.previousOpinion,
          question: params.question,
          recentTranscript: params.recentTranscript,
        }),
      },
    ],
  });

  const text = extractText(message.content).trim();
  if (!text || (params.kind === "opiniao" && text === COPILOT_NO_CONTRIBUTION)) {
    return null;
  }
  return text;
}
