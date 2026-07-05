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
| `approved` (Aprovado) | Aprovado (física / tablet / link). Terminal. |
| `rejected` (Recusado) | Recusado pelo cliente/oficina. Terminal. |
| `expired` (Expirado) | Passou da validade sem decisão. Terminal. |
| `canceled` (Cancelado) | Cancelado internamente. Terminal. |

Estados **terminais** não permitem nova decisão nem edição direta — para revisar, gere uma **nova
versão** (novo orçamento a partir da OS).

## Itens e valores

O orçamento exibe, separadamente: serviços, pacotes e peças (cadastrados e avulsos, com a marca
"avulso"). Cada item tem descrição, quantidade, valor unitário e subtotal. Os totais
(**mão de obra/serviços, pacotes, peças, bruto, desconto, valor final**) são **calculados no
backend** (`apps/quotes/calc.py`) — o frontend nunca é a fonte da verdade. Valores em Real
brasileiro (`R$ 0,00`); item sem valor aparece como `R$ 0,00`.

## Snapshot e versionamento

- Ao criar, o orçamento **congela** os itens e valores da OS naquele momento.
- Alterar a OS depois **não** modifica orçamentos já criados (muito menos aprovados).
- Para refletir mudanças da OS, crie um novo orçamento — ele recebe `version` incrementada
  (v1, v2, …); as versões anteriores permanecem visíveis no painel para consulta/histórico.
- Orçamentos nunca são apagados fisicamente pela interface (cancelar = `canceled`; excluir =
  soft delete, mantendo o registro).

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

Gerado com visual profissional (`apps/quotes/pdf.py` + template `quotes/quote_pdf.html`), contém:
logo e dados da oficina (nome fantasia, razão social, CNPJ, contato), números da OS e do orçamento,
data de emissão, validade, dados do cliente e do veículo/placa, relato, diagnóstico, itens
(serviços/pacotes/peças com quantidade, valor unitário e subtotal), totais, desconto, valor final,
termos, campo para assinatura física, **assinatura digital incorporada quando houver**, data/hora da
aprovação e o rodapé configurado. Se um termo não estiver configurado, o PDF é gerado assim mesmo
(sem quebrar); as quebras de linha dos termos são preservadas.

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
| `POST` | `/api/quotes/` (`{work_order}`) | Cria orçamento (snapshot + nova versão) | Autenticado |
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
