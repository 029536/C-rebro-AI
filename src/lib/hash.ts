import { createHash } from "node:crypto";

/** SHA-256 em hexadecimal, para `content_hash` (detectar o que mudou ao reimportar). */
export function sha256Hex(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}
