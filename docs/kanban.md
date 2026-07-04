# Kanban OS

O **Kanban OS** é uma tela própria de acompanhamento operacional das Ordens de Serviço, com
colunas por status, cards em formato de placa de carro, drag and drop entre colunas e filtros.

## Acesso

- Item **"Kanban OS"** no menu superior da aplicação (a navegação do sistema é exclusivamente
  superior — não há sidebar).
- Rota: `/kanban`.
- O Kanban **não** é um card do Dashboard. É uma tela dedicada, com foco total na operação.
- Requer autenticação: usuários não logados são redirecionados para `/login`.

## Layout

A tela abre em **full width**, ocupando o máximo da área útil (`100svh` menos a barra superior):

- O cabeçalho (título) e os **filtros permanecem fixos** no topo da área do Kanban.
- As colunas ficam **lado a lado** horizontalmente.
- A **rolagem vertical acontece somente dentro de cada coluna** (scroll interno independente).
- A página inteira **não rola verticalmente** junto com os cards.
- As colunas têm altura calculada para preencher a área disponível.

### Responsividade

O layout troca no breakpoint `lg` (1024px), detectado por `useMediaQuery`:

- **Desktop (≥ 1024px):** board com colunas lado a lado, largura total, drag and drop completo.
- **Mobile e tablet (< 1024px):** o board vira um **acordeão** — as colunas viram seções empilhadas
  verticalmente. Cada seção mostra o nome do status e a contagem, e expande/retrai ao toque
  (a primeira já vem aberta). Os cards ficam em largura total dentro da seção aberta e a lista rola
  verticalmente. Como o drag and drop por toque é limitado, a mudança de status usa a **ação
  "Mover"** (menu de status) presente em cada card.

## Colunas

As colunas seguem os status principais da OS, nesta ordem:

| Status | Coluna | Visível por padrão |
|---|---|---|
| `open` | Aberta | Sim |
| `diagnosing` | Em diagnóstico | Sim |
| `awaiting_approval` | Aguardando aprovação | Sim |
| `approved` | Aprovada | Sim |
| `in_progress` | Em execução | Sim |
| `awaiting_parts` | Aguardando peças | Sim |
| `testing` | Em teste | Sim |
| `ready` | Pronta para entrega | Sim |
| `finished` | Finalizada | **Não** (desmarcada por padrão) |
| `canceled` | Cancelada | **Não** (desmarcada por padrão) |

Por padrão o Kanban exibe apenas as colunas operacionais. **"Finalizada"** e **"Cancelada"** existem
no sistema, mas só aparecem se habilitadas na configuração de colunas.

Cada coluna exibe: nome do status, quantidade de OS, lista de cards, estado vazio quando não há OS e
um **indicador visual** (destaque) quando está apta a receber um card durante o arraste.

## Card em formato de placa

Cada OS aparece como um card inspirado em uma **placa de carro** (proporção horizontal, bordas
arredondadas, placa Mercosul em destaque). A **placa do veículo é o elemento mais destacado**.

Conteúdo obrigatório do card:

- **Placa do veículo** (topo, em destaque) — ex.: `ABC1D23`.
- **Número da OS** — ex.: `OS 0123`.
- **Nome do cliente** — ex.: `Mariana Souza`.
- **WhatsApp clicável** — ex.: `(11) 98888-1234`.

Informações adicionais discretas: marca/modelo do veículo, valor total da OS, previsão de entrega e
**indicador de atraso** (ícone de alerta quando a OS está vencida). Esses extras não competem com a
placa, a OS, o cliente e o WhatsApp.

### WhatsApp no card

- Usa o mesmo componente (`ContactLink`) e padrão dos demais pontos do sistema: link `wa.me` para
  WhatsApp, `tel:` como fallback de telefone, máscara brasileira.
- Abre em nova aba (`target="_blank"`), funciona em desktop e mobile.
- O clique no WhatsApp **não** abre o modal nem inicia o drag and drop (`stopPropagation`).
- Sem WhatsApp/telefone cadastrado, exibe "WhatsApp não informado" de forma discreta.

## Drag and drop e transições de status

- Arraste um card de uma coluna para outra para **mudar o status** da OS.
- A coluna de destino **destaca-se** quando está apta a receber o card; o card arrastado fica com
  estado visual próprio (opacidade/rotação/anel).
- A alteração é **otimista**: o card muda de coluna imediatamente e, em caso de erro no backend, faz
  **rollback** para a coluna anterior (com toast de erro).
- **Alternativa acessível / mobile:** o menu **"Mover"** de cada card lista apenas os destinos
  válidos e muda o status sem arrastar. É a mesma operação do drag and drop.

### Regras de transição

O backend é a **fonte da verdade** — o frontend nunca é a única barreira. As transições permitidas
(`backend/apps/orders/status_transitions.py`, espelhadas em `frontend/src/features/orders/constants.ts`):

| De | Para |
|---|---|
| Aberta | Em diagnóstico, Aguardando aprovação, Cancelada |
| Em diagnóstico | Aguardando aprovação, Cancelada |
| Aguardando aprovação | Aprovada, Cancelada |
| Aprovada | Em execução, Cancelada |
| Em execução | Aguardando peças, Em teste, Pronta para entrega |
| Aguardando peças | Em execução |
| Em teste | Pronta para entrega, Em execução |
| Pronta para entrega | Finalizada |
| Finalizada | — (terminal no Kanban) |
| Cancelada | — (terminal no Kanban) |

