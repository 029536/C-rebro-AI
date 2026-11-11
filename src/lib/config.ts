// Constantes ajustáveis do produto. Ver CLAUDE.md para o porquê de cada limite.

/**
 * Duração de cada trecho de áudio gravado no navegador, em segundos — curto
 * de propósito, para a transcrição aparecer ao vivo (o gravador reinicia o
 * MediaRecorder a cada ciclo, nunca usa timeslice: ver lib/recorder/recorder.ts).
 */
export const CHUNK_SECONDS = 27;

/** Duração de uma "parte" de reunião longa, em minutos, antes de gerar um checkpoint. */
export const PART_MINUTES = 45;

/** Tamanho máximo (em caracteres) da transcrição completa para caber inteira no contexto do parecer/plano, em vez de usar checkpoints. */
export const FULL_TRANSCRIPT_MAX_CHARS = 80_000;

/** Tamanho máximo de um trecho de áudio enviado ao servidor, em bytes (abaixo do limite de corpo de requisição da Vercel). */
export const AUDIO_CHUNK_MAX_BYTES = 4 * 1024 * 1024;

/** Tamanho máximo de um arquivo de código para ser aceito na importação de projeto, em bytes. */
export const PROJECT_FILE_MAX_BYTES = 150 * 1024;

/** Número máximo de arquivos aceitos numa importação de projeto. */
export const PROJECT_MAX_FILES = 2000;

/** Tamanho total máximo (em bytes) de texto aceito numa importação de projeto. */
export const PROJECT_MAX_TOTAL_BYTES = 20 * 1024 * 1024;

/** Tamanho máximo de um lote de envio de arquivos de projeto, em bytes. */
export const PROJECT_UPLOAD_BATCH_MAX_BYTES = 3 * 1024 * 1024;

/** Número máximo de caminhos de arquivo que a escolha de arquivos relevantes pode devolver. */
export const PROJECT_MAX_RELEVANT_FILES = 12;

/** Tamanho máximo (em caracteres) do mapa do repositório de um projeto. */
export const PROJECT_REPO_MAP_MAX_CHARS = 12_000;

/** Quantos arquivos/documentos resumir por chamada do `CLAUDE_FAST_MODEL` (lotes retomáveis). */
export const PROJECT_SUMMARIZE_BATCH_SIZE = 10;

/**
 * Caracteres novos de transcrição (desde a última opinião) antes de disparar
 * uma opinião automática do copiloto — aproxima "~2 minutos de fala nova"
 * (fala em português, ritmo de conversa, gira em torno de 700-900
 * caracteres por minuto). Ajustável sem mexer na lógica.
 */
export const AUTO_OPINION_MIN_NEW_CHARS = 1600;

/**
 * Quanto da transcrição recente (em segundos de áudio) entra no pedido do
 * copiloto, além do resumo acumulado — controla custo numa reunião longa,
 * sem perder o que acabou de ser dito.
 */
export const COPILOT_RECENT_WINDOW_SECONDS = 300;

/** Quantas vezes tentar reenviar um trecho sozinho antes de esperar o toque em "Reenviar agora". */
export const CHUNK_MAX_AUTO_RETRIES = 3;

/** Tamanho máximo (em caracteres) dos arquivos/documentos de projeto selecionados como relevantes, somados, por chamada ao Claude. */
export const PROJECT_CONTEXT_MAX_CHARS = 20_000;
