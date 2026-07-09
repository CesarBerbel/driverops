# CRM Inteligente (Próximas Ações)

Camada ativa de relacionamento: analisa dados do sistema (status de OS/orçamento,
prazos, pedidos do site, sazonalidade) e **sugere** ações — ligar, enviar
WhatsApp, follow-up, campanha, revisão preventiva. **Nada é enviado
automaticamente**: o sistema sugere, o usuário revisa e confirma.

- **App backend:** `apps.crm`
- **Rotas frontend:** `/crm` (Próximas Ações), `/settings/crm`
- **RBAC:** módulo `crm` (`view`, `manage`, `configure`, `use_ai`, `create_campaign`, `send_message`, `assign_task`, `dismiss`)

## Motor de regras + IA

O núcleo é **determinístico** (`apps/crm/rules.py`): identifica oportunidades por
prazo/status e cria sugestões **idempotentes** (dedup por chave). Regras críticas
de prazo **não** dependem de IA. A IA (reutiliza o provider do
[Assistente de IA](ai-assistant.md)) só entra **sob demanda** para gerar o texto
da mensagem — e se estiver indisponível, cai para o template determinístico.

Regras cobertas: follow-up de orçamento (sem resposta / recusado / a vencer), OS
pronta / aguardando aprovação / parada, pós-serviço, revisão preventiva, cliente
inativo, follow-up de pedido do site e campanha sazonal (feriados).

Geração periódica (idempotente), agendável no cron:

```bash
docker compose exec backend python manage.py sync_crm
```

## Próximas Ações (`/crm`)

Lista de sugestões (cards) com filtros (status/prioridade/categoria/busca). Cada
card mostra tipo, prioridade, cliente, veículo, OS/orçamento, motivo e ação
recomendada, com botões: **Mensagem** (revisar/gerar com IA e enviar por
WhatsApp/e-mail/ligação), **Aprovar**, **Tarefa**, **Adiar**, **Concluir**,
**Ignorar** e **Campanha** (para sugestões de campanha).

O texto da mensagem é sempre revisável antes do envio; abrir o WhatsApp/e-mail é
uma ação explícita do usuário e pode registrar a sugestão como "enviada"
(`crm.send_message`).

## Status e prioridade

Status: Nova · Em análise · Agendada · Em andamento · Enviada · Concluída ·
Ignorada · Adiada · Expirada · Cancelada (com histórico de mudança). Prioridade:
Baixa/Média/Alta/Urgente — a lista ordena por prioridade e recência.

## Integrações

- **OS:** a aba de relato mostra as sugestões contextuais da OS (`CrmSuggestionsPanel`).
- **Central de Notificações:** sugestões de alta prioridade viram um aviso interno
  (`crm_suggestion`) para quem tem `crm.view`, com link para a sugestão.
- **Tarefas/Campanhas:** sugestões viram tarefa (`crm.assign_task`) ou campanha em
  rascunho (`crm.create_campaign`) — a campanha exige aprovação para "envio".

## Configuração (`/settings/crm`)

Ativar/desativar o módulo, IA e campanhas sazonais; usar dados de OS/financeiro;
**envio automático desligado por padrão**; limite diário; e as **regras de tempo**
(follow-up de orçamento, OS pronta, preventiva, reativação, antecedência de
feriado, SLA de pedido do site etc.). Configurar exige `crm.configure`.

## Privacidade e segurança

- Prompt crítico é montado no **backend** com campos seguros (nunca observações
  internas; financeiro só se `use_financial_data`).
- **Nenhum envio automático** por padrão; toda mensagem é revisável.
- Logs técnicos de IA em `AIUsageLog` (`field_key="crm"`); auditoria das ações em
  `AuditLog` (sugestão, status, tarefa, campanha, config, uso de IA).

## Fora do escopo desta versão (preparado)

Envio real de campanhas em massa e opt-out/consentimento de comunicações
comerciais — os modelos já registram origem, canal e público para evoluir.

Volte para o [índice da documentação](README.md).
