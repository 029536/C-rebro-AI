import type Anthropic from "@anthropic-ai/sdk";
import { getAnthropicClient } from "./anthropic";

const MAX_TOKENS = 4_000;

const MOCK_REPLY =
  "Resposta simulada (MOCK_AI=1): com base no que foi discutido, o próximo passo prático seria validar o escopo com o cliente antes de começar a construir.";

export type ChatStreamResult = {
  /** Bytes de texto, prontos para a resposta HTTP (ver app/api/meetings/[id]/chat/route.ts). */
  stream: ReadableStream<Uint8Array>;
  /** Resolve com o texto completo quando a resposta terminar — usado para gravar em chat_messages. */
  done: Promise<string>;
};

/**
 * Pede a resposta do Claude para o chat da reunião, em streaming. O prompt é
 * ESTÁVEL por conversa (resumo das sessões + andamento, sem o histórico de
 * mensagens) e vai com `cache_control`; o histórico e a pergunta nova entram
 * em `messages`.
 */
export function streamChatReply(params: {
  system: string;
  messages: Anthropic.MessageParam[];
}): ChatStreamResult {
  const encoder = new TextEncoder();

  if (process.env.MOCK_AI === "1") {
    const parts = MOCK_REPLY.split(" ");
    let resolveDone: (text: string) => void;
    const done = new Promise<string>((resolve) => {
      resolveDone = resolve;
    });
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        for (const [index, word] of parts.entries()) {
          controller.enqueue(encoder.encode(index === 0 ? word : ` ${word}`));
        }
        controller.close();
        resolveDone(MOCK_REPLY);
      },
    });
    return { stream, done };
  }

  const client = getAnthropicClient();
  const anthropicStream = client.messages.stream({
    model: process.env.CLAUDE_MODEL || "claude-sonnet-5-5",
    max_tokens: MAX_TOKENS,
    system: [{ type: "text", text: params.system, cache_control: { type: "ephemeral" } }],
    messages: params.messages,
  });

  let full = "";
  let resolveDone: (text: string) => void;
  let rejectDone: (error: unknown) => void;
  const done = new Promise<string>((resolve, reject) => {
    resolveDone = resolve;
    rejectDone = reject;
  });

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      anthropicStream.on("text", (delta) => {
        full += delta;
        controller.enqueue(encoder.encode(delta));
      });
      anthropicStream.on("end", () => {
        controller.close();
        resolveDone(full);
      });
      anthropicStream.on("error", (error) => {
        try {
          controller.error(error);
        } catch {
          // já encerrado
        }
        rejectDone(error);
      });
    },
    cancel() {
      anthropicStream.abort();
    },
  });

  return { stream, done };
}
