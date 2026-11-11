import type Anthropic from "@anthropic-ai/sdk";
import { buildContext } from "@/lib/ai/context";
import { chatSystemPrompt } from "@/lib/ai/prompts";
import { minutesDocumentSchema } from "@/lib/minutes/schema";
import { buildSessionChain } from "@/lib/meetings";
import { participantsSchema } from "@/lib/participants";
import { fetchCurrentPlan } from "@/lib/plans/service";
import { buildProjectContextBlock } from "@/lib/projects/context";
import { reviewContentSchema } from "@/lib/reviews/schema";
import type { createClient } from "@/lib/supabase/server";

type Supabase = Awaited<ReturnType<typeof createClient>>;

/**
 * Ids das reuniões da mesma conversa (corrente `link_type = 'session'`),
 * da mais antiga para a mais nova, incluindo `meetingId`. É o que faz o chat
 * ser "um só por conversa" mesmo entre sessões em dias diferentes.
 */
export async function getSessionChainMeetingIds(supabase: Supabase, meetingId: string): Promise<string[]> {
  const { data: edges } = await supabase
    .from("meeting_links")
    .select("meeting_id, previous_meeting_id")
    .eq("link_type", "session");

  const sessionEdges = (edges ?? []).map((edge) => ({
    meetingId: edge.meeting_id,
    previousMeetingId: edge.previous_meeting_id,
  }));
  return buildSessionChain(sessionEdges, meetingId);
}

/** Mensagens de todas as sessões da conversa, em ordem — para a tela mostrar o histórico. */
export async function fetchChatHistory(
  supabase: Supabase,
  meetingId: string
): Promise<{ id: string; role: "user" | "assistant"; content: string; created_at: string }[]> {
  const chainIds = await getSessionChainMeetingIds(supabase, meetingId);
  const { data } = await supabase
    .from("chat_messages")
    .select("id, role, content, created_at")
    .in("meeting_id", chainIds)
    .order("created_at", { ascending: true });
  return data ?? [];
}

export async function appendChatMessage(
  supabase: Supabase,
  meetingId: string,
  role: "user" | "assistant",
  content: string
): Promise<void> {
  await supabase.from("chat_messages").insert({ meeting_id: meetingId, role, content });
}

/**
 * Monta o prompt estável (resumo de cada sessão + andamento) e o histórico de
 * mensagens para o chat. Custo controlado: usa a ata/parecer de cada sessão
 * (já são resumos), não a transcrição inteira — só cai para a transcrição de
 * uma sessão que ainda não tem ata nem parecer prontos (reunião em andamento).
 */
