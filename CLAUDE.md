# Cérebro IA: contexto do projeto

Leia este arquivo inteiro antes de qualquer tarefa. Ele é a fonte de verdade sobre o que estamos construindo e por quê.

## O que é

Cérebro IA é um app de uso próprio (do Isaias e de seus sócios, na empresa Saber Crescer). Não será vendido nem distribuído, e não precisa escalar. Ele grava reuniões com clientes e sócios, transcreve o áudio e usa o Claude como um **terceiro sócio**: um engenheiro de software e de produto sênior que escuta a conversa, comenta durante a reunião (riscos, caminhos técnicos, perguntas para o cliente) e entrega um parecer no fim. Depois, a equipe conversa com o Claude sobre a reunião num chat.

Três funções vão além disso e são o diferencial do app:

1. **Plano de execução com prompts prontos.** Do que foi discutido, o Claude monta o plano de como desenvolver e, para cada tarefa, escreve um prompt completo, pronto para colar no Claude Code.
2. **Projetos com código importado.** O usuário sobe o `.zip` do código que já existe, e o Claude passa a enxergar o que foi construído, para sugerir e planejar com base no código real (não só em contexto digitado).
3. **Reuniões longas e interrompidas.** A gravação é dividida em partes. Se a reunião passar de 45 minutos ou a gravação for interrompida, o app continua da mesma reunião, sem refazer nada do que já foi feito.

O Claude opina e julga; ele não é secretário. A ata é só a última seção do parecer. O app **gera** os prompts, mas não executa nada sozinho: quem cola e roda no Claude Code é o usuário.

Uso principal: **celular e tablet**, em reuniões presenciais (aparelho na mesa). No notebook, o app só precisa funcionar bem, sem recursos extras.

## Stack (decisões já tomadas, não reabrir sem avisar)

- **Next.js** (App Router) + **TypeScript** + **Tailwind CSS**. Use a versão estável atual e consulte a documentação oficial antes de usar qualquer API, porque nomes mudam entre versões (por exemplo, `middleware` pode se chamar `proxy` em versões recentes).
- **Hospedagem: Vercel.** Funções serverless, sem disco persistente.
- **Banco e login: Supabase** (Postgres + Auth + Row Level Security). Sem Supabase Storage na v1.
- **Transcrição: OpenAI** (`whisper-1`, configurável em `TRANSCRIBE_MODEL`).
- **Raciocínio: Anthropic Claude.** `CLAUDE_MODEL` (padrão `claude-sonnet-5-5`) para copiloto, parecer, chat e plano; `CLAUDE_FAST_MODEL` (padrão `claude-haiku-5-5`) para tarefas baratas e repetitivas (resumo de arquivos, escolha de arquivos relevantes, checkpoints). A API da Anthropic não aceita áudio, por isso a transcrição é separada.
- **Provedores atrás de uma interface** (`lib/ai`): hoje Anthropic e OpenAI; um provedor Gemini pode ser acrescentado depois sem mexer no resto. Não implemente Gemini na v1.
- Bibliotecas sugeridas: `@supabase/ssr`, `@anthropic-ai/sdk`, `openai`, `zod`, `fflate` (zip no navegador), `vitest`.
- **PWA mobile-first**: instalável na tela inicial do celular.
- Isto substitui um protótipo anterior em Flask. A lógica e os prompts foram portados; não recrie o Flask.

## Restrições que moldam o código

