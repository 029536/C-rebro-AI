# Cérebro IA: contexto do projeto

Leia este arquivo inteiro antes de qualquer tarefa. Ele é a fonte de verdade sobre o que estamos construindo e por quê.

## O que é

Cérebro IA é um app de uso próprio (do Isaias e de seus sócios, na empresa Saber Crescer). Não será vendido nem distribuído, e não precisa escalar. Ele grava reuniões com clientes e sócios, transcreve o áudio e usa o Claude como um **terceiro sócio**: um engenheiro de software e de produto sênior que escuta a conversa, comenta durante a reunião (riscos, caminhos técnicos, perguntas para o cliente) e entrega um parecer no fim. Depois, a equipe conversa com o Claude sobre a reunião num chat.

Cinco funções vão além disso e são o diferencial do app:

1. **Plano de execução com prompts prontos.** Do que foi discutido, o Claude monta o plano de como desenvolver e, para cada tarefa, escreve um prompt completo, pronto para colar no Claude Code.
2. **Projetos com código e material de apoio importados.** O usuário sobe o `.zip` do código que já existe e documentos de apoio (`.md`, `.txt`, `.pdf`, `.docx`, `.csv`), e o Claude passa a enxergar o que foi construído e documentado, para sugerir e planejar com base no material real (não só em contexto digitado).
3. **Reuniões longas e interrompidas.** A gravação é dividida em partes. Se a reunião passar de 45 minutos ou a gravação for interrompida, o app continua da mesma reunião, sem refazer nada do que já foi feito.
4. **Memória entre reuniões.** Ao criar uma reunião, dá para escolher reuniões anteriores do mesmo cliente ou projeto; o Claude recebe a ata, o parecer e o andamento das tarefas combinadas nelas, para não repetir o que já foi dito nem o que já foi feito, e cobrar o que ficou pendente.
5. **Ata formal e sessões.** Ao encerrar a gravação, o app gera sozinho uma ata estruturada (documento fiel do que foi dito, pronta para PDF/Word) — separada do parecer, que é a opinião do Claude. Uma conversa pode continuar em outro dia como uma nova sessão ligada à mesma linha do tempo, com um chat contínuo entre elas.

O Claude opina e julga; ele não é secretário. A ata é o registro fiel (gerada automaticamente, sem opinião); o parecer é a opinião do terceiro sócio, em documento separado. O app **gera** os prompts, mas não executa nada sozinho: quem cola e roda no Claude Code é o usuário.

Uso principal: **celular e tablet**, em reuniões presenciais (aparelho na mesa). No notebook, o app só precisa funcionar bem, sem recursos extras.

## Stack (decisões já tomadas, não reabrir sem avisar)

- **Next.js** (App Router) + **TypeScript** + **Tailwind CSS**. Use a versão estável atual e consulte a documentação oficial antes de usar qualquer API, porque nomes mudam entre versões (por exemplo, `middleware` pode se chamar `proxy` em versões recentes).
- **Hospedagem: Vercel.** Funções serverless, sem disco persistente.
- **Banco e login: Supabase** (Postgres + Auth + Row Level Security). Sem Supabase Storage na v1.
- **Transcrição: OpenAI** (`whisper-1`, configurável em `TRANSCRIBE_MODEL`).
- **Raciocínio: Anthropic Claude.** `CLAUDE_MODEL` (padrão `claude-sonnet-5-5`) para copiloto, parecer, chat e plano; `CLAUDE_FAST_MODEL` (padrão `claude-haiku-5-5`) para tarefas baratas e repetitivas (resumo de arquivos, escolha de arquivos relevantes, checkpoints). A API da Anthropic não aceita áudio, por isso a transcrição é separada.
- **Provedores atrás de uma interface** (`lib/ai`): hoje Anthropic e OpenAI; um provedor Gemini pode ser acrescentado depois sem mexer no resto. Não implemente Gemini na v1.
- Bibliotecas sugeridas: `@supabase/ssr`, `@anthropic-ai/sdk`, `openai`, `zod`, `fflate` (zip no navegador), `vitest`, `lucide-react` (ícones). Para extrair texto de documentos no navegador: `pdfjs-dist` (PDF) e `mammoth` (`.docx`); `.md`, `.txt` e `.csv` são lidos direto. Confirme as versões atuais antes de instalar.
- **PWA mobile-first**: instalável na tela inicial do celular.
- Isto substitui um protótipo anterior em Flask. A lógica e os prompts foram portados; não recrie o Flask.

