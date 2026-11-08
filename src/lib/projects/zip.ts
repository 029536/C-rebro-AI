import { unzipSync } from "fflate";
import { PROJECT_FILE_MAX_BYTES, PROJECT_MAX_FILES, PROJECT_MAX_TOTAL_BYTES } from "@/lib/config";
import { filterCodeFile } from "./filters";
import { detectSecret } from "./secrets";

export type AcceptedZipEntry = { path: string; content: string; sizeBytes: number };
export type RejectedZipEntry = { path: string; reason: string };

export type ZipImportSummary = {
  accepted: AcceptedZipEntry[];
  rejected: RejectedZipEntry[];
  totalBytes: number;
};

/**
 * Abre o zip (no navegador, com `fflate`), aplica os filtros de código e a
 * detecção de segredos, e devolve o resumo para a tela de confirmação antes
 * de enviar. Nada sai daqui sem passar pelos dois filtros.
 */
export async function readZipFile(file: File | Blob): Promise<ZipImportSummary> {
  const buffer = new Uint8Array(await file.arrayBuffer());
  const entries = unzipSync(buffer);
  const decoder = new TextDecoder("utf-8", { fatal: true });

  const accepted: AcceptedZipEntry[] = [];
  const rejected: RejectedZipEntry[] = [];
  let totalBytes = 0;

  for (const [path, data] of Object.entries(entries)) {
    if (path.endsWith("/")) continue; // diretório, nada para importar

    if (accepted.length >= PROJECT_MAX_FILES) {
      rejected.push({ path, reason: "limite de arquivos do projeto atingido" });
      continue;
    }

    const sizeBytes = data.byteLength;
    let content: string;
    try {
      content = decoder.decode(data);
    } catch {
      rejected.push({ path, reason: "arquivo binário ou de mídia" });
      continue;
    }

    const filterResult = filterCodeFile({ path, sizeBytes, content, maxFileBytes: PROJECT_FILE_MAX_BYTES });
    if (filterResult.ignore) {
      rejected.push({ path, reason: filterResult.reason ?? "ignorado" });
      continue;
    }

    const secretReason = detectSecret({ path, content });
    if (secretReason) {
      rejected.push({ path, reason: `possível segredo (${secretReason})` });
      continue;
    }

    if (totalBytes + sizeBytes > PROJECT_MAX_TOTAL_BYTES) {
      rejected.push({ path, reason: "limite de tamanho total do projeto atingido" });
      continue;
    }

    accepted.push({ path, content, sizeBytes });
    totalBytes += sizeBytes;
  }

  return { accepted, rejected, totalBytes };
}