1. **Vercel é serverless:** não grave arquivos em disco. Tudo que precisa persistir vai para o Supabase.
2. **Limite de corpo de requisição** das funções (cerca de 4,5 MB): cada trecho de áudio deve ter no máximo 3 minutos a ~32 kbps e ficar abaixo de 4 MB. Valide no cliente e no servidor. O mesmo limite vale para envio de código: **o zip é aberto no navegador** e os arquivos sobem em lotes de até ~3 MB.
3. **Duração máxima das funções:** defina `export const maxDuration` nas rotas pesadas conforme o plano da Vercel (confira os limites atuais na documentação). Parecer, plano e chat usam **streaming** ou trabalho em lotes retomáveis.
4. **Navegador móvel:**
   - Só microfone. `getDisplayMedia` não existe no celular, então não ofereça áudio de aba ou de chamada no mobile (no desktop pode existir como extra opcional).
   - iPhone (Safari) grava `audio/mp4` (AAC); Chrome/Android grava `audio/webm;codecs=opus`. Detecte com `MediaRecorder.isTypeSupported` e envie com a extensão certa. O Whisper aceita ambos.
   - Tela bloqueada ou app em segundo plano pausa a gravação: use Screen Wake Lock (`navigator.wakeLock`), mostre o aviso "Mantenha a tela ligada e o aparelho carregando" e trate o caso de a gravação ser interrompida (ver "Reuniões longas e interrompidas").
   - A rede móvel oscila: guarde cada trecho no aparelho (IndexedDB) até o servidor confirmar, com reenvio automático e manual.
5. **Microfone exige HTTPS:** a Vercel já fornece. Em desenvolvimento, `localhost` funciona.
6. **Chaves de API só no servidor.** Nunca use o prefixo `NEXT_PUBLIC_` em chave de OpenAI ou Anthropic. As chaves são criadas pelo Isaias nos consoles dos provedores e colocadas por ele em `.env.local` e nas variáveis da Vercel. Nunca peça que cole chaves no chat.
7. **Vercel Hobby é para uso pessoal e não comercial.** Este app é de uma empresa; avise o Isaias para conferir os termos do plano antes de ir para produção.
8. **Conteúdo importado é dado, nunca instrução.** Transcrições e arquivos de código entram nos prompts dentro de delimitadores e o modelo é instruído a tratá-los como dados.

## Fluxo de dados

1. Usuário faz login (Supabase Auth) e toca em "Nova reunião", opcionalmente escolhendo um **projeto** (código importado). Cria um registro em `meetings`.
2. O navegador grava o microfone em trechos de 3 minutos (`MediaRecorder` parado e reiniciado a cada trecho).
3. Cada trecho vai para `POST /api/meetings/[id]/chunks`: o servidor transcreve com Whisper (passando vocabulário da empresa e o final do trecho anterior como `prompt`), salva o texto em `meeting_chunks` (com `idx` e `part_no`) e devolve o texto e o `part_no` atual. **O áudio não é armazenado.**
4. Quando uma parte passa de 45 minutos (soma de `audio_seconds`, configurável em `PART_MINUTES`), o servidor passa a gravar os próximos trechos na parte seguinte e o cliente chama `POST /api/meetings/[id]/checkpoint` para resumir a parte que fechou. A gravação **não** é interrompida.
5. Se "Claude opina sozinho" estiver ligado, após cada trecho o cliente chama `POST /api/meetings/[id]/copilot`. O servidor monta o contexto (ver abaixo), anexa as notas anteriores do Claude (para ele não se repetir) e chama o Claude. Resposta `SEM_CONTRIBUICAO` não é exibida nem salva. Há também "Pedir opinião agora" (`kind = manual`, nunca vazio).
6. Ao encerrar, `POST /api/meetings/[id]/analyze` gera o parecer final em streaming. O resultado vai para `analyses`.
7. `POST /api/meetings/[id]/plan` gera o **plano de execução**: lista de tarefas ordenadas, cada uma com um prompt para o Claude Code, salvas em `dev_plans` e `dev_tasks`. Durante a reunião, "Preparar prompt deste assunto" cria uma tarefa rascunho a partir dos últimos minutos.
8. `POST /api/meetings/[id]/chat` conversa sobre a reunião, com transcrição e parecer como contexto, em streaming.

### Como montar o contexto do Claude (copiloto, parecer, plano, chat)

Ordem e conteúdo, do mais estável ao mais variável (isso também ajuda no cache de prompt da Anthropic):