export async function buildChatContext(
  supabase: Supabase,
  meetingId: string
): Promise<{
  system: string;
  messages: Anthropic.MessageParam[];
  hasContent: boolean;
  projectContext: string | null;
} | null> {
  const chainIds = await getSessionChainMeetingIds(supabase, meetingId);

  const [
    { data: meetingsRows },
    { data: minutesRows },
    { data: reviewRows },
    { data: chatRows },
    { data: companyContext },
  ] = await Promise.all([
    supabase
      .from("meetings")
      .select("id, title, started_at, meeting_type, client_name, participants, context, status, project_id")
      .in("id", chainIds),
    supabase
      .from("meeting_minutes")
      .select("meeting_id, status, content, created_at")
      .in("meeting_id", chainIds)
      .order("created_at", { ascending: false }),
    supabase
      .from("meeting_reviews")
      .select("meeting_id, status, content, created_at")
      .in("meeting_id", chainIds)
      .order("created_at", { ascending: false }),
    supabase
      .from("chat_messages")
      .select("role, content, created_at")
      .in("meeting_id", chainIds)
      .order("created_at", { ascending: true }),
    supabase.from("company_context").select("context").maybeSingle(),
  ]);

  const meetings = meetingsRows ?? [];
  if (meetings.length === 0) return null;
  const orderedMeetings = [...meetings].sort((a, b) => chainIds.indexOf(a.id) - chainIds.indexOf(b.id));

  const latestReadyMinutesByMeeting = new Map<string, string>();
  for (const row of minutesRows ?? []) {
    if (latestReadyMinutesByMeeting.has(row.meeting_id) || row.status !== "ready") continue;
    const parsed = minutesDocumentSchema.safeParse(row.content);
    if (parsed.success) {
      latestReadyMinutesByMeeting.set(
        row.meeting_id,
        `Resumo executivo: ${parsed.data.resumo_executivo}`
      );
    }
  }

  const latestReadyReviewByMeeting = new Map<string, string>();
  for (const row of reviewRows ?? []) {
    if (latestReadyReviewByMeeting.has(row.meeting_id) || row.status !== "ready") continue;
    const parsed = reviewContentSchema.safeParse(row.content);
    if (parsed.success) {
      latestReadyReviewByMeeting.set(
        row.meeting_id,
        `Diagnóstico: ${parsed.data.diagnostico}\nAvaliação: ${parsed.data.avaliacao}`
      );
    }
  }

  // Sessões sem ata nem parecer prontos (normalmente só a reunião atual, ainda em
  // andamento): cai para a transcrição disponível, em vez de deixar sem contexto.
  const idsNeedingTranscript = orderedMeetings
    .filter((meeting) => !latestReadyMinutesByMeeting.has(meeting.id) && !latestReadyReviewByMeeting.has(meeting.id))
    .map((meeting) => meeting.id);

  const transcriptByMeeting = new Map<string, string>();
  if (idsNeedingTranscript.length > 0) {
    const [{ data: chunksRows }, { data: checkpointsRows }] = await Promise.all([
      supabase
        .from("meeting_chunks")
        .select("meeting_id, idx, part_no, transcript")
        .in("meeting_id", idsNeedingTranscript)
        .order("idx", { ascending: true }),
      supabase
        .from("meeting_checkpoints")
        .select("meeting_id, part_no, summary")
        .in("meeting_id", idsNeedingTranscript),
    ]);
    for (const id of idsNeedingTranscript) {
      const chunks = (chunksRows ?? []).filter((chunk) => chunk.meeting_id === id);
      if (chunks.length === 0) continue;
      const checkpoints = (checkpointsRows ?? []).filter((checkpoint) => checkpoint.meeting_id === id);
      const built = buildContext({
        checkpoints: checkpoints.map((checkpoint) => ({ partNo: checkpoint.part_no, summary: checkpoint.summary })),
        chunks: chunks.map((chunk) => ({ idx: chunk.idx, partNo: chunk.part_no, transcript: chunk.transcript })),
        currentPartNo: chunks[chunks.length - 1].part_no,
      });
      transcriptByMeeting.set(id, built.transcriptBlock);
    }
  }

  const hasContent =
    latestReadyMinutesByMeeting.size > 0 ||
    latestReadyReviewByMeeting.size > 0 ||
    transcriptByMeeting.size > 0 ||
    (chatRows ?? []).length > 0;

  const sessionsBlock = orderedMeetings
    .map((meeting) => {
      const parts: string[] = [];
      const minutes = latestReadyMinutesByMeeting.get(meeting.id);
      const review = latestReadyReviewByMeeting.get(meeting.id);
      const transcript = transcriptByMeeting.get(meeting.id);
      if (minutes) parts.push(minutes);
      if (review) parts.push(review);
      if (!minutes && !review) {
        parts.push(transcript ? `Transcrição disponível: ${transcript}` : "Ainda sem conteúdo.");
      }
      const participantsParsed = participantsSchema.safeParse(meeting.participants);
      const clientLine = meeting.client_name ? ` · Cliente: ${meeting.client_name}` : "";
      return `<sessao titulo="${meeting.title}" data="${meeting.started_at}"${clientLine}>\n${parts.join("\n")}${
        participantsParsed.success && participantsParsed.data.length > 0
          ? `\nParticipantes: ${participantsParsed.data.map((participant) => participant.name).join(", ")}`
          : ""
      }\n</sessao>`;
    })
    .join("\n\n");

  const currentPlan = await fetchCurrentPlan(supabase, meetingId);
  const andamentoBlock =
    currentPlan && currentPlan.tasks.length > 0
      ? currentPlan.tasks
          .map((task) => `- [${task.status}] ${task.title}${task.progress_note ? ` (${task.progress_note})` : ""}`)
          .join("\n")
      : null;

  const system = chatSystemPrompt({
    companyContext: companyContext?.context ?? "",
    sessionsBlock: sessionsBlock || "Nenhuma sessão com conteúdo ainda.",
    andamentoBlock,
  });

  const messages: Anthropic.MessageParam[] = (chatRows ?? []).map((row) => ({
    role: row.role,
    content: row.content,
  }));

  const currentMeeting = orderedMeetings.find((meeting) => meeting.id === meetingId);
  const lastUserMessage = [...(chatRows ?? [])].reverse().find((row) => row.role === "user");
  const projectContext = currentMeeting?.project_id
    ? await buildProjectContextBlock(supabase, currentMeeting.project_id, lastUserMessage?.content ?? "")
    : null;

  return { system, messages, hasContent, projectContext };
}
