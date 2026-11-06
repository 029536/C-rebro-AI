// Constantes ajustáveis do produto. Ver CLAUDE.md para o porquê de cada limite.

/** Duração de cada trecho de áudio gravado no navegador, em segundos. */
export const CHUNK_SECONDS = 180;

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