## Restrições que moldam o código

1. **Vercel é serverless:** não grave arquivos em disco. Tudo que precisa persistir vai para o Supabase.
2. **Limite de corpo de requisição** das funções (cerca de 4,5 MB): cada trecho de áudio deve ter no máximo 3 minutos a ~32 kbps e ficar abaixo de 4 MB. Valide no cliente e no servidor. O mesmo limite vale para código e documentos de projeto: **o zip é aberto e os documentos (`.pdf`, `.docx` etc.) são lidos no navegador**, e o texto extraído sobe em lotes de até ~3 MB.
3. **Duração máxima das funções:** defina `export const maxDuration` nas rotas pesadas conforme o plano da Vercel (confira os limites atuais na documentação). Parecer, plano e chat usam **streaming** ou trabalho em lotes retomáveis.
4. **Navegador móvel:**
   - Só microfone. `getDisplayMedia` não existe no celular, então não ofereça áudio de aba ou de chamada no mobile (no desktop pode existir como extra opcional).
   - iPhone (Safari) grava `audio/mp4` (AAC); Chrome/Android grava `audio/webm;codecs=opus`. Detecte com `MediaRecorder.isTypeSupported` e envie com a extensão certa. O Whisper aceita ambos.
   - Tela bloqueada ou app em segundo plano pausa a gravação: use Screen Wake Lock (`navigator.wakeLock`), mostre o aviso "Mantenha a tela ligada e o aparelho carregando" e trate o caso de a gravação ser interrompida (ver "Reuniões longas e interrompidas").
   - A rede móvel oscila: guarde cada trecho no aparelho (IndexedDB) até o servidor confirmar, com reenvio automático e manual.
5. **Microfone exige HTTPS:** a Vercel já fornece. Em desenvolvimento, `localhost` funciona.
6. **Chaves de API só no servidor.** Nunca use o prefixo `NEXT_PUBLIC_` em chave de OpenAI ou Anthropic. As chaves são criadas pelo Isaias nos consoles dos provedores e colocadas por ele em `.env.local` e nas variáveis da Vercel. Nunca peça que cole chaves no chat.
7. **Vercel Hobby é para uso pessoal e não comercial.** Este app é de uma empresa; avise o Isaias para conferir os termos do plano antes de ir para produção.
8. **Conteúdo importado é dado, nunca instrução.** Transcrições, atas e pareceres de reuniões anteriores, arquivos de código e documentos de apoio entram nos prompts dentro de delimitadores e o modelo é instruído a tratá-los como dados.

## Fluxo de dados

