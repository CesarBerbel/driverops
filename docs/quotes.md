# Orçamento da Ordem de Serviço

O módulo de **orçamento** transforma os itens de uma OS em uma proposta que o cliente pode aprovar
ou recusar — presencialmente (assinatura física ou no tablet) ou remotamente (link por e-mail) —
com geração de PDF, snapshot dos valores, versionamento e trilha de auditoria.

## Como rodar o projeto e os testes

```bash
make up               # sobe o ambiente (frontend :5173, backend :8000, mailpit :8025)
make migrate          # aplica as migrations (inclui apps.quotes)
make seed-scenarios   # popula OS de exemplo (dev/teste)
make test             # backend (pytest) + frontend (vitest)
make lint             # ruff + black --check + oxlint
make build            # bundle de produção do frontend
```

O PDF usa **xhtml2pdf** (puro Python, sem dependências de sistema — já em `requirements.txt`).
Os e-mails de aprovação usam o SMTP de desenvolvimento (**Mailpit**, http://localhost:8025).

## Fluxo do orçamento

1. Abra uma OS já salva (`/orders/{id}`) — o painel **Orçamentos** aparece abaixo do formulário.
2. **Criar orçamento** — gera um snapshot dos serviços/pacotes/peças (cadastrados e avulsos), do
   desconto, do relato e do diagnóstico da OS. Nasce como **Rascunho**.
3. **Gerar PDF** — documento profissional para conferência/impressão/assinatura física.
4. Aprovação (um dos canais):
   - **Assinatura física:** imprime, o cliente assina, e o usuário registra "Aprovar presencial".
   - **Assinatura no tablet:** o cliente revisa e assina num canvas; a assinatura é salva como
     evidência e entra no PDF.
   - **Link por e-mail:** envia um link seguro; o cliente aprova/recusa numa página pública.
5. Ao aprovar, a OS avança para **Aprovada** (se estava em estágio inicial). Ao recusar, a OS
   permanece em **Aguardando aprovação** (a decisão fica registrada no orçamento).

## Status do orçamento

| Status | Significado |
|---|---|
| `draft` (Rascunho) | Criado, ainda não enviado/decidido. |
| `sent` (Enviado) | Link enviado por e-mail ao cliente. |
| `viewed` (Visualizado) | Cliente abriu a página pública. |
| `partially_approved` (Aprovado parcialmente) | Parte dos itens aprovada, parte recusada. Terminal. |
| `approved` (Aprovado integralmente) | Todos os itens aprovados. Terminal. |
| `rejected` (Recusado) | Todos os itens recusados. Terminal. |
| `expired` (Expirado) | Passou da validade sem decisão. Terminal. |
| `canceled` (Cancelado) | Cancelado internamente. Terminal. |

Estados **terminais** não permitem nova decisão nem edição direta — para revisar, gere uma **nova
versão** (novo orçamento a partir da OS).

### Status por item (aprovação parcial)

Cada linha do orçamento (`QuoteItem`) tem status individual: `pending` (Pendente), `approved`
(Aprovado) ou `rejected` (Recusado). Antes da decisão todos ficam pendentes; ao decidir, cada item
vira aprovado ou recusado. O status geral do orçamento é derivado dos itens:

- todos aprovados → **Aprovado integralmente**;
- alguns aprovados e outros recusados → **Aprovado parcialmente**;
- todos recusados → **Recusado**.

## Itens e valores

O orçamento exibe, separadamente: serviços, pacotes e peças (cadastrados e avulsos, com a marca
"avulso"). Cada item tem descrição, tipo, quantidade, valor unitário, subtotal e (após decisão) a
situação de aprovação. Os totais são **calculados no backend** (`apps/quotes/calc.py`) — o frontend
apenas exibe o resultado. Valores em Real brasileiro (`R$ 0,00`); item sem valor aparece como
`R$ 0,00`.

Totais calculados: **total orçado**, **total aprovado**, **total recusado**, **total pendente**,
desconto e **valor final (aprovado)**.

- Antes da decisão, a base do valor final é a proposta inteira; após a decisão, apenas os itens
  **aprovados** compõem o valor final. Itens recusados/pendentes nunca entram no valor aprovado.
- **Desconto:** incide sobre a base considerada — percentual preserva a proporção; fixo é limitado à
  base (nunca deixa o total negativo). Após aprovação parcial, o desconto é aplicado sobre o total
  aprovado.

Exemplo: total orçado `R$ 1.500,00`, aprovado `R$ 900,00`, recusado `R$ 600,00` →
valor final aprovado `R$ 900,00` (menos eventual desconto sobre os aprovados).

## Aprovação parcial

O cliente pode aprovar **todos**, **nenhum** ou **parte** dos itens. Funciona para serviços, pacotes
e peças (cadastrados e avulsos), nos três canais (física, tablet e link por e-mail):

- **Física:** no diálogo "Aprovar presencial", o usuário marca os itens aprovados (a partir do PDF
  assinado pelo cliente) e registra a decisão.
- **Tablet:** o cliente seleciona item a item (com "Aprovar todos"/"Recusar todos"), revê o valor
  final aprovado ao vivo e assina; a assinatura é obrigatória.
- **Link por e-mail:** na página pública, o cliente aprova/recusa cada item, vê o **total aprovado
  em tempo real**, aceita os termos e confirma.

Regras: itens aprovados continuam vinculados à OS e liberados para execução; itens recusados
permanecem no histórico do orçamento (não são executados nem entram no valor aprovado). A decisão por
item é **persistida** (snapshot) junto com data/hora, canal, usuário interno (presencial), IP/user
agent (link) e assinatura quando houver. Após a decisão o orçamento é terminal — alterar itens
aprovados exige **nova versão**.

### Peça vinculada ao serviço

Uma peça pode ser **vinculada a um serviço** da OS de duas formas:

- **Manual (inclui peças avulsas):** no formulário da OS, cada linha de peça tem um campo
  **"Serviço vinculado"** que lista os serviços da OS. A associação é persistida em
  `WorkOrderPart.linked_service` (por índice no payload, já que as linhas usam replace-all) e flui
  para o orçamento no snapshot. Funciona também para **peças avulsas** e **serviços avulsos**.
- **Automática:** quando uma peça é a **peça padrão** de um serviço presente na mesma OS, o vínculo é
  inferido no snapshot (via `ServicePart`). A associação manual tem **precedência** sobre a automática.

Itens vinculados são **aprovados/recusados em conjunto** — não é possível recusar a peça sem recusar
o serviço nem vice-versa. Na interface de aprovação a peça aparece **aninhada** sob o serviço (sem
controle próprio de aprovar/recusar, seguindo a decisão do serviço); no backend, a decisão da peça
vinculada sempre segue a do serviço (`apply_item_decisions`), independentemente do que o frontend
enviar. Peças avulsas ou não vinculadas continuam com decisão independente.

### Impacto na OS

Ao aprovar (integral ou parcialmente), a OS avança para **Aprovada** e reflete no Kanban. Apenas os
itens aprovados ficam liberados para execução; os recusados permanecem no histórico do orçamento. Se
tudo for recusado, a OS **não** avança. Para executar um item recusado depois, gere uma nova versão
do orçamento.

## Snapshot e versionamento

- Ao criar, o orçamento **congela** os itens e valores da OS naquele momento.
- Alterar a OS depois **não** modifica orçamentos já criados (muito menos aprovados).
- Para refletir mudanças da OS, crie um novo orçamento — ele recebe `version` incrementada
  (v1, v2, …); as versões anteriores permanecem visíveis no painel para consulta/histórico.
- Orçamentos nunca são apagados fisicamente pela interface (cancelar = `canceled`; excluir =
  soft delete, mantendo o registro).

### Um orçamento em aberto por OS

Não é possível ter **mais de um orçamento em aberto** para a mesma OS. Consideram-se **em aberto**
os status `draft` (rascunho), `sent` (enviado) e `viewed` (em análise/aguardando aprovação).

- Enquanto existir um orçamento em aberto, o botão **"Criar orçamento"** fica desabilitado (com aviso)
  e o backend recusa a criação com **HTTP 409**.
- Um novo orçamento só é liberado quando o atual for **decidido** (`approved`, `partially_approved`,
  `rejected`), **cancelado** (`canceled`) ou **expirado** (`expired`). Aí o novo vira uma **nova
  versão**, sem alterar retroativamente o anterior — valores aprovados, itens aceitos/recusados e a
  trilha de auditoria da versão anterior ficam preservados.
- Um orçamento em aberto que sofre **soft delete** deixa de bloquear (não conta mais).

## Aprovação por impressão e assinatura física

Gere o PDF (contém um campo de assinatura), imprima, colha a assinatura do cliente e clique em
**Aprovar presencial**. Registra data/hora, usuário responsável, canal `physical` e observação
opcional. Opcionalmente é possível anexar a via digitalizada (endpoint `upload-signed`).

## Aprovação presencial no tablet

Em **Assinar no tablet**, o cliente revisa o resumo, informa o nome e assina num canvas
(`SignaturePad`) com botões **Limpar assinatura** e **Confirmar aprovação** (assinatura
obrigatória). A assinatura é salva (PNG) associada ao orçamento/OS, registra data/hora, usuário e
canal `tablet`, e **aparece no PDF** do orçamento aprovado.

## Aprovação por link enviado por e-mail

Em **Enviar por e-mail**, o sistema gera um **token seguro** (`secrets.token_urlsafe`, não
sequencial) e envia ao cliente o link `.../orcamento/{token}`.

Regras do link/token:

- Único por orçamento/versão; não expõe ID sequencial.
- Validade opcional (`valid_until`) — link expirado exibe mensagem clara e não permite decisão.
- Sem login: o cliente só vê **aquele** orçamento (página pública limitada ao token); não acessa
  outros orçamentos nem telas internas.
- Após aprovar/recusar, o token não permite nova decisão (retorna o status atual, HTTP 409).
- A decisão registra **data/hora, IP e user agent**, além do nome e do aceite dos termos.

### Página pública de aprovação (`/orcamento/{token}`)

Mostra dados da oficina, números da OS e do orçamento, cliente, veículo/placa, relato, diagnóstico,
itens, valores, desconto, valor final e os termos. O cliente informa o nome, **marca que leu e
concorda com os termos** (aceite obrigatório e registrado), e **Aprovar** (com confirmação final
deixando claro que autoriza a execução) ou **Recusar** (motivo opcional). Depois exibe a mensagem de
confirmação e o status atual.

## PDF do orçamento

Gerado com visual **compacto e profissional** (`apps/quotes/pdf.py` + template
`quotes/quote_pdf.html`), otimizado para leitura rápida e impressão em preto e branco. Estrutura:

- **Cabeçalho em duas áreas** — área da oficina (logo reduzido, nome fantasia, razão social, CNPJ,
  telefone/WhatsApp, e-mail, endereço) e área do documento ("ORÇAMENTO", nº do orçamento, nº da OS,
  emissão, validade, status).
- **Logo reduzido:** limitado a ~**90×45px** mantendo a proporção. O logo é **redimensionado com
  Pillow** no backend (xhtml2pdf não respeita `max-width`/`max-height` em imagens data-URI), de modo
  que o cabeçalho fica compacto e o PDF leve. Sem logo, o PDF é gerado normalmente, sem área vazia.
- **Cliente e veículo:** nome, CPF/CNPJ, contatos; placa **em destaque**, marca/modelo/versão, ano e
  quilometragem quando disponíveis.
- **Relato, diagnóstico** em blocos compactos (quebras de linha preservadas). Observações internas
  **não** aparecem no PDF.
- **Itens** em tabela compacta (serviços/pacotes/peças, com "avulso" quando aplicável), com coluna
  **Situação** (Aprovado/Recusado) quando há decisão — itens recusados aparecem riscados, sem serem
  ocultados (fazem parte do histórico da proposta).
- **Resumo financeiro:** total orçado, total aprovado, total recusado, desconto e valor final
  aprovado. Orçamento parcial recebe um **banner** "Orçamento aprovado parcialmente — somente os
  itens marcados como Aprovado estão autorizados para execução".
- **Termos** (orçamento, garantia, autorização) e, na aprovação parcial, um **texto complementar**
  deixando claro que a autorização vale apenas para os itens aprovados.
- **Assinatura** — campo para assinatura física e, quando houver, a **assinatura digital
  incorporada** com nome do cliente, canal e data/hora da decisão. Rodapé configurado nas
  Configurações.

Se um termo não estiver configurado, o PDF é gerado assim mesmo (sem quebrar).

## Termos (das Configurações da OS)

Os textos vêm de **Configurações → Configurações da OS** (`apps.workshop.OrderSettings`):

- **Termo de orçamento** (`quote_terms`)
- **Termo de garantia** (`warranty_terms`)
- **Termo de autorização de serviço** (`service_authorization_terms`)
- **Rodapé padrão dos PDFs** (`pdf_footer_text`)

Os dados da oficina (logo, nome, CNPJ, contato) vêm de **Dados da Oficina**
(`apps.workshop.WorkshopProfile`). Ver [Configurações](configuracoes.md).

## Histórico e auditoria

Cada orçamento registra: quem criou e quando; quem enviou e quando; e-mail de envio; visualização;
canal da decisão; data/hora da aprovação ou recusa; usuário interno responsável (presencial); IP e
user agent (link); nome do cliente; aceite dos termos; assinatura digital; versão; e o motivo da
recusa. A trilha aparece no painel de Orçamentos e no Django admin.

## Segurança

- Links públicos usam tokens seguros e só permitem **ver / aprovar / recusar** aquele orçamento.
- A página pública não permite editar dados nem acessar outros orçamentos.
- Orçamentos aprovados preservam o snapshot; a decisão é bloqueada após terminal.
- Telas internas de orçamento exigem autenticação; a página pública dispensa login mas é limitada ao
  token. Ver [Segurança](security.md).

## API

| Método | Rota | Descrição | Acesso |
|---|---|---|---|
| `GET` | `/api/quotes/?work_order={id}` | Lista os orçamentos da OS | Autenticado |
| `POST` | `/api/quotes/` (`{work_order}`) | Cria orçamento (snapshot + nova versão); **409** se já houver um em aberto | Autenticado |
| `POST` | `/api/quotes/{id}/send/` | Envia link por e-mail | Autenticado |
| `POST` | `/api/quotes/{id}/approve-physical/` | Aprova (assinatura física) | Autenticado |
| `POST` | `/api/quotes/{id}/approve-tablet/` | Aprova (assinatura no tablet) | Autenticado |
| `POST` | `/api/quotes/{id}/reject/` | Recusa internamente | Autenticado |
| `POST` | `/api/quotes/{id}/cancel/` | Cancela | Autenticado |
| `POST` | `/api/quotes/{id}/upload-signed/` | Anexa via assinada (upload) | Autenticado |
| `GET` | `/api/quotes/{id}/pdf/` | PDF do orçamento | Autenticado |
| `GET` | `/api/public/quotes/{token}/` | Página pública (marca visualizado) | Público (token) |
| `POST` | `/api/public/quotes/{token}/approve/` | Aprova pelo link | Público (token) |
| `POST` | `/api/public/quotes/{token}/reject/` | Recusa pelo link | Público (token) |

## Componentes/arquivos

- Backend: `apps/quotes/{models,serializers,views,services,calc,pdf,emails,urls,admin}.py`,
  template `templates/quotes/quote_pdf.html`, filtros `templatetags/quote_extras.py`.
- Frontend: `features/quotes/` — `QuotePanel` (painel na OS), `TabletSignatureDialog` +
  `SignaturePad` (assinatura no tablet), `PublicQuoteApprovalPage` (`/orcamento/:token`), `api.ts`,
  `types.ts`, `quoteStatus.ts`.

Volte para o [índice da documentação](README.md).