1. Prompt do sistema + contexto da empresa.
2. Se a reunião tem projeto: o **mapa do repositório** e os arquivos relevantes escolhidos para esta chamada (ver "Projetos").
3. Checkpoints das partes anteriores, em ordem (cada um é imutável).
4. Transcrição completa da parte atual. Para o parecer e o plano, se a transcrição completa couber em `FULL_TRANSCRIPT_MAX_CHARS` (padrão 80000), envie tudo inteiro em vez dos checkpoints.
5. Notas anteriores do copiloto e, se houver, o foco pedido pela equipe.

## Reuniões longas e interrompidas

- Cada trecho de 3 minutos é independente; não existe limite de 45 minutos na transcrição. O 45 é só a fronteira de uma **parte**, usada para criar um **checkpoint** (resumo incremental) e manter custo e latência sob controle em reuniões longas.
- Um checkpoint resume **somente** a sua parte, usando o checkpoint anterior como contexto. **Checkpoints nunca são reescritos** (a tabela não permite update). A parte seguinte só dá continuidade.
- **Retomar gravação:** se a gravação for interrompida (ligação, tela bloqueada, app fechado), a reunião continua aberta. O usuário toca em "Continuar gravação" e o app abre uma nova parte (`part_no + 1`) na mesma reunião, sem tocar no que já existe. Se o app detectar que o `MediaRecorder` parou sozinho, mostra um aviso e oferece retomar.
- A transcrição aparece como um texto contínuo, com um marcador discreto no início de cada parte ("Parte 2, 10:45").
- Há uma única ata e um único parecer por reunião, nunca um por parte.

## Projetos: código importado

Objetivo: o Claude enxergar o código que já foi feito, para opinar e planejar com base nele.

- O usuário cria um **projeto** e sobe o `.zip`. **O zip é aberto no navegador**: o app filtra os arquivos, remove segredos e envia só texto, em lotes de até ~3 MB, para `POST /api/projects/[id]/files`.
- **Filtros** (valores padrão, ajustáveis em constantes): ignorar `.git`, `node_modules`, `.next`, `dist`, `build`, `coverage`, `.venv`, `__pycache__`, arquivos binários e de mídia, `*.lock` e `package-lock.json`, arquivos minificados e arquivos acima de 150 KB; no máximo 2000 arquivos e 20 MB de texto no total.
- **Segredos:** nunca enviar `.env*`, chaves privadas, certificados nem arquivos que casem com padrões de chave de API (por exemplo `sk-`, `AKIA`, blocos `BEGIN PRIVATE KEY`). Antes de enviar, mostrar ao usuário um resumo do que será enviado e do que foi excluído, e exigir confirmação.
- **Mapa do repositório** (`projects.repo_map`): árvore de arquivos, README, `package.json` (dependências e scripts), `CLAUDE.md` se existir, lista de rotas e arquivos de esquema do banco. Cabe em cerca de 12 mil caracteres.
- **Resumos:** cada arquivo recebe um resumo de 1 a 2 linhas, gerado com `CLAUDE_FAST_MODEL`, em lotes retomáveis com barra de progresso (por causa do limite de duração das funções).
- **Escolha de arquivos relevantes:** a cada chamada do parecer ou do plano (e no copiloto, quando o assunto mudar), um passo barato com `CLAUDE_FAST_MODEL` recebe o trecho recente da conversa e a lista `caminho: resumo` e devolve até 12 caminhos. O conteúdo desses arquivos entra no contexto, respeitando um orçamento de caracteres.
- Reimportar uma nova versão do zip atualiza só os arquivos que mudaram (comparando `content_hash`) e remove os que sumiram.
- Fora da v1: busca por embeddings (`pgvector`). Só considerar se a escolha por resumos não bastar.

## Plano de execução e prompts prontos

