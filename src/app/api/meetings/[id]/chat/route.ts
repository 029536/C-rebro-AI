import { NextResponse } from "next/server";
import { z } from "zod";
import {
  describeAnthropicError,
  describeAnthropicErrorDetail,
  statusForAnthropicError,
} from "@/lib/ai/anthropic";
import { streamChatReply } from "@/lib/ai/chat";
import { redactSecrets } from "@/lib/ai/env";
import { appendChatMessage, buildChatContext } from "@/lib/chat/service";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 120;

const bodySchema = z.object({
  message: z.string().trim().min(1).max(4_000),
});

/**
 * Conversa sobre a reunião (contínua entre sessões — ver "Sessões" no
 * CLAUDE.md). Resposta em streaming: o texto vai sendo escrito direto no
 * corpo da resposta, e a mensagem completa só é gravada em `chat_messages`
 * quando o streaming termina (ver `streamChatReply`).
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: meetingId } = await params;
  const body = await request.json().catch(() => ({}));
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Escreva uma mensagem antes de enviar." }, { status: 400 });
  }

  const supabase = await createClient();

  const { data: meeting } = await supabase.from("meetings").select("id").eq("id", meetingId).maybeSingle();
  if (!meeting) {
    return NextResponse.json({ error: "Reunião não encontrada." }, { status: 404 });
  }

  await appendChatMessage(supabase, meetingId, "user", parsed.data.message);

  const context = await buildChatContext(supabase, meetingId);
  if (!context) {
    return NextResponse.json({ error: "Reunião não encontrada." }, { status: 404 });
  }

  try {
    const { stream, done } = streamChatReply({ system: context.system, messages: context.messages });

    done
      .then((text) => appendChatMessage(supabase, meetingId, "assistant", text))
      .catch((error) => {
        console.error("Falha ao salvar a resposta do chat:", redactSecrets(String(error)));
      });

    return new Response(stream, {
      headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
    });
  } catch (error) {
    return NextResponse.json(
      { error: describeAnthropicError(error), error_detail: describeAnthropicErrorDetail(error) },
      { status: statusForAnthropicError(error) }
    );
  }
}