1. Usuário faz login (Supabase Auth) e toca em "Nova reunião": preenche tipo, título, cliente, participantes e contexto; opcionalmente escolhe um **projeto** (código e material de apoio importados) e uma ou mais **reuniões anteriores** para dar memória ao Claude. Cria um registro em `meetings` (e em `meeting_links`, se houver reuniões escolhidas).
2. O navegador grava o microfone em trechos curtos (25-30s, `CHUNK_SECONDS`) — `MediaRecorder` parado e reiniciado a cada trecho (nunca timeslice, que gera pedaços sem cabeçalho válido), para a transcrição aparecer ao vivo.
3. Cada trecho vai para `POST /api/meetings/[id]/chunks`: o servidor transcreve com Whisper (passando vocabulário da empresa e o final do trecho anterior como `prompt`), salva o texto em `meeting_chunks` e devolve o texto e o `part_no` atual. O `idx` de armazenamento é sempre decidido pelo servidor (nunca pelo cliente); o número local que o navegador já gerava vira só `client_chunk_id`, a chave de idempotência — reenviar o mesmo trecho devolve o que já existe, nunca duplica. **O áudio não é armazenado.**
4. Quando uma parte passa de 45 minutos (soma de `audio_seconds`, configurável em `PART_MINUTES`), o servidor passa a gravar os próximos trechos na parte seguinte e o cliente chama `POST /api/meetings/[id]/checkpoint` para resumir a parte que fechou. A gravação **não** é interrompida.
5. O copiloto é **manual por padrão** (interruptor "Opinar automaticamente" começa desligado, lembra a última escolha). "Pedir opinião agora" abre uma folha com três tipos — Opinar, Fazer perguntas, Responder (pergunta digitada) — e chama `POST /api/meetings/[id]/copilot` com `kind` e, no caso de "resposta", a pergunta. Com o interruptor ligado, o mesmo pedido (`kind: "opiniao"`) dispara sozinho a cada ~2 minutos de fala nova. O servidor manda ao Claude o resumo da parte mais recente fechada (se houver) + só os últimos ~5 minutos de transcrição (não a reunião inteira, por custo — `COPILOT_RECENT_WINDOW_SECONDS`) e a última opinião (para não repetir); o prompt de sistema é estável entre pedidos da mesma reunião e usa `cache_control: ephemeral`. Resposta `SEM_CONTRIBUICAO` (só no tipo "opiniao") não é exibida nem salva. Grava em `meeting_opinions`.
6. Ao encerrar (`action: "finish"`), o cliente espera a fila de trechos esvaziar (até 30s, reenviando) antes de confirmar, e o servidor dispara sozinho `POST /api/meetings/[id]/minutes`, que gera a **ata** estruturada (ver "Ata da reunião") e grava em `meeting_minutes`. O cartão da reunião mostra "Gerando ata..." até terminar.
7. `POST /api/meetings/[id]/reviews` gera o **parecer** final em saída estruturada (a opinião do Claude sobre a reunião inteira, separada da ata e das opiniões do copiloto). O resultado vai para `meeting_reviews`.
8. `POST /api/meetings/[id]/plan` gera o **plano de execução**: lista de tarefas ordenadas, cada uma com um prompt para o Claude Code, salvas em `dev_plans` e `dev_tasks`. Durante a reunião, "Preparar prompt deste assunto" cria uma tarefa rascunho a partir dos últimos minutos.
9. `POST /api/meetings/[id]/chat` conversa sobre a conversa inteira (todas as sessões ligadas, não só esta reunião — ver "Sessões"), com transcrição, ata e parecer como contexto, em streaming.

### Como montar o contexto do Claude (copiloto, parecer, plano, chat)

Ordem e conteúdo, do mais estável ao mais variável (isso também ajuda no cache de prompt da Anthropic):

1. Prompt do sistema + contexto da empresa.
2. Se a reunião tem projeto: o **mapa do repositório**, os arquivos de código e os documentos relevantes escolhidos para esta chamada (ver "Projetos: código e material de apoio").
3. Se a reunião tem reuniões anteriores ligadas (`meeting_links`): para cada uma, título, data, ata (ou resumo) e parecer, em tags — ver "Memória entre reuniões".
4. **Andamento**: as tarefas do plano das reuniões ligadas, com status e nota de progresso — ver "Plano de execução e prompts prontos".
5. Checkpoints das partes anteriores desta reunião, em ordem (cada um é imutável).
6. Transcrição completa da parte atual. Para o parecer e o plano, se a transcrição completa couber em `FULL_TRANSCRIPT_MAX_CHARS` (padrão 80000), envie tudo inteiro em vez dos checkpoints.
7. Notas anteriores do copiloto e, se houver, o foco pedido pela equipe.

Os pontos 2 a 4 têm orçamento próprio de caracteres (ver cada seção); quando qualquer um estourar, use resumos em vez do conteúdo inteiro.

## Reuniões longas e interrompidas

