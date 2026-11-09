import { NextResponse } from "next/server";
import { z } from "zod";
import { describeAnthropicError, statusForAnthropicError } from "@/lib/ai/anthropic";
import { PREPARE_MEETING_INPUT_SCHEMA, PREPARE_MEETING_TOOL_NAME, prepareMeetingSystemPrompt } from "@/lib/ai/prompts";
import { callStructuredTool } from "@/lib/ai/structuredTool";
import { participantsSchema } from "@/lib/participants";

export const maxDuration = 30;

const requestSchema = z.object({ text: z.string().trim().min(1).max(2_000) });

const preparedMeetingSchema = z.object({
  meeting_type: z.enum(["client", "internal"]).nullable(),
  title: z.string().max(200).nullable(),
  client_name: z.string().max(200).nullable(),
  participants: participantsSchema,
  context: z.string().max(2_000).nullable(),
});

// Mesmo exemplo do pedido original ("reunião com a Dra. Marina... participam eu e a Ana
// Julia"): "eu" não é um nome que dá para registrar com segurança, por isso fica de fora.
const MOCK_RESULT = {
  meeting_type: "client" as const,
  title: null,
  client_name: "Dra. Marina — escritório de advocacia",
  participants: [{ name: "Ana Julia" }],
  context: "Automação de contratos (MOCK_AI=1).",
};

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Descreva a reunião em algumas frases." }, { status: 400 });
  }

  if (process.env.MOCK_AI === "1") {
    return NextResponse.json(MOCK_RESULT);
  }

  try {
    const input = await callStructuredTool({
      model: process.env.CLAUDE_FAST_MODEL || "claude-haiku-5-5",
      maxTokens: 800,
      system: prepareMeetingSystemPrompt(),
      messages: [{ role: "user", content: parsed.data.text }],
      toolName: PREPARE_MEETING_TOOL_NAME,
      toolDescription: "Preenche os campos do formulário de nova reunião a partir do texto do usuário.",
      inputSchema: PREPARE_MEETING_INPUT_SCHEMA,
    });

    const parsedResult = preparedMeetingSchema.safeParse(input);
    if (!parsedResult.success) {
      return NextResponse.json({ error: "Não consegui entender a descrição." }, { status: 502 });
    }

    return NextResponse.json(parsedResult.data);
  } catch (error) {
    return NextResponse.json(
      { error: describeAnthropicError(error) },
      { status: statusForAnthropicError(error) }
    );
  }
}