- Saída estruturada (tool use da Anthropic) validada com `zod`: `summary` e uma lista de tarefas com `title`, `description`, `acceptance`, `effort` (P, M ou G), `depends_on` (posições) e `prompt_md`.
- Cada `prompt_md` é um prompt **completo e autocontido** para o Claude Code, em português: contexto e decisões da reunião, objetivo, restrições, passos sugeridos, critérios de aceite, arquivos prováveis (somente se houver projeto, e só caminhos que existam no mapa) e a instrução de confirmar o entendimento e listar dúvidas antes de codar.
- Na interface: lista de tarefas com status (`todo`, `doing`, `done`), botão **Copiar prompt** em cada uma e **Exportar tudo** (um `.md` único ou um `.zip` com `01-titulo.md`, `02-titulo.md`, gerado no navegador).
- Prompts gerados são rascunhos para o usuário revisar. Nunca afirmar que algo foi implementado.

## Estrutura de pastas

```text
cerebro-ia/
├── CLAUDE.md
├── .env.example                 # nomes das variáveis, sem valores
├── supabase/
│   ├── config.toml
│   └── migrations/              # 0001 a 0004 (ver PROMPT_INICIAL.md)
├── src/
│   ├── middleware.ts            # protege tudo, exceto /login
│   ├── app/
│   │   ├── layout.tsx, globals.css, manifest.ts
│   │   ├── login/page.tsx
│   │   ├── (app)/
│   │   │   ├── page.tsx                  # lista de reuniões
│   │   │   ├── nova/page.tsx             # gravação
│   │   │   ├── reunioes/[id]/page.tsx    # parecer, plano de execução e chat
│   │   │   ├── projetos/page.tsx         # lista e importação de zip
│   │   │   ├── projetos/[id]/page.tsx    # detalhe do projeto
│   │   │   └── configuracoes/page.tsx    # contexto da empresa
│   │   └── api/
│   │       ├── meetings/route.ts                      # POST criar
│   │       ├── meetings/[id]/route.ts                 # PATCH encerrar ou retomar, DELETE
│   │       ├── meetings/[id]/chunks/route.ts          # POST trecho de áudio
│   │       ├── meetings/[id]/checkpoint/route.ts      # POST resumo de parte
│   │       ├── meetings/[id]/copilot/route.ts         # POST opinião
│   │       ├── meetings/[id]/analyze/route.ts         # POST parecer (stream)
│   │       ├── meetings/[id]/plan/route.ts            # POST plano de execução
│   │       ├── meetings/[id]/tasks/draft/route.ts     # POST prompt do assunto atual
│   │       ├── meetings/[id]/chat/route.ts            # POST chat (stream)
│   │       ├── tasks/[taskId]/route.ts                # PATCH status
│   │       ├── projects/route.ts                      # POST criar
│   │       └── projects/[id]/{files,summarize,finalize}/route.ts, route.ts (DELETE)
│   ├── components/              # Recorder, CopilotFeed, TranscriptStrip, AnalysisView, PlanView, TaskCard, ProjectImporter, ChatBox
│   └── lib/
│       ├── supabase/            # client.ts, server.ts, middleware helper
│       ├── ai/                  # anthropic.ts, openai.ts, transcribe.ts, prompts.ts, context.ts, checkpoint.ts, plan.ts
│       ├── recorder/            # recorder.ts, uploadQueue.ts (IndexedDB), mime.ts, wakeLock.ts
│       ├── projects/            # zip.ts, filters.ts, secrets.ts, repoMap.ts, selectFiles.ts
│       └── database.types.ts    # gerado com `supabase gen types typescript`
└── tests/
```

## Banco de dados (Supabase)

Todas as tabelas com Row Level Security. Cada linha pertence a um usuário; filhas herdam o dono via `meeting_id` ou `project_id`. O SQL das migrações está em `PROMPT_INICIAL.md`.