- Cada trecho de 3 minutos é independente; não existe limite de 45 minutos na transcrição. O 45 é só a fronteira de uma **parte**, usada para criar um **checkpoint** (resumo incremental) e manter custo e latência sob controle em reuniões longas.
- Um checkpoint resume **somente** a sua parte, usando o checkpoint anterior como contexto. **Checkpoints nunca são reescritos** (a tabela não permite update). A parte seguinte só dá continuidade.
- **Retomar gravação:** se a gravação for interrompida (ligação, tela bloqueada, app fechado), a reunião continua aberta. O usuário toca em "Continuar gravação" e o app abre uma nova parte (`part_no + 1`) na mesma reunião, sem tocar no que já existe. Se o app detectar que o `MediaRecorder` parou sozinho, mostra um aviso e oferece retomar.
- A transcrição aparece como um texto contínuo, com um marcador discreto no início de cada parte ("Parte 2, 10:45").
- Há uma única ata e um único parecer "vigentes" por reunião (a versão mais recente), nunca um por parte — mas a ata pode ser regenerada (nova versão) sem regravar.

## Ata da reunião

Objetivo: um registro **fiel** do que foi dito, gerado sozinho ao encerrar a gravação — sem opinião, sem julgamento (isso é o parecer, documento separado).

- Documento estruturado (`meeting_minutes.content`, jsonb, validado com `zod`): `titulo`, `data` (AAAA-MM-DD), `horario` (HH:mm), `tipo`, `cliente_ou_empresa`, `participantes`, `assuntos_discutidos[]`, `decisoes[]`, `responsabilidades[]` (`{parte, itens[]}`, "parte" livre: nossa equipe, cliente etc.), `acoes_futuras[]` (`{acao, responsavel?, prazo?}`), `observacoes`, `resumo_executivo`, `proximos_encontros[]`, e `ata_formal` (texto corrido pronto para impressão, com cabeçalho/corpo/fechamento).
- **Regras de geração** (nunca abrir mão delas):
  1. A data e o horário reais vêm do servidor (`meetings.started_at`, em America/Sao_Paulo) e entram no prompt como fonte única; o modelo só usa outra data se a fala citar uma explicitamente.
  2. Os participantes do formulário são a única fonte confiável de nomes — usar exatamente como digitados. Sem participantes informados, usar o que aparecer na transcrição, sem inventar.
  3. Reunião interna (`meeting_type = 'internal'`): nunca presumir cliente nem inventar responsável.
  4. Transcrição muito curta, sem sentido, ou dominada por outro alfabeto (Whisper "alucinando" em cima de áudio mudo): **não gerar ata** — falhar com mensagem honesta e botão "Tentar de novo", sem inventar conteúdo.
- Estados (`meeting_minutes.status`): `pending` → `generating` → `ready` ou `error`. O cartão da reunião mostra isso (Transcrevendo/Gerando ata/Pronta/Erro).
- Pode regenerar sem regravar (nova linha em `meeting_minutes`, vale a mais recente) e editar manualmente o texto formal (`edited_ata_formal`, sem precisar da IA).
- Exportação é só do navegador: PDF via impressão (HTML limpo, tema claro sempre), DOCX gerado no navegador (cabeçalho em **tabela**, nunca flexbox; imagem com `width`/`height` como atributo, não CSS — regra aprendida do sistema anterior), copiar texto, compartilhar (Web Share API no celular, `mailto:` como alternativa).
- Cabeçalho institucional (`company_context.letterhead`, até 5 linhas de texto, sem logo) é editável em Configurações e entra no topo do documento exportado.

## Memória entre reuniões

Objetivo: o Claude enxergar o que já foi dito e decidido em reuniões anteriores do mesmo cliente ou projeto, para não repetir perguntas nem recomeçar do zero.

- Na tela "Nova reunião", seção **"Partir de reuniões anteriores"**: lista de reuniões já encerradas (`status` `ready` ou `analyzed`), mais recentes primeiro, com destaque para as do mesmo `client_name` (e, quando a reunião tiver projeto, do mesmo projeto). Escolha múltipla, opcional. Cada escolha grava `meeting_links(meeting_id, previous_meeting_id, link_type = 'context')`.
- É só uma ligação: não copia nem duplica dado nenhum.
- No contexto do Claude (ver "Como montar o contexto"), cada reunião ligada entra em tags com título, data, ata e parecer. Se o total passar do orçamento de caracteres, use o resumo mais recente de cada uma em vez do conteúdo inteiro.
- Excluir uma reunião remove as ligações que a envolvem (cascata), mas não afeta o conteúdo da outra ponta.

