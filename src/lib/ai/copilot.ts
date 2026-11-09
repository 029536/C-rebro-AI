import { extractText, getAnthropicClient } from "./anthropic";
import { COPILOT_NO_CONTRIBUTION, copilotSystemPrompt } from "./prompts";

const MOCK_OPINION =
  "Opinião simulada (MOCK_AI=1): antes de prometer a integração, vale confirmar se o sistema do cliente expõe uma API de verdade — sem isso o prazo muda. Próximo passo: pedir a documentação técnica antes da próxima reunião.";
const MAX_TOKENS = 4_000;

/** Gera uma opinião do copiloto em texto livre. `null` quando o Claude não teve nada a acrescentar. */
export async function generateOpinion(params: {
  companyContext: string;
  meetingContext?: string;
  previousOpinions: string[];
  transcript: string;
}): Promise<string | null> {
  if (process.env.MOCK_AI === "1") {
    return MOCK_OPINION;
  }

  const message = await getAnthropicClient().messages.create({
    model: process.env.CLAUDE_MODEL || "claude-sonnet-5-5",
    max_tokens: MAX_TOKENS,
    system: copilotSystemPrompt({
      companyContext: params.companyContext,
      meetingContext: params.meetingContext,
      previousOpinions: params.previousOpinions,
    }),
    messages: [{ role: "user", content: `<transcricao>\n${params.transcript}\n</transcricao>` }],
  });

  const text = extractText(message.content).trim();
  if (!text || text === COPILOT_NO_CONTRIBUTION) {
    return null;
  }
  return text;
}
