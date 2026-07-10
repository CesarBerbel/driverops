# Máquina de Estados da Ordem de Serviço (OS)

Toda mudança de status da OS passa por uma **máquina de estados formal e
central** (`backend/apps/orders/state_machine.py`). O status **não é um campo
editável comum**: ele é sempre consequência de uma **ação** válida (iniciar
diagnóstico, enviar para aprovação, aprovar, iniciar execução, finalizar,
cancelar, reabrir, ...). Isso impede alterações inconsistentes, evita pular
etapas e garante rastreabilidade.

- **Backend:** `apps.orders.state_machine` (fonte da verdade)
- **Endpoints:** `GET /api/work-orders/{id}/transitions/`, `POST /api/work-orders/{id}/transition/`, `POST /api/work-orders/{id}/move/` (Kanban), `GET /api/work-orders/{id}/status-history/`
- **Frontend:** `OrderStatusActions` (barra "Ações da OS"), `OrderStatusStepper`, `OrderStatusTimeline`

## Princípio

O endpoint comum de edição da OS **não aceita** alterar `status` (o campo é
read-only na criação e na edição; uma OS nova começa sempre em **Aberta**).
Qualquer mudança de etapa exige uma ação de transição, validada no backend.

## Status

| Interno | Rótulo | Terminal |
|---|---|---|
| `open` | Aberta | |
| `diagnosing` | Em diagnóstico | |
| `awaiting_approval` | Aguardando aprovação | |
| `approved` | Aprovada | |
| `awaiting_parts` | Aguardando peças | |
| `in_progress` | Em execução | |
| `testing` | Em teste | |
| `ready` | Pronta para entrega | |
| `finished` | Finalizada | ✔ |
| `canceled` | Cancelada | ✔ |
| `rejected` | Recusada | ✔ |

Status terminais só saem por **reabertura formal** (ação `reopen`, permissão
especial e justificativa).

## Ações e transições

Cada transição é uma ação de negócio com origem(ns), destino, permissão,
justificativa (ou não) e pré-condições:

| Ação | De → Para | Permissão | Justificativa |
|---|---|---|---|
| `start_diagnosis` | open → diagnosing | `kanban.move` | — |
| `send_to_approval` | open/diagnosing → awaiting_approval | `kanban.move` | — |
| `approve` | awaiting_approval → approved | `kanban.move` | — |
| `reject` | awaiting_approval → rejected | `kanban.move` | **sim** |
| `return_to_diagnosis` | awaiting_approval/rejected → diagnosing | `kanban.move` | — |
| `start_execution` | approved/awaiting_parts → in_progress | `kanban.move` | — |
| `wait_for_parts` | approved/in_progress → awaiting_parts | `kanban.move` | — |
| `send_to_testing` | in_progress → testing | `kanban.move` | — |
| `mark_ready` | in_progress/testing → ready | `kanban.move` | — |
| `return_to_execution` | testing/ready → in_progress | `kanban.move` | — |
| `finish` | ready → finished | `orders.finish` | — |
| `cancel` | (ativos)/rejected → canceled | `orders.cancel` | **sim** |
| `reopen` | finished/canceled/rejected → (escolhido) | `orders.reopen` | **sim** |
| `force_transition` | qualquer → qualquer | `orders.force_transition` | **sim** |

As ações operacionais usam a permissão `kanban.move` (que Técnico e
Administrador já possuem); as **críticas** têm permissão dedicada
(`orders.finish`, `orders.cancel`, `orders.reopen`, `orders.force_transition`),
que por padrão são superuser-only — nenhum perfil semeado as recebe. O frontend
só mostra as ações liberadas; **o backend é sempre a validação final**.

Transições inválidas (ex.: `open → finished`, `awaiting_approval → in_progress`
sem aprovar, `canceled → in_progress`, `finished → in_progress` sem reabrir)
são recusadas com mensagem amigável (HTTP 400).

## Pré-condições (guards) configuráveis