## Sessões (continuar a mesma conversa)

Objetivo: uma conversa real dura vários encontros; o app trata isso como uma única linha do tempo, não reuniões soltas.

- **Retomar gravação** (já existia): a gravação caiu no meio (ligação, tela bloqueada) — mesma reunião, nova parte. **Continuar em nova sessão** (novo): a conversa segue em outro dia — cria uma **reunião nova**, pré-preenchida com tipo/cliente/participantes/contexto da anterior, ligada a ela por `meeting_links(..., link_type = 'session')`, e vai direto para a gravação (sem passar pelo formulário).
- `link_type = 'session'` forma uma corrente simples (cada sessão aponta para a anterior), diferente de `link_type = 'context'` (memória geral, pode apontar para qualquer reunião). Só as ligações `session` agrupam reuniões num cartão **"N sessões"** na lista.
- O **chat é um só por conversa**: ao montar o histórico, o servidor segue a corrente `session` a partir da reunião atual e junta as mensagens de todas as sessões, em ordem — lê como uma conversa contínua, não importa de qual sessão você está conversando.
- A aba "Sessões" na reunião mostra essa linha do tempo, com link para abrir qualquer uma.

## Projetos: código e material de apoio

Objetivo: o Claude enxergar o código e a documentação que já existem, para opinar e planejar com base neles.

- O usuário cria um **projeto**. Pode subir um `.zip` de código e, separadamente, documentos de apoio (`.md`, `.txt`, `.pdf`, `.docx`, `.csv`). **Tudo é aberto e lido no navegador**: o app filtra, remove segredos e envia só texto, em lotes de até ~3 MB.
- **Código** vai para `POST /api/projects/[id]/files`. **Filtros** (valores padrão, ajustáveis em constantes): ignorar `.git`, `node_modules`, `.next`, `dist`, `build`, `coverage`, `.venv`, `__pycache__`, arquivos binários e de mídia, `*.lock` e `package-lock.json`, arquivos minificados e arquivos acima de 150 KB; no máximo 2000 arquivos e 20 MB de texto no total.
- **Documentos** vão para `POST /api/projects/[id]/documents`, um por vez ou em lote: extrai o texto no navegador (`pdfjs-dist` para `.pdf`, `mammoth` para `.docx`; `.md`/`.txt`/`.csv` são lidos direto) e grava em `project_documents`. Recusar com mensagem clara: PDF protegido por senha, PDF escaneado sem texto (sem OCR na v1) e arquivos acima do limite por arquivo.
- **Confirmação antes de enviar:** para código e para documentos, mostrar um resumo (quantos arquivos entram, quais foram excluídos ou recusados e por quê, tamanho total) e exigir confirmação explícita antes de subir.
- **Segredos:** nunca enviar `.env*`, chaves privadas, certificados nem conteúdo que case com padrões de chave de API (por exemplo `sk-`, `AKIA`, blocos `BEGIN PRIVATE KEY`) — a mesma detecção vale para o texto extraído de documentos, não só para nomes de arquivo de código.
- **Mapa do repositório** (`projects.repo_map`): árvore de arquivos, README, `package.json` (dependências e scripts), `CLAUDE.md` se existir, lista de rotas e arquivos de esquema do banco. Cabe em cerca de 12 mil caracteres.
- **Resumos:** cada arquivo de código e cada documento recebem um resumo de 1 a 2 linhas, gerado com `CLAUDE_FAST_MODEL`, em lotes retomáveis com barra de progresso (por causa do limite de duração das funções).
- **Escolha de material relevante:** a cada chamada do parecer ou do plano (e no copiloto, quando o assunto mudar), um passo barato com `CLAUDE_FAST_MODEL` recebe o trecho recente da conversa e a lista `caminho: resumo` (código e documentos juntos) e devolve até 12 itens. O conteúdo desses arquivos/documentos entra no contexto, respeitando um orçamento de caracteres — código e documentos formam juntos o "contexto do projeto".
- Reimportar (zip ou documentos) atualiza só o que mudou (comparando `content_hash`) e remove o que sumiu.
- **Excluir um projeto** apaga código e documentos em cascata, com confirmação.
- Fora da v1: busca por embeddings (`pgvector`), OCR de PDF escaneado. Só considerar se a escolha por resumos não bastar.

