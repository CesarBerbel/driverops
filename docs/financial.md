# Financeiro — Pagamentos, Contas a Receber, Despesas e Relatórios

A **frente financeira**: registrar **pagamentos** por Ordem de Serviço, acompanhar o **status
financeiro** de cada OS (em aberto / parcial / pago), ver as **contas a receber** (OS com saldo em
aberto), lançar as **despesas** da oficina (saídas) e os **relatórios** por período — incluindo o
**resultado (DRE)**: receitas − despesas.

- **App backend:** `apps.financial` (modelos `Payment` e `Expense`)
- **API:** `/api/payments/*` e `/api/expenses/*`
- **Rotas frontend:** `/financial` (contas a receber), `/financial/expenses` (despesas) —
  ambas `financial.view` — e `/financial/reports` (relatórios, `financial.reports`)
- **Módulo de permissões:** `financial` (ver [Usuários e Permissões](users-permissions.md))

## Como rodar

Mesmo ambiente Docker do restante do projeto:

```bash
make up                 # sobe db, mailpit, backend e frontend
make migrate            # aplica as migrations (inclui apps/financial/0001_initial)
make makemigrations     # gera migrations após alterar os models
make test               # backend (pytest) + frontend (vitest)
make lint               # ruff + black --check + oxlint
make build              # bundle de produção do frontend
```

## Fluxo

```
Dashboard → aba Operacional → card "Financeiro"   → /financial (Contas a receber)
/financial → linha da OS → "Pagamentos"            → diálogo de pagamentos da OS
Diálogo → "Registrar pagamento"                    → lança um pagamento
Diálogo → ícone de lixeira (por pagamento)         → estorna o pagamento
```

O card **"Financeiro"** só aparece no Dashboard para quem tem `financial.view`. A rota `/financial` é
protegida pela mesma permissão (`RequirePermission`), com o backend validando de novo.

## Status financeiro da OS

Cada OS passa a expor três campos **calculados no backend** (nunca persistidos), no serializer da OS:

- `amount_paid` — soma dos pagamentos da OS.
- `balance_due` — `valor final − pago` (nunca negativo).
- `payment_status` — `open` (em aberto, nada pago), `partial` (pago em parte) ou `paid` (pago em
  cheio, `pago ≥ valor final`).

Esses valores aparecem no **Resumo** da OS (aba "Resumo e valores"), no diálogo de pagamentos e na
tabela de contas a receber. O valor final é o mesmo cálculo da OS (serviços + pacotes + peças −
desconto), então mudanças nos itens refletem no saldo após salvar.

## Contas a receber (`/financial`)

Tabela das **OS ativas (não canceladas) com saldo devedor > 0**, com:

- **Total a receber** no topo (soma dos saldos).
- Colunas: número, cliente, veículo, valor final, pago, saldo e **status** (pílula colorida).
- **Busca** por número/placa/cliente e **filtro por status** da OS.
- Ação **"Pagamentos"** por linha, que abre o diálogo da OS.

OS **quitadas** (saldo 0) e **canceladas** não aparecem. A listagem vem de
`GET /api/payments/receivables/`.

## Diálogo de pagamentos

Aberto por OS, mostra o resumo (valor final / pago / saldo), o **formulário de registro** e a
**lista de pagamentos**:

- **Registrar pagamento**: valor (máscara `R$ 0,00`), **forma de pagamento** (Pix, Dinheiro, Cartão
  de débito/crédito, Transferência, Boleto, Outro), data e observação. O valor deve ser maior que zero.
- **Estornar**: remove um pagamento (lixeira), restaurando o saldo.
- O resumo (pago/saldo/status) é recalculado **ao vivo** a partir dos pagamentos listados.

Registrar/estornar exige `financial.register_payment`; quem tem apenas `financial.view` vê o resumo,
a lista e as contas a receber, mas **não** registra nem estorna.

## Despesas (`/financial/expenses`)