Regras de negócio flexíveis, configuráveis em **Configurações da OS**
(`/settings/orders`). Os defaults preservam o comportamento atual (relaxado);
regras críticas de segurança (permissões, transições válidas) **não** são
configuráveis.

| Config | Efeito quando ligado |
|---|---|
| `require_diagnosis_before_approval` | `send_to_approval` exige diagnóstico preenchido ou itens/orçamento |
| `require_approved_quote_for_execution` | `approve` e `start_execution` exigem orçamento aprovado (total/parcial) |
| `require_checkin_before_execution` | `start_execution` exige check-in concluído |
| `require_payment_to_finish` | `finish` exige financeiro quitado (sem saldo em aberto) |

Ações bloqueadas por guard aparecem no `GET /transitions/` com
`available: false` e um `block_reason`, que o frontend exibe como impedimento.
Ações válidas para o status atual mas para as quais o usuário **não tem
permissão** também aparecem, com `permitted: false` — o frontend as mostra
**desabilitadas** (com o motivo no tooltip), em vez de sumir com o botão. Quando
não há **nenhuma** ação para o status atual, o painel de ações não é exibido.

## Justificativa e histórico

Ações críticas exigem **justificativa** (cancelar, recusar, reabrir, forçar). A
justificativa e a **ação**, o **de/para**, o **usuário**, a **origem** (manual,
sistema, aprovação, estoque, financeiro, integração) e a **data/hora** ficam
gravadas no `OrderStatusHistory` — exibido na aba de histórico/timeline da OS.
Transições críticas também geram registro de **auditoria**
(`orders.transition.<ação>`).

## Transação e concorrência

`state_machine.transition` executa dentro de uma transação, bloqueando a OS com
`select_for_update` e revalidando o status atual **dentro** da transação. Se a
transição falhar, nada é persistido (status e histórico salvos juntos).

## Efeitos colaterais

Controlados e transacionais (em `state_machine`), nunca no frontend:

- **Finalizar** → baixa de estoque das peças cadastradas (idempotente via
  `WorkOrder.stock_deducted`) + e-mail ao cliente (se configurado).
- **Pronta / Finalizada / marcos** → e-mail automático ao cliente conforme
  `OrderSettings.notify_statuses`.
- **Aprovação de orçamento** (presencial/tablet/link público) → avança a OS para
  **Aprovada** pela própria máquina de estados (origem = aprovação), com
  histórico e efeitos — corrigindo o bypass anterior que mudava o status sem
  rastro.
- **CRM Inteligente** lê o `OrderStatusHistory` (OS pronta há X dias, pós-serviço,
  aguardando aprovação, parada) para sugerir follow-ups.

## Integrações

- **Orçamento:** aprovar orçamento → OS `approved`; guards podem exigir orçamento
  aprovado para aprovar/executar.
- **Estoque:** baixa ao finalizar; guard opcional de peças (via check-in/orçamento).
- **Check-in:** guard opcional exige check-in concluído para iniciar a execução.
- **Financeiro:** guard opcional exige quitação para finalizar.
- **Notificações:** e-mails ao cliente nos marcos configurados.

## API

`GET /transitions/` → `{ status, status_display, transitions: [{ action, label,
target_status, permission, reason_required, critical, permitted, available,
block_reason, reopen_targets? }] }`

`POST /transition/` → corpo `{ action, reason?, notes?, target_status? }`;
retorna a OS atualizada, ou 400/403 com `detail` amigável.

O Kanban (`POST /move/`) continua funcionando: resolve a ação a partir do status
de destino arrastado e delega à máquina de estados (aceita `reason` para
transições que exigem justificativa).

## Testes

- Backend: `apps/orders/tests/test_state_machine.py` (transições válidas/inválidas,
  edição direta bloqueada, permissões, justificativa, histórico, reabertura,
  guards de orçamento/financeiro, aprovação de orçamento pela máquina, força) e
  `test_kanban_move.py`.
- Frontend: `src/test/OrderStatusActions.test.tsx` (só ações permitidas,
  impedimento com motivo, justificativa obrigatória).

Volte para o [índice da documentação](README.md).