## Plano de execução e prompts prontos

- Saída estruturada (tool use da Anthropic) validada com `zod`: `summary` e uma lista de tarefas com `title`, `description`, `acceptance`, `priority` (alta, media ou baixa), `depends_on` (posições) e `prompt_md`.
- Cada `prompt_md` é um prompt **completo e autocontido** para o Claude Code, em português: contexto e decisões da reunião, objetivo, restrições, passos sugeridos, critérios de aceite, arquivos prováveis (somente se houver projeto, e só caminhos que existam no mapa) e a instrução de confirmar o entendimento e listar dúvidas antes de codar.
- Na interface: lista de tarefas com status (`todo`, `doing`, `done`), uma **nota curta de andamento** por tarefa (por exemplo "entregue em 05/11, falta testar"), botão **Copiar prompt** em cada uma e **Exportar tudo** (um `.md` único ou um `.zip` com `01-titulo.md`, `02-titulo.md`, gerado no navegador).
- **Andamento no contexto:** quando a reunião atual tem reuniões anteriores ligadas, as tarefas dos planos dessas reuniões entram no contexto do Claude (copiloto, parecer, plano, chat) com título, status e nota de andamento, numa seção `<andamento>`. O Claude usa isso para não sugerir de novo o que já está feito e para perguntar sobre o que ainda está pendente.
- Prompts gerados são rascunhos para o usuário revisar. Nunca afirmar que algo foi implementado.

## Estrutura de pastas

```text
cerebro-ia/
├── CLAUDE.md
├── .env.example                 # nomes das variáveis, sem valores
├── supabase/
│   ├── config.toml
│   └── migrations/              # 0001 em diante (ver PROMPT_INICIAL.md para o número de cada uma)
├── src/
│   ├── proxy.ts                 # protege tudo, exceto /login (chamava-se middleware.ts antes do Next 16)
│   ├── app/
│   │   ├── layout.tsx, globals.css, manifest.ts
│   │   ├── login/page.tsx
│   │   ├── (app)/
│   │   │   ├── page.tsx                  # lista de reuniões
│   │   │   ├── nova/page.tsx             # formulário + gravação
│   │   │   ├── reunioes/[id]/page.tsx    # painel: Ata, Parecer, Plano, Chat, Transcrição, Sessões
│   │   │   ├── @modal/(.)reunioes/[id]/page.tsx  # mesma tela, interceptada como painel lateral no desktop
│   │   │   ├── projetos/page.tsx         # lista e importação de zip/documentos
│   │   │   ├── projetos/[id]/page.tsx    # detalhe do projeto (arquivos e documentos)
│   │   │   └── configuracoes/page.tsx    # contexto da empresa, vocabulário, cabeçalho da ata
│   │   └── api/
│   │       ├── meetings/route.ts                      # POST criar (projeto, reuniões anteriores/sessão)
│   │       ├── meetings/[id]/route.ts                 # PATCH encerrar/retomar/arquivar/editar, DELETE
│   │       ├── meetings/[id]/chunks/route.ts          # POST trecho de áudio
│   │       ├── meetings/[id]/checkpoint/route.ts      # POST resumo de parte
│   │       ├── meetings/[id]/minutes/route.ts         # POST gerar/regenerar, PATCH editar a ata
│   │       ├── meetings/[id]/copilot/route.ts         # POST opinião
│   │       ├── meetings/[id]/reviews/route.ts         # POST parecer (saída estruturada)
│   │       ├── meetings/[id]/plan/route.ts            # POST plano de execução
│   │       ├── meetings/[id]/tasks/draft/route.ts     # POST prompt do assunto atual
│   │       ├── meetings/[id]/chat/route.ts            # POST chat (stream, contínuo entre sessões)
│   │       ├── meetings/prepare/route.ts              # POST preencher formulário por IA
│   │       ├── tasks/[taskId]/route.ts                # PATCH status e nota de andamento
│   │       ├── company-context/route.ts               # GET/PATCH contexto, vocabulário, cabeçalho
│   │       ├── projects/route.ts                      # POST criar
│   │       └── projects/[id]/{files,documents,summarize,finalize}/route.ts, route.ts (DELETE)
│   ├── components/              # Recorder, MeetingSetupForm, MinutesView, CopilotFeed, TranscriptStrip, AnalysisView, PlanView, TaskCard, ProjectImporter, ChatBox, BottomNav
│   └── lib/
│       ├── supabase/            # client.ts, server.ts, proxy helper
│       ├── ai/                  # anthropic.ts, openai.ts, transcribe.ts, prompts.ts, context.ts, checkpoint.ts, plan.ts
│       ├── minutes/             # schema.ts (zod da ata), rules.ts (data real, áudio mudo), export.ts (HTML/DOCX)
│       ├── recorder/            # recorder.ts, uploadQueue.ts (IndexedDB), mime.ts, wakeLock.ts
│       ├── projects/            # zip.ts, documents.ts, filters.ts, secrets.ts, repoMap.ts, selectFiles.ts
│       ├── participants.ts      # tipo e validação de participantes
│       └── database.types.ts    # gerado com `supabase gen types typescript`
└── tests/
```