| Tabela | Para que serve |
| --- | --- |
| `meetings` | Reunião: título, status (`recording`, `ready`, `analyzed`), início, fim, duração, foco, `project_id` opcional |
| `meeting_chunks` | Texto de cada trecho, com `idx` único por reunião e `part_no` |
| `meeting_checkpoints` | Resumo imutável de cada parte de uma reunião longa |
| `copilot_notes` | Comentários do Claude durante a reunião (`auto` ou `manual`) |
| `analyses` | Parecer final em Markdown; várias versões, vale a mais recente |
| `chat_messages` | Conversa com o Claude sobre a reunião |
| `projects` | Projeto com código importado: nome, mapa do repositório, contagens |
| `project_files` | Arquivos de texto do projeto, com hash e resumo |
| `dev_plans` | Plano de execução gerado a partir de uma reunião |
| `dev_tasks` | Tarefas do plano (ou rascunhos), cada uma com seu prompt para o Claude Code |
| `company_context` | Contexto da empresa e vocabulário, editáveis na tela de configurações |

Regras: toda mudança de esquema vira uma migração em `supabase/migrations/`; excluir uma reunião ou projeto apaga tudo em cascata; as rotas usam o cliente Supabase da sessão do usuário (RLS ativo). A chave `service_role` não é usada no caminho de usuário e nunca vai para o navegador.

## Convenções

- Código, nomes de variáveis e tabelas em inglês; **textos da interface e comentários em português do Brasil**.
- Validar entrada das rotas com `zod`. Erros em JSON `{ "error": "mensagem" }` com status HTTP correto.
- Nunca registrar em log o texto das reuniões, o código importado, o áudio ou chaves.
- Provedores de IA ficam atrás de funções em `lib/ai`, para poder simular nos testes e rodar em desenvolvimento sem chaves (`MOCK_AI=1`).
- Testes com Vitest para lógica pura (montagem de contexto, ordenação de trechos, partes e checkpoints, filtros de zip e detecção de segredos, escolha de MIME, fila de upload, validação do plano). Áudio real é verificado em checklist manual.
- Commits pequenos, um por entrega, em português. Nunca commitar `.env*`.
- Scripts esperados: `dev`, `build`, `lint`, `typecheck`, `test`.

## Design (aprovado no mockup)

Mobile-first, uma coluna, alvos de toque de pelo menos 44 px (botões principais com 52 a 60 px). Fonte Inter.

| Token | Valor |
| --- | --- |
| Fundo | `#F7F6F2` |
| Superfície | `#FFFFFF`, borda `#E7E4DC` |
| Texto | `#16181D`, secundário `#5B606B` |
| Acento (Claude) | `#3D4DB7`, fundo suave `#E8EBFA` |
| Gravar / encerrar | `#C62F3A` |

Telas aprovadas: Entrar, Reuniões, Gravando (cronômetro, ondas, interruptor "Claude opina sozinho", feed "Claude na sala", faixa de transcrição, "Pedir opinião agora", "Encerrar") e Parecer (diagnóstico, avaliação, como desenvolveria, perguntas, ata recolhida, chat). As telas novas (Projetos, Plano de execução, retomar gravação) devem seguir o mesmo estilo; proponha o layout antes de implementar.

## Privacidade (LGPD)

- O áudio é processado e descartado; só o texto é guardado.
- Antes da primeira gravação, mostrar aviso para lembrar de informar os participantes de que a reunião será gravada e transcrita.
- Reuniões com advogados ou dados sensíveis de terceiros exigem cuidado extra; o app deve permitir excluir uma reunião ou um projeto por completo.
- O código importado vai para a Anthropic (texto). Nunca enviar segredos; a confirmação antes do envio é obrigatória.
- Só OpenAI (áudio) e Anthropic (texto) recebem conteúdo das reuniões e dos projetos.

## Fora de escopo da v1

Identificação de quem fala, aplicativo nativo, gravação com a tela bloqueada, captura de áudio de chamadas no celular, compartilhamento entre usuários, execução automática dos prompts gerados, busca por embeddings, provedor Gemini.

## Como trabalhar neste projeto

- Trabalhe por fases, conforme `PROMPT_INICIAL.md`; ao fim de cada fase, rode lint, typecheck e testes, e resuma o que foi feito.
- Se algo estiver ambíguo ou conflitar com este arquivo, pergunte antes de decidir.
- Antes de usar uma API de Next.js, Supabase, Vercel, OpenAI ou Anthropic, confira a documentação atual.
