// HTML de exportação da ata (impressão/PDF e DOCX — CLAUDE.md, "Ata da reunião").
// Regra aprendida do sistema anterior: cabeçalho em TABELA (nunca flexbox) e
// logo com `width`/`height` como ATRIBUTO da tag <img>, nunca por CSS — é o que
// faz o Word renderizar certo quando esse mesmo HTML é salvo como .doc.

const LOGO_SIZE_PX = 48;

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Linhas do cabeçalho (nome da empresa, endereço, contatos, rodapé) como `<p>` separados. */
function letterheadLines(text: string): string {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => `<p style="margin:0;font-size:11px;color:#5b606b;">${escapeHtml(line)}</p>`)
    .join("\n");
}

/**
 * Monta o HTML completo e autocontido da ata, para impressão (window.print,
 * vira PDF pelo próprio navegador) ou para exportar como .doc (o Word abre
 * HTML salvo com essa extensão). Tema claro sempre, mesmo em modo escuro do
 * sistema — é um documento para imprimir, não a tela do app.
 */
export function buildMinutesExportHtml(params: {
  titulo: string;
  ataFormal: string;
  letterhead: { text: string; logo: string | null };
}): string {
  const hasHeader = Boolean(params.letterhead.text || params.letterhead.logo);

  const headerTable = hasHeader
    ? `<table role="presentation" style="width:100%;border-bottom:1px solid #e6e2db;margin-bottom:16px;">
  <tr>
    ${
      params.letterhead.logo
        ? `<td style="width:${LOGO_SIZE_PX + 12}px;vertical-align:middle;padding-bottom:12px;"><img src="${params.letterhead.logo}" alt="Logo" width="${LOGO_SIZE_PX}" height="${LOGO_SIZE_PX}" style="display:block;" /></td>`
        : ""
    }
    <td style="vertical-align:middle;padding-bottom:12px;">
      ${letterheadLines(params.letterhead.text)}
    </td>
  </tr>
</table>`
    : "";

  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<title>${escapeHtml(params.titulo)}</title>
<style>
  body { font-family: Georgia, "Times New Roman", serif; color: #16181d; background: #ffffff; margin: 32px; }
  pre { white-space: pre-wrap; font-size: 14px; line-height: 1.6; }
</style>
</head>
<body>
${headerTable}
<pre>${escapeHtml(params.ataFormal)}</pre>
</body>
</html>`;
}
