# Central do Cliente 360°

A **Central do Cliente 360°** reúne, em uma única tela, todas as informações
relevantes de um cliente: contatos, indicadores, alertas, veículos, ordens de
serviço, orçamentos, interações, resumo financeiro e uma linha do tempo
unificada. O objetivo é dar contexto completo antes de qualquer atendimento,
sem obrigar o usuário a navegar por várias telas.

## Como acessar

A tela vive em `/customers/:id/360` e está protegida pela permissão
`customers.view`. O nome do cliente é clicável em praticamente toda a
aplicação, sempre levando à Central 360° — via o componente compartilhado
`CustomerLink` (`components/shared/CustomerLink.tsx`), que só vira link quando
há um `id` de cliente em contexto:

- **Lista de Clientes** — o nome é um link e há o ícone de ação "Cliente 360°".
- **Ordens de Serviço** — nome do cliente na listagem e no resumo da OS.
- **Kanban** — nome do cliente no card da OS.
- **Dashboard** — nome do cliente no card da OS e no modal de visão rápida.
- **Financeiro** — nome do cliente nas contas a receber e no diálogo de
  pagamento.
- **Veículos** — nome do proprietário na listagem.
- **Pedidos do Site (leads)** — cliente correspondente/vinculado e dono do
  veículo na tela de detalhe do lead.
- **CRM Inteligente** — nome do cliente em cada sugestão.

> A rota também aceita ser aberta diretamente (ex.: colada no navegador); o
> `RequirePermission` redireciona quem não tiver `customers.view`.

> Orçamentos (`Quote`/`PublicQuote`) não expõem o `id` do cliente no payload,
> então o nome ali permanece como texto — e a página pública de aprovação, por
> ser sem login, nunca deve apontar para uma rota interna.

## Layout

### Cabeçalho e ações rápidas

Mostra o avatar (iniciais), nome, tipo (Pessoa Física/Jurídica), documento e
contatos. O número do cliente (WhatsApp, ou o telefone quando não há um WhatsApp
separado) é exibido como link que abre a conversa no WhatsApp — o telefone é
sempre tratado como contato de WhatsApp. As ações rápidas aparecem conforme os
dados disponíveis:

- **WhatsApp** — abre a conversa (usa `buildWhatsAppUrl`), com `whatsapp || phone`.
- **Ligar** — `tel:` do telefone.
- **E-mail** — `mailto:` do e-mail.
- **Nova OS** — atalho para abrir uma ordem de serviço já com o cliente.

### Cards de resumo

Indicadores consolidados: veículos, OS abertas, OS finalizadas, orçamentos
pendentes/aprovados, valor total e valor em aberto (estes dois últimos apenas
para quem tem `financial.view`), última visita e última interação.

### Alertas

Avisos contextuais por severidade (`info`/`warning`/`danger`), por exemplo
"OS em aberto", "orçamento aguardando decisão" ou "saldo em aberto". Cada aviso
pode ser **dispensado** (botão ×) para limpar a tela; a dispensa vale só para a
visita atual — ao reentrar na tela do cliente os avisos aparecem de novo (o
estado é local, não persiste no backend).

### Abas (carregadas sob demanda)

Cada aba busca seus dados apenas quando é aberta pela primeira vez (lazy
loading via React Query com `enabled`):

| Aba | Conteúdo | Origem |
|---|---|---|
| **Visão geral** | Veículos, OS abertas, última OS finalizada, orçamentos pendentes e interações recentes | payload do `/360` |
| **Veículos** | Veículos do cliente | payload do `/360` |
| **OS** | Ordens de serviço do cliente | `GET /work-orders/` |
| **Orçamentos** | Orçamentos do cliente | `GET /quotes/` |
| **Interações** | Histórico de interações + formulário para registrar nova | `GET`/`POST /interactions/` |
| **Financeiro** | Total, pago, em aberto, OS com saldo e últimos pagamentos | `GET /financial-summary/` |
| **Linha do tempo** | Eventos unificados em ordem cronológica | `GET /timeline/` |

A aba **Financeiro** só aparece para usuários com `financial.view`. O
formulário de registro de interações só aparece para quem tem
`customers.interactions`.

## Interações do cliente

O modelo `CustomerInteraction` registra o relacionamento com o cliente
(ligação, WhatsApp, e-mail, presencial, lead do site, follow-up, campanha,
reclamação, elogio, nota, retorno). Cada interação tem tipo, canal, resumo
(obrigatório), conteúdo, status (aberta/resolvida/aguardando/sem sucesso),
próxima ação/data e vínculos opcionais com veículo, OS ou orçamento.

Registrar uma interação exige a permissão `customers.interactions` (concedida
por padrão aos perfis **Atendente** e **Técnico**) e gera registro de
auditoria.

## Linha do tempo unificada

A aba **Linha do tempo** agrega, em ordem decrescente, eventos de várias
origens: cadastro do cliente e dos veículos, abertura e conclusão de OS, envio
e decisão de orçamentos, interações e — para quem tem `financial.view` —
pagamentos. Limitada aos 80 eventos mais recentes.

## Endpoints

Todos escopados pela permissão `customers.view` (exceto onde indicado):

| Método | Rota | Permissão | Descrição |
|---|---|---|---|
| GET | `/api/customers/{id}/360/` | `customers.view` | Payload consolidado (cliente, resumo, alertas, listas, flags) |
| GET | `/api/customers/{id}/work-orders/` | `customers.view` | Ordens de serviço do cliente |
| GET | `/api/customers/{id}/quotes/` | `customers.view` | Orçamentos do cliente |
| GET/POST | `/api/customers/{id}/interactions/` | `customers.interactions` | Listar/registrar interações |
| GET | `/api/customers/{id}/financial-summary/` | `financial.view` | Resumo financeiro |
| GET | `/api/customers/{id}/timeline/` | `customers.view` | Linha do tempo unificada |

Os campos financeiros do payload `/360/` (valor total/em aberto) vêm `null`
para usuários sem `financial.view`; a flag `can_financial` controla a exibição
da aba e dos cards financeiros no frontend, e `can_interactions` controla o
formulário de registro.

## Estados de tela

- **Carregando** — usa o sistema de loading padrão (EngineLoader).
- **Erro** — mensagem "Não foi possível carregar o cliente."
- **Vazio** — cada aba trata a ausência de dados com mensagem própria.
- **Sem permissão** — a rota é bloqueada por `customers.view`; abas/ações
  sensíveis (financeiro, registro de interação) respeitam suas permissões.

O layout é responsivo (cards em grid fluido, abas roláveis no mobile).

## Testes

- Backend: `apps/customers/tests/test_customer360.py` cobre visão geral,
  permissão `customers.view`, gate do financeiro (técnico 403, admin 200,
  técnico com `can_financial=False`), criação/listagem de interações e
  auditoria, validação do resumo obrigatório, listas de OS/orçamentos e a
  linha do tempo.
- Frontend: `src/test/Customer360.test.tsx` cobre carregamento do cabeçalho,
  resumo e alertas, gate da aba financeira, lazy loading do financeiro,
  registro de interação e estado de erro.