## Banco de dados (Supabase)

Todas as tabelas com Row Level Security. Cada linha pertence a um usuário; filhas herdam o dono via `meeting_id` ou `project_id`. O SQL das migrações está em `PROMPT_INICIAL.md`.

| Tabela | Para que serve |
| --- | --- |
| `meetings` | Reunião: título, status (`recording`, `ready`, `analyzed`), tipo (`client`/`internal`), cliente, participantes (jsonb), contexto, início, fim, duração, foco, arquivamento, `project_id` opcional |
| `meeting_chunks` | Texto de cada trecho; `idx` é atribuído pelo servidor (nunca confia no cliente), único por reunião junto com `part_no`; `client_chunk_id` é a chave de idempotência do reenvio |
| `meeting_checkpoints` | Resumo imutável de cada parte de uma reunião longa |
| `meeting_minutes` | Ata estruturada (jsonb) + ajuste manual opcional; várias versões, vale a mais recente |
| `meeting_links` | Ligação `meeting_id → previous_meeting_id`, com `link_type` (`context`: memória geral; `session`: mesma conversa, outra sessão) |
| `meeting_opinions` | Comentários do copiloto durante a reunião (`kind`: `opiniao`/`pergunta`/`resposta`; `prompt` guarda a pergunta do usuário quando `resposta`) |
| `meeting_reviews` | Parecer estruturado (jsonb: diagnóstico, avaliação, como desenvolveria, perguntas críticas); mesmo padrão status/erro da ata |
| `copilot_notes`, `analyses` | Tabelas do desenho original (Flask), nunca escritas pelo app atual — substituídas por `meeting_opinions`/`meeting_reviews`; ficam no banco sem uso |
| `chat_messages` | Conversa com o Claude; contínua entre sessões (resolvida em tempo de consulta pela corrente `link_type = 'session'`) |
| `projects` | Projeto com código e documentos importados: nome, mapa do repositório, contagens |
| `project_files` | Arquivos de código do projeto, com hash e resumo |
| `project_documents` | Documentos de apoio do projeto (texto extraído de `.pdf`, `.docx` etc.), com hash e resumo |
| `dev_plans` | Plano de execução gerado a partir de uma reunião |
| `dev_tasks` | Tarefas do plano (ou rascunhos), com status, nota curta de andamento e o prompt para o Claude Code; `project_id` (opcional) para a tela do projeto listar o andamento de todas as reuniões |
| `project_memory` | Resumo vivo do projeto (uma linha por projeto, sempre sobrescrita): decisões, estado real e pendências, atualizado ao encerrar reuniões ligadas a ele e ao gerar parecer/plano |
| `company_context` | Contexto da empresa, vocabulário e cabeçalho da ata (texto, até 5 linhas), editáveis em Configurações |

Regras: toda mudança de esquema vira uma migração em `supabase/migrations/`; excluir uma reunião ou projeto apaga tudo em cascata; as rotas usam o cliente Supabase da sessão do usuário (RLS ativo). A chave `service_role` não é usada no caminho de usuário e nunca vai para o navegador.

