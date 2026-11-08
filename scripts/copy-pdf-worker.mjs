// Copia o worker do pdf.js para public/, onde o Next.js serve arquivos estáticos
// direto. Roda em todo `npm install` (inclusive no build da Vercel) para ficar
// sempre na versão do pdfjs-dist instalada. Gerado, não commitado.
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const src = join(__dirname, "..", "node_modules", "pdfjs-dist", "build", "pdf.worker.min.mjs");
const destDir = join(__dirname, "..", "public");
const dest = join(destDir, "pdf.worker.min.mjs");

if (!existsSync(src)) {
  console.warn("[copy-pdf-worker] pdfjs-dist não encontrado, pulando:", src);
  process.exit(0);
}

mkdirSync(destDir, { recursive: true });
copyFileSync(src, dest);
console.log("[copy-pdf-worker] copiado para public/pdf.worker.min.mjs");
