# Pedidos do Site (captação de leads)

Fluxo comercial de captação de pedidos vindos da página pública: o visitante
deixa seus dados e a oficina recebe o pedido no sistema para retornar, validar e
converter em cliente, veículo, agendamento, OS ou orçamento — **sem exigir login
do cliente**. Substitui o antigo foco em "Entrar"/agendamento rígido.

- **App backend:** `apps.leads`
- **API pública:** `POST /api/public/leads/`, `GET /api/public/lead-config/` (AllowAny)
- **API interna:** `/api/leads/...`, `/api/lead-settings/`
- **Rotas frontend:** `/leads` (inbox), `/leads/:id` (detalhe), `/settings/leads` (config)
- **RBAC:** módulo `leads` (`view`, `attend`, `convert`, `config`)

## Página pública

O CTA principal deixa de ser "Entrar" e passa a ser comercial ("Pedir marcação de
horário", "Pedir orçamento ou diagnóstico", "Solicitar atendimento"), abrindo um
**formulário público** simples. O acesso administrativo fica discreto no rodapé
("Área da oficina" → `/login`).

O formulário (mobile-first) coleta: nome, telefone/WhatsApp, e-mail (opcional/
obrigatório conforme config), placa/marca/modelo/ano do veículo, tipo de
solicitação, melhor período para contato, mensagem e consentimento. Protegido por
**honeypot invisível**, **rate limit por IP** (`10/hora`) e validações; o retorno
público **nunca** expõe dados internos nem informa se a placa já existe.

## Recebimento e notificação

Cada envio cria um `SiteLead` com status **Novo** e registra um evento na linha do
tempo. A oficina é avisada por **badge/contador no menu** ("Pedidos"), e
opcionalmente por **e-mail interno** (config `notify_email`). Uma **confirmação
automática** ao cliente pode ser habilitada (`auto_reply_enabled`).

## Inbox e detalhe

`/leads` é um inbox com **filtros** (status, tipo, busca) e **cards** com nome,
telefone, veículo, tipo, tempo desde o envio, status e **indicadores**: cliente
existente/novo, veículo existente/divergente e OS aberta.

A tela de detalhe (`/leads/:id`) mostra os dados informados, a **análise
automática** (identificação de cliente e veículo, com nível de confiança e
verificação do vínculo), **alertas de divergência**, o histórico e as ações:

- **Contato:** Ligar (`tel:`), WhatsApp (`wa.me`), E-mail (`mailto:`), Marcar como
  contatado, registrar observação, alterar status.
- **Vínculo/criação:** vincular ao cliente/veículo sugerido ou criar novo a partir
  dos dados do pedido (com observação de origem).
- **Conversão:** **Gerar OS** (herda cliente, veículo, relato e origem) e **Gerar
  orçamento** (via OS). Cada conversão respeita permissões e regras.

## Identificação e verificação (matching)

Ao receber o pedido o sistema tenta identificar automaticamente:

- **Cliente:** por telefone/WhatsApp, documento (alta confiança), e-mail/nome
  (possível). Resultado: encontrado / possível / novo / conflito.
- **Veículo:** por placa, indicando o **cliente dono atual**.
- **Verificação do vínculo:** confirmado / provável / **divergente** (veículo em
  outro cliente) / veículo não encontrado / cliente não encontrado / inconclusivo.

Divergências são **avisadas com clareza**, mas a decisão é do usuário autorizado.

## Regras de conversão

Antes de gerar OS/orçamento, o sistema valida:

- Cliente e veículo definidos.
- **Divergência crítica** (veículo pertence a outro cliente) → **bloqueia** a
  conversão quando `block_conversion_when_vehicle_other_customer` está ativo
  (código de erro `vehicle_divergent`).
- **OS aberta** para o veículo → **alerta** (código `open_os`) e exige confirmação
  explícita antes de criar uma nova OS.

## Status do pedido

Novo · Em análise · Cliente contatado · Aguardando retorno · Convertido em
cliente/agendamento/OS/orçamento · Duplicado · Sem sucesso · Cancelado. Cada
mudança registra data e responsável na linha do tempo.

## Permissões (módulo `leads`)

| Permissão | Libera | Crítica? | Perfis padrão |
|---|---|---|---|
| `leads.view` | Ver o inbox e os pedidos | Não | Administrador, Atendente |
| `leads.attend` | Status, notas, contato, responsável | Não | Administrador, Atendente |
| `leads.convert` | Criar/vincular cliente e veículo, gerar OS/orçamento | Não | Administrador, Atendente |
| `leads.config` | Configurar formulário e notificações | Sim | Superuser (ou concessão) |

## Configurações (`/settings/leads`)

Ativar/desativar o formulário; e-mail/placa obrigatórios; permitir pedido sem
veículo; exigir consentimento; SLA de resposta; confirmação automática;
notificação por e-mail; permitir criar OS/agendamento; exigir revisão em
divergência; bloquear conversão quando o veículo pertence a outro cliente.

## Auditoria e segurança

Ações relevantes (criação, contato, status, vínculos, conversões, config) são
registradas em `LeadEvent` (linha do tempo do pedido) e em `AuditLog` (usuário,
data, ação, entidade). O formulário público tem honeypot, rate limit e
sanitização; dados internos nunca são expostos ao visitante.

Volte para o [índice da documentação](README.md).
