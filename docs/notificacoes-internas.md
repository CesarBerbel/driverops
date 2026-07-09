# Central de Notificações Interna

Ponto único de **avisos operacionais internos** para a equipe da oficina: novos
pedidos do site, OS vencendo/atrasadas, orçamentos pendentes, estoque crítico,
pagamentos do dia etc. Cada usuário vê apenas o que é relevante ao seu perfil e
às suas permissões.

> Não confundir com [Templates de Notificação ao Cliente](../docs/README.md)
> (`apps.notifications`), que são as comunicações enviadas **ao cliente**. Esta
> central (`apps.alerts`) é para avisos **internos** do sistema.

- **App backend:** `apps.alerts`
- **API:** `/api/notifications/...`, `/api/notification-rules/`, `/api/notification-preferences/`
- **Rotas frontend:** `/notifications` (central), `/settings/notifications` (config)
- **RBAC:** módulo `alerts` (`view`, `configure`, `send_manual`, `view_financial`, `view_admin`)

## Sino, contador e dropdown

No topo do sistema há um **sino** (`NotificationBell`) com um contador das não
lidas do usuário (exato até 99, depois `99+`, oculto quando zero; atualiza por
polling a cada 60s e após qualquer leitura). Ao clicar, abre um **dropdown**
compacto com as mais recentes, botão "Marcar todas", leitura por item e link
"Ver todas". Tem estados de carregando, erro e vazio.

## Página completa (`/notifications`)

Central com resumo de não lidas, **filtros** (status: todas/não lidas/lidas/
arquivadas; módulo; prioridade; busca por texto), **agrupamento por data**
(Hoje/Ontem/data), **ações em massa** (selecionar, marcar selecionadas como
lidas, marcar todas) e por item (abrir entidade, marcar lida/não lida,
arquivar). Estados de carregando, erro e vazio implementados.

## Modelo (uma linha por destinatário)

Cada aviso é **individual**: no momento da criação o sistema faz *fan-out* para
todos os destinatários elegíveis (uma `Notification` por usuário). Isso mantém
leitura, contador e filtros corretos por usuário e simplifica a deduplicação.
O projeto é de **oficina única** (sem multi-tenant), então o escopo é por
usuário + permissão de módulo.

Campos principais: destinatário, tipo, módulo, título, mensagem, detalhe,
prioridade (informativa/atenção/importante/urgente/crítica), status (não lida/
lida/arquivada), entidade relacionada + URL de destino, dados JSON, origem
(automática/manual), chave de deduplicação e expiração opcional.

## Prioridade e acessibilidade

A prioridade **nunca** é indicada só por cor: cada badge tem ícone + rótulo
textual. Datas são relativas ("há 5 min", "ontem") com a data completa no
tooltip. Notificações lidas ficam mais discretas; não lidas têm marcador.

## Avisos automáticos

### Por evento (imediato)

- **Novo pedido do site** — disparado quando um pedido é recebido pela página
  pública (hook em `apps.leads`).

### Por rotina periódica (`sync_notifications`)

| Tipo | Regra |
|---|---|
| Pedido do site sem contato | Pedido `Novo` há mais de `lead_time_hours`. |
| OS próxima do vencimento | `expected_delivery` dentro da janela (`lead_time_hours`), OS operacional. |
| OS atrasada | `expected_delivery` no passado, OS operacional. |
| OS parada no status | Sem mudança de status há mais de `stall_days`. |
| Orçamento aguardando resposta | Enviado/visualizado há mais de `stall_days`. |
| Orçamento aprovado/recusado | Decisão detectada (uma vez por orçamento). |
| Pagamentos registrados hoje | Resumo dos pagamentos com `paid_at` = hoje. |
| OS com pagamento pendente | OS prontas/finalizadas com saldo em aberto. |
| Estoque abaixo do mínimo | Peça com `current_quantity <= min_quantity`. |

> **Nota sobre financeiro:** o projeto não tem um modelo de contas a receber/
> pagar com **vencimento**. Por isso "pagamentos do dia" é interpretado como
> *pagamentos registrados hoje* e "pagamentos atrasados" como *OS entregues/
> prontas com saldo em aberto* — ambos dados reais e computáveis. Não há módulo
> de **agenda**, então avisos de agendamento ficam fora desta versão.

O comando é **idempotente** (deduplicação por `dedup_key`); pode ser agendado no
cron sem gerar avisos repetidos:

```bash
docker compose exec backend python manage.py sync_notifications
```

## Deduplicação e agrupamento

A `dedup_key` é única por destinatário. As chaves periódicas incluem a data, de
modo que o aviso "renasce" a cada dia enquanto a pendência existir, sem duplicar
no mesmo dia. Se o aviso ainda estiver **não lido**, a rotina apenas atualiza o
texto (mantém fresco sem re-alertar). Regras com **agrupar semelhantes** geram um
resumo ("3 OS atrasadas", "7 peças abaixo do mínimo") em vez de um aviso por item.

## Permissões e visibilidade (módulo `alerts`)

| Permissão | Libera | Perfis padrão |
|---|---|---|
| `alerts.view` | Ver a central e os avisos | Todos os perfis operacionais |
| `alerts.configure` | Configurar os avisos automáticos | Administrador |
| `alerts.send_manual` | Enviar aviso manual | Administrador |
| `alerts.view_financial` | Receber avisos financeiros | Administrador, Financeiro |
| `alerts.view_admin` | Receber avisos administrativos | Administrador |

O usuário só recebe/vê avisos de um módulo se tiver **`alerts.view` + a permissão
do módulo** (ex.: avisos de OS exigem `orders.view`; financeiros exigem
`alerts.view_financial`). A resolução é feita no backend (`resolve_recipients`),
nunca só no frontend, e cada usuário só acessa as **próprias** notificações.

## Configuração e preferências (`/settings/notifications`)

- **Avisos automáticos** (exige `alerts.configure`): por tipo — ativar/desativar,
  prioridade, antecedência (horas), limite (dias), e-mail interno, agrupar.
- **Minhas preferências** (qualquer usuário): silenciar módulos, só o que está
  atribuído a mim, só alta prioridade, silenciar informativos, som. As
  preferências **nunca** ampliam o que o usuário pode ver.
- **Enviar aviso manual** (exige `alerts.send_manual`): perfil destinatário,
  prioridade, título e mensagem (texto puro, sem HTML).

## Auditoria

Envio manual (`alert.manual_sent`) e alteração de regras (`alert.rules_updated`)
são registrados em `AuditLog`. A linha do tempo de cada pedido/OS mantém seus
próprios eventos nos módulos de origem.

Volte para o [índice da documentação](README.md).