A aba **Despesas** registra as **saídas de caixa** da oficina (independentes das OS): aluguel,
fornecedores/peças, salários/mão de obra, água/luz/internet, impostos/taxas, marketing,
manutenção/equipamentos e outras. Cada despesa tem **descrição, categoria, valor, forma de pagamento,
data** e observação. A tela lista com **filtro por categoria e período** e busca por descrição, mostra
o **total no período** e permite **criar, editar e excluir** despesas.

Registrar/editar/excluir exige `financial.register_expense`; quem tem apenas `financial.view` só
consulta. CRUD em `/api/expenses/`.

## Relatórios (`/financial/reports`)

A aba **Relatórios** (controle segmentado) mostra o **resultado do período** e os **recebimentos**,
exigindo `financial.reports`. Um **filtro de período** (Hoje, Esta semana, Este mês, Últimos 30 dias,
Tudo) alimenta:

- **Resultado (DRE)** em stat tiles: **Receitas** (recebimentos), **Despesas** (saídas), **Resultado**
  (`receitas − despesas`, verde = lucro / vermelho = prejuízo) e **Ticket médio**.
- **Recebimentos por dia**: série diária do período (dias sem recebimento = 0) em barras.
- **Por forma de pagamento**: quebra do total recebido por forma, ordenada, em barras.
- **Despesas por categoria**: quebra do total de despesas por categoria, em barras.

Os gráficos usam **hue único por medida** (recebimentos em destaque, despesas em vermelho) com
**rótulos diretos** de valor e o nome da categoria em texto — a identidade nunca depende só de cor. As
fontes são `GET /api/payments/report/?period=...` (recebimentos) e `GET /api/expenses/dre/?period=...`
(resultado + despesas por categoria).

## Registro na linha do tempo da OS

Cada pagamento registrado ou estornado também vira um **evento** na
[linha do tempo da OS](orders.md#histórico-da-os-linha-do-tempo-de-eventos)
("Pagamento registrado" / "Pagamento estornado", com a forma e o valor), mantendo a rastreabilidade.

## Permissões

| Permissão | O que libera |
|---|---|
| `financial.view` | Ver contas a receber, pagamentos e o status financeiro; acessar `/financial`. |
| `financial.register_payment` | Registrar e estornar pagamentos. |
| `financial.register_expense` | Criar, editar e excluir despesas. |
| `financial.reports` | Ver os **relatórios financeiros** e o **resultado (DRE)**. |
| `financial.view_margin` | **Crítica** — ver custos/margens (reservada; só superuser por padrão). |

Por padrão, o perfil **Financeiro** e o **Administrador** têm `financial.view` e
`financial.register_payment` (não críticas). Ver [Usuários e Permissões](users-permissions.md).

## API

Todas as rotas exigem autenticação (cookie JWT):

| Método | Rota | Ação |
|---|---|---|
| GET | `/api/payments/?order={id}` | Lista os pagamentos de uma OS (exige `financial.view`) |
| POST | `/api/payments/` | Registra um pagamento `{ order, amount, method, paid_at, note }` (exige `financial.register_payment`) |
| DELETE | `/api/payments/{id}/` | Estorna um pagamento (exige `financial.register_payment`) |
| GET | `/api/payments/receivables/?search=&status=` | Contas a receber: OS com saldo devedor, com `total_receivable` |
| GET | `/api/payments/report/?period=` | Relatório de recebimentos (totais, ticket médio, por forma, por dia) — exige `financial.reports` |
| GET/POST | `/api/expenses/?period=&category=&search=` | Lista / cria despesas (POST exige `financial.register_expense`) |
| PATCH/DELETE | `/api/expenses/{id}/` | Edita / exclui uma despesa (exige `financial.register_expense`) |
| GET | `/api/expenses/dre/?period=` | Resultado do período: receitas, despesas, resultado e despesas por categoria — exige `financial.reports` |

## Limitações desta fase

- Pagamentos e despesas são **lançamentos simples** (sem parcelamento, juros ou conciliação bancária).
- O **resultado (DRE)** é por regime de caixa (recebimentos − despesas no período), não por
  competência; não há centros de custo nem projeções.
