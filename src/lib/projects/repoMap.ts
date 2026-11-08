import { PROJECT_REPO_MAP_MAX_CHARS } from "@/lib/config";

export type RepoMapFile = { path: string; content: string };

const ROUTE_FILE_PATTERN = /\/(page|route|layout)\.(tsx?|jsx?)$/;
const SCHEMA_FILE_PATTERN = /\.sql$/i;

function basename(path: string): string {
  return path.split("/").pop() ?? path;
}

/**
 * Monta o mapa do repositório (árvore, README, package.json, CLAUDE.md, rotas,
 * arquivos de esquema), cortado em `maxChars`. Função pura — não lê nada do disco.
 */
export function buildRepoMap(files: RepoMapFile[], maxChars: number = PROJECT_REPO_MAP_MAX_CHARS): string {
  const tree = files
    .map((file) => file.path)
    .sort()
    .join("\n");

  const readme = files.find((file) => /^readme\.md$/i.test(basename(file.path)));
  const packageJson = files.find((file) => file.path === "package.json");
  const claudeMd = files.find((file) => basename(file.path) === "CLAUDE.md");
  const routes = files.filter((file) => ROUTE_FILE_PATTERN.test(file.path));
  const schemaFiles = files.filter((file) => SCHEMA_FILE_PATTERN.test(file.path));

  const sections = [
    `## Árvore de arquivos\n${tree}`,
    readme && `## README\n${readme.content}`,
    packageJson && `## package.json\n${packageJson.content}`,
    claudeMd && `## CLAUDE.md\n${claudeMd.content}`,
    routes.length > 0 && `## Rotas\n${routes.map((file) => file.path).join("\n")}`,
    schemaFiles.length > 0 && `## Arquivos de esquema do banco\n${schemaFiles.map((file) => file.path).join("\n")}`,
  ].filter((section): section is string => Boolean(section));

  const map = sections.join("\n\n");
  return map.length > maxChars ? map.slice(0, maxChars) : map;
}
