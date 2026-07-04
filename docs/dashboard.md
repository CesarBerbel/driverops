# Dashboard: abas Operacional, OS e Administrativo

O Dashboard é organizado em **três abas** no topo da área principal (abaixo do menu superior fixo),
permitindo alternar rapidamente entre visões sem sair do Dashboard e **sem menu lateral**. O menu
superior traz ainda um botão **"Nova OS"** sempre visível (atalho para `/orders/new`), ao lado do
menu do usuário.

- **Rotas frontend:** `/dashboard` com `?tab=operacional | os | administrativo`
- **Aba padrão:** `Operacional`
- **Backend:** endpoint de indicadores `GET /api/dashboard/stats/` e filtros `board`/`period` em
  `GET /api/work-orders/`

> O acompanhamento operacional aprofundado (colunas por status, drag and drop, filtros) fica no
> **[Kanban OS](kanban.md)** — uma **tela própria** acessada pelo menu superior, **não** um card do
> Dashboard.

## Como rodar

```bash
make up            # sobe o ambiente Docker (db, mailpit, backend, frontend)
make migrate       # aplica migrations
make test          # backend (pytest) + frontend (vitest)
make lint          # ruff + black --check + oxlint
make build         # bundle de produção do frontend
```

Frontend em http://localhost:5173, API em http://localhost:8000/api. O Dashboard exige usuário
autenticado (rota protegida).

## As abas

| Aba | Finalidade |
|---|---|
| **Operacional** | Central de atalhos para os módulos (visão atual em cards) |
| **OS** | Acompanhamento visual das Ordens de Serviço em andamento |
| **Administrativo** | Números consolidados do negócio (indicadores) |

- A aba ativa fica **visualmente destacada** (controle segmentado).
- A troca é **instantânea**, sem recarregar a aplicação; o estado é refletido na **URL**
  (`?tab=...`), então é possível compartilhar/recarregar mantendo a aba.
- **Desktop:** troca por **clique** na aba.
- **Tablet e mobile:** além do toque, a troca também acontece **arrastando o dedo na horizontal**
  (swipe). Arrastar da **direita para a esquerda avança** para a próxima aba; da **esquerda para a
  direita volta** para a anterior. A ordem é **Operacional → OS → Administrativo**. Nos extremos, o
  gesto não faz nada (sem erro). O swipe não interfere na rolagem vertical nem nos cliques (só um
  arraste claramente horizontal, acima de um limiar, troca de aba; nunca usa `preventDefault`). Em
  desktop, eventos de toque não disparam, então não há interferência.
- Componentes: `DashboardTabs` (abas + swipe via `useSwipeNavigation`), `DashboardOperacionalView`,
  `DashboardOSView`, `DashboardAdministrativoView`.

## Aba Operacional

Central de atalhos, baseada em cards de acesso rápido aos módulos:

- **Ordens de Serviço** (card **maior e em destaque**, largura total — principal ação operacional,
  componente `OrdersHeroCard`),
- Clientes, Veículos, Estoque, Serviços, Fornecedores, Configurações.

Objetivo: abertura rápida dos cadastros e módulos, com foco em ação e navegação.

## Aba OS

Visão operacional das OS em andamento, com cards em **formato de carro** para reconhecimento rápido
do veículo em atendimento. Organizada em **duas colunas**:

- **Abertas** — OS no início do fluxo: `Aberta`, `Em diagnóstico`, `Aguardando aprovação`.
- **Em andamento** — OS que avançaram: `Aprovada`, `Em execução`, `Aguardando peças`, `Em teste`,
  `Pronta para entrega`.

OS **finalizadas** e **canceladas** não aparecem nessa visão (o backend filtra via
`?board=operational`). Cada coluna mostra um **estado vazio amigável** quando não há OS
("Nenhuma OS aberta no momento." / "Nenhuma OS em andamento no momento.").

### Card de OS (formato de carro)

Componente `OSVehicleCard`. Identidade visual de veículo: uma **placa** no padrão Mercosul como
elemento **mais destacado**, ícone de carro como marca d'água e "rodas" na base. Cada card exibe:

- Número da OS.
- **Placa** em destaque (elemento principal — a operação prioriza o veículo).
- Marca e modelo, quando disponíveis.
- **Nome do cliente** e, **logo abaixo, o telefone/WhatsApp clicável** (quando existir).
- Status atual (pílula colorida).
- Data de abertura e previsão de entrega.
- Valor total.
- **Indicador de atraso** ("Atrasada") quando a previsão de entrega já venceu e a OS não está
  finalizada/cancelada.

Observação: não há campo de **prioridade** no modelo de OS nesta fase, então o indicador de
prioridade não é exibido (estrutura pronta para o futuro).

### Telefone/WhatsApp clicável

Componente compartilhado `ContactLink`, reutilizado no card, no modal e alinhado ao padrão de
Clientes/listagem de OS:

- Com **WhatsApp** cadastrado: abre a conversa em `https://wa.me/55<número>` em nova aba.
- Apenas **telefone** (sem WhatsApp): usa link `tel:+55<número>`.
- **Sem** telefone/WhatsApp: exibe texto discreto "Telefone não informado".
- Número exibido com **máscara brasileira** `(00) 00000-0000`; o link não quebra o layout em desktop
  nem em mobile e o clique no contato **não** aciona o clique do card (usa `stopPropagation`).

### Clique no card e modal de visualização rápida

Clicar no card **não** abre a edição diretamente — abre um **modal de resumo** (`OSQuickViewModal`),
mantendo o usuário na aba OS. O modal mostra: número e status, veículo e **placa**, marca/modelo,
cliente e **telefone/WhatsApp clicável**, data de abertura e previsão, relato do cliente, diagnóstico
(se houver), **serviços/pacotes/peças** vinculados, valor total e observações.

O modal traz um botão em destaque **"Abrir OS"** que leva à **tela completa e editável** da OS
(`/orders/:id`), e uma ação **"Fechar"**. Fechar mantém o usuário na aba OS, sem perder os filtros.
É responsivo (centralizado no desktop, quase tela cheia no mobile).

### Filtros da aba OS

- **Período:** Todas, Hoje, Esta semana, Este mês (filtra pela data de abertura).
- **Status:** todos os operacionais, ou um status específico.
- **Busca:** por **placa** ou **cliente** (com "Limpar").

Os filtros atualizam os cards das duas colunas. Por padrão a aba carrega apenas as OS relevantes
para acompanhamento (board operacional), evitando trazer finalizadas/canceladas.

## Aba Administrativo

Números consolidados (componente `DashboardAdministrativoView`), com **filtro de período** (Hoje,
Esta semana, Este mês, Últimos 30 dias). Indicadores exibidos:

- **Ordens de Serviço:** OS abertas, OS em andamento, OS finalizadas no período, valor estimado em OS
  em aberto, valor finalizado no período.
- **Cadastros:** clientes, veículos, fornecedores, serviços, pacotes.
- **Estoque:** peças cadastradas, peças com estoque baixo.

Os totais de cadastro refletem o estado atual; as métricas temporais (OS/valor finalizados) respeitam
o período. Há **skeleton** enquanto carrega e mensagem amigável em caso de erro. A estrutura está
preparada para expansão futura (dashboards financeiros/gerenciais). O endpoint
`GET /api/dashboard/stats/?period=...` exige autenticação.
