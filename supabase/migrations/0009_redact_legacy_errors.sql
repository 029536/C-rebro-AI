-- Não é mudança de esquema: limpa dado já gravado antes do fix de segurança
-- que impede erro bruto de provedor de IA de ir para o banco (um erro de
-- rede chegou a ecoar "Headers.append: Bearer sk-ant-..." inteiro em
-- meeting_minutes.error). Troca pelo texto genérico que a tela já mostra
-- hoje para esse caso. Seguro rodar mais de uma vez.

update public.meeting_minutes
set error = 'Falha ao gerar a ata. Tente novamente.'
where error is not null;

-- meeting_chunks.error nunca chegou a ser escrito pelo código atual, mas
-- limpa por precaução.
update public.meeting_chunks
set error = 'Falha ao transcrever o trecho. Tente novamente.'
where error is not null;
