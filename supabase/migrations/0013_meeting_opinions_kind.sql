-- O copiloto deixa de ser só "opinião livre": "Pedir opinião agora" abre um
-- seletor com Opinar / Fazer perguntas / Responder. `kind` distingue o tipo
-- para o rótulo do cartão; `prompt` guarda a pergunta digitada pelo usuário
-- quando kind = 'resposta' (nulo nos outros dois).
alter table public.meeting_opinions
  add column kind text not null default 'opiniao' check (kind in ('opiniao', 'pergunta', 'resposta'));

alter table public.meeting_opinions
  add column prompt text;