- Transições inválidas são **impedidas** (a coluna não aceita o drop) e, se forçadas via API,
  retornam `400` com mensagem clara.
- **"Finalizada"** e **"Cancelada"** são terminais no Kanban: não saem por drag and drop (exigiria a
  edição completa da OS). A arquitetura já está preparada para regras por permissão no futuro.
- A mudança de status é validada no endpoint dedicado `POST /api/work-orders/{id}/move/`.

## Filtros

Fixos no topo, com busca **debounced** (300 ms):

- **Busca** por número da OS, placa, nome do cliente e telefone/WhatsApp.
- **Período de abertura** (Todo o período / Hoje / Esta semana / Este mês).
- **Atrasadas** — apenas OS com previsão de entrega vencida e ainda em andamento.
- **Limpar filtros** — reseta busca, período e atraso.

Os filtros são **refletidos na URL** (`?q=...&period=...&overdue=true`), permitindo compartilhar ou
recarregar a tela sem perder o estado. Abrir/fechar o modal de OS preserva filtros, coluna e posição
de scroll. Quando nenhum resultado é encontrado, um estado vazio é exibido.

## Modal rápido da OS

Ao clicar em um card (sem arrastar), abre um modal de visualização rápida com: número da OS, status,
placa, veículo, marca/modelo, cliente, WhatsApp clicável, data de abertura, previsão de entrega,
relato do cliente, diagnóstico, serviços/pacotes/peças vinculados, valor total e observações.

- O modal abre **sem sair do Kanban**; fechá-lo mantém o usuário no Kanban.
- Possui o botão **"Abrir OS"** (destacado) que leva à tela completa e editável da Ordem de Serviço
  (`/orders/{id}`).
- Responsivo — reutiliza o mesmo componente do Dashboard (`OSQuickViewModal`).

## Configuração das colunas (Configurações → Kanban OS)

Card **"Kanban OS"** em **Configurações** → tela `/settings/kanban`
(`ServiceOrderKanbanSettings`):

- Lista todos os status/colunas disponíveis, cada um com **checkbox** para habilitar/desabilitar.
- Permite **reordenar** as colunas (setas para cima/baixo).
- Botões **"Salvar alterações"** e **"Restaurar padrão"**.
- **"Finalizada"** e **"Cancelada"** vêm **desmarcadas por padrão**.

Regras:

- A configuração é **persistida** (singleton `KanbanSettings`, `GET/PATCH /api/kanban-settings/`).
- Ao salvar, o Kanban reflete a nova configuração (colunas visíveis e ordem).
- Colunas desmarcadas não aparecem na tela principal; as **OS daqueles status continuam no sistema**
  — apenas deixam de ser exibidas nessa visão. Reativar a coluna faz as OS voltarem a aparecer.
- A configuração controla **apenas a visibilidade/ordem das colunas** — **nunca** altera o status de
  nenhuma OS.
- **Apenas superusuários** podem alterar a configuração (leitura para qualquer autenticado; escrita
  `IsSuperUser`). Não superusuários veem a tela em modo somente leitura, com aviso.
- A configuração é global (singleton). Em um cenário multiempresa/multioficina futuro, seria isolada
  por oficina/tenant.

## API

| Método | Rota | Descrição | Permissão |
|---|---|---|---|
| `GET` | `/api/work-orders/?status=open,in_progress&overdue=true&search=...&period=...` | Lista OS por múltiplos status / atraso / busca / período | Autenticado |
| `POST` | `/api/work-orders/{id}/move/` | Muda o status validando a transição (`{"status": "..."}`) | Autenticado |
| `GET` | `/api/kanban-settings/` | Configuração de colunas (cria o singleton na primeira leitura) | Autenticado |
| `PATCH` | `/api/kanban-settings/` | Atualiza visibilidade/ordem das colunas | Superusuário |

## Rodando o projeto e os testes

```bash
make up              # sobe o ambiente (frontend :5173, backend :8000)
make seed-scenarios  # popula 10 OS de exemplo em vários status (dev/teste)
make test            # backend (pytest) + frontend (vitest)
make lint            # ruff + black --check + oxlint
make build           # bundle de produção do frontend
```

Cobertura de testes relevante:

- Backend: `apps/orders/tests/test_kanban_move.py` (transições válidas/inválidas, terminal, no-op,
  filtros `status` múltiplo e `overdue`), `apps/workshop/tests/test_kanban_settings.py`
  (defaults, permissão de escrita, validação de status/duplicatas).
- Frontend: `src/test/KanbanPage.test.tsx` (colunas visíveis, card de placa, modal, mover via menu),
  `src/test/KanbanSettingsPage.test.tsx` (defaults, salvar, restaurar padrão, permissão),
  `src/test/Topbar.test.tsx` (item "Kanban OS").

## Componentes

- `ServiceOrderKanban` — orquestra colunas, drag state, mutação de move (otimista + rollback) e modal.
- `ServiceOrderKanbanColumn` — coluna do board (desktop) com contagem, scroll interno e realce de
  drop válido.
- `ServiceOrderKanbanAccordion` — layout de acordeão empilhado para mobile/tablet (< `lg`).
- `ServiceOrderPlateCard` — card em formato de placa (draggable + menu "Mover").
- `KanbanPage` — tela full width com cabeçalho/filtros fixos.
- `ServiceOrderKanbanSettings` (`KanbanSettingsPage`) — configuração das colunas.
- `OSQuickViewModal` — modal rápido reaproveitado do Dashboard.

Volte para o [índice da documentação](README.md).