## Convenções

- Código, nomes de variáveis e tabelas em inglês; **textos da interface e comentários em português do Brasil**.
- Validar entrada das rotas com `zod`. Erros em JSON `{ "error": "mensagem" }` com status HTTP correto.
- Nunca registrar em log o texto das reuniões, o código e os documentos importados, o áudio ou chaves.
- Provedores de IA ficam atrás de funções em `lib/ai`, para poder simular nos testes e rodar em desenvolvimento sem chaves (`MOCK_AI=1`).
- Testes com Vitest para lógica pura (montagem de contexto, ordenação de trechos, partes e checkpoints, filtros de zip e detecção de segredos, extração de texto de documentos, orçamento de memória entre reuniões, esquema da ata, regra de data real, detecção de áudio mudo/sem sentido, HTML de exportação, escolha de MIME, fila de upload, validação do plano). Áudio real é verificado em checklist manual.
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

Telas aprovadas: Entrar, Gravando (cronômetro, ondas, interruptor "Claude opina sozinho", feed "Claude na sala", faixa de transcrição, "Pedir opinião agora", "Encerrar").

**Redesenho no modelo "Lumi Ata Inteligente"** (aprovado em 2026-11-08): visual mais profissional — `lucide-react` para ícones, cartões com sombra suave, hierarquia tipográfica mais clara, estados vazios com orientação, skeletons de carregamento, mensagens de erro claras, sem emojis na interface, nav inferior no celular (Reuniões, Nova, Projetos, Configurações).
- **Reuniões**: cartões com selo de status, prévia do resumo executivo, Abrir/Arquivar/Excluir; "Em andamento" no topo com Retomar; sessões da mesma conversa agrupadas num cartão "N sessões"; filtro Recentes/Arquivadas.
- **Reunião**: painel com abas Ata | Parecer | Plano | Chat | Transcrição | Sessões. No celular, tela cheia com botão de fechar; no desktop, painel lateral sobre a lista (rota interceptada, `@modal/(.)reunioes/[id]`). A ata é exibida em "folha branca" com tipografia serifada, como documento formal, com barra de ações (PDF, DOCX, copiar, compartilhar, editar, arquivar).
- **Configurações** (nova; adiantada da antiga Fase 8): contexto da empresa, vocabulário, cabeçalho da ata.
- **Projetos** e **Plano de execução**: seguem o mesmo estilo das demais telas novas.

## Privacidade (LGPD)

- O áudio é processado e descartado; só o texto é guardado.
- Antes da primeira gravação, mostrar aviso para lembrar de informar os participantes de que a reunião será gravada e transcrita.
- Reuniões com advogados ou dados sensíveis de terceiros exigem cuidado extra; o app deve permitir excluir uma reunião ou um projeto por completo (reunião: também apaga as ligações em `meeting_links`; projeto: também apaga arquivos e documentos).
- O código e os documentos importados, e o conteúdo de reuniões anteriores usado como memória, vão para a Anthropic (texto). Nunca enviar segredos; a confirmação antes do envio é obrigatória para código e documentos.
- Avisar na tela de importação que o material (código e documentos) sobe para a Anthropic; a OpenAI só recebe áudio de reuniões, nunca código nem documentos.
- Só OpenAI (áudio) e Anthropic (texto: transcrições, código, documentos, memória entre reuniões) recebem conteúdo das reuniões e dos projetos.

## Fora de escopo da v1

Identificação de quem fala, aplicativo nativo, gravação com a tela bloqueada, captura de áudio de chamadas no celular, compartilhamento entre usuários, execução automática dos prompts gerados, busca por embeddings, provedor Gemini, OCR de documentos escaneados sem texto.

## Como trabalhar neste projeto

- Trabalhe por fases, conforme `PROMPT_INICIAL.md`; ao fim de cada fase, rode lint, typecheck e testes, e resuma o que foi feito.
- Se algo estiver ambíguo ou conflitar com este arquivo, pergunte antes de decidir.
- Antes de usar uma API de Next.js, Supabase, Vercel, OpenAI ou Anthropic, confira a documentação atual.
