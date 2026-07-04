# Configurações: Dados da Oficina e Configurações da OS

Duas seções globais dentro de **Configurações**, organizadas no mesmo padrão de cards do sistema
(sem menu lateral). Centralizam informações institucionais da oficina e regras operacionais da
Ordem de Serviço, e preparam os dados para a geração futura de PDFs (OS, orçamento, garantia,
autorização e entrega).

- **Branch:** `feature/configuracoes-oficina`
- **App backend:** `apps.workshop` (modelos singleton `WorkshopProfile` e `OrderSettings`)
- **API:** `/api/workshop-profile/` e `/api/order-settings/`
- **Rotas frontend:** `/settings/workshop` e `/settings/orders`

## Como rodar

Mesmo ambiente Docker do projeto (ver [Primeiros passos](getting-started.md)):

```bash
make up                 # sobe db, mailpit, backend e frontend
make migrate            # aplica as migrations (inclui apps/workshop/0001_initial)
make makemigrations     # gera migrations após alterar os models
make test               # backend (pytest) + frontend (vitest)
make lint               # ruff + black --check + oxlint
make build              # bundle de produção do frontend
```

## Fluxo de acesso

```
Dashboard → card "Configurações"          → Configurações
Configurações → card "Dados da Oficina"    → /settings/workshop
Configurações → card "Configurações da OS" → /settings/orders
Configurações → cards de categorias        → (Clientes, Peças, Serviços -- já existentes)
```

Cada tela tem título, descrição, botão **"Salvar alterações"** e um link **"Voltar"** para
Configurações, além de estados de loading, erro e sucesso.

## Permissões

- **Leitura:** qualquer usuário autenticado.
- **Edição:** apenas **superusuários**. Para usuários sem permissão, a tela é exibida em modo
  somente-leitura (campos desabilitados), com um aviso e sem o botão de salvar; a API responde
  `403` a tentativas de escrita.
- Rotas protegidas: usuários não autenticados são redirecionados para o login.

Os dois registros são **singletons** (um único registro por instância, `pk=1`): sempre existe
exatamente um conjunto de dados da oficina e um conjunto de configurações da OS.

## Dados da Oficina

Dados institucionais usados futuramente nos cabeçalhos, rodapés e identificações dos PDFs.

| Campo | Observação |
|---|---|
| Nome fantasia | **Obrigatório** |
| Razão social | Opcional |
| CNPJ | Máscara `00.000.000/0000-00`; normalizado para dígitos no backend |
| Inscrição estadual | Opcional |
| Responsável | Opcional |
| E-mail principal | Valida o formato quando preenchido |
| Telefone | Máscara brasileira; normalizado para dígitos |
| WhatsApp | Máscara brasileira; normalizado para dígitos |
| Site | Opcional |
| Logotipo | Opcional -- **upload de arquivo** de imagem (PNG, JPG, WEBP ou GIF, até 2 MB) |
| CEP | Máscara `00000-000`; consulta o endereço no ViaCEP |
| Rua/Logradouro, Número, Complemento, Bairro, Cidade | Endereço completo, padrão brasileiro |
| Estado (UF) | Exibido em maiúsculas |
| País | Padrão "Brasil" |
| Observações institucionais | Opcional |

- Ao digitar o **CEP** completo, o endereço é preenchido automaticamente via ViaCEP; os campos
  continuam **editáveis**.
- CNPJ, telefone, WhatsApp e CEP são **normalizados para dígitos** no backend (mesmo padrão de
  Clientes/Fornecedores); a UF é gravada em maiúsculas.
- O **logotipo** é enviado por **upload** (não URL) por um endpoint dedicado, com pré-visualização e
  botão de remover. Formatos aceitos: PNG, JPG, WEBP ou GIF, até 2 MB (SVG é intencionalmente
  excluído por poder conter scripts). Os arquivos são servidos via `MEDIA` pelo backend em
  desenvolvimento (`/media/...`); em produção seriam servidos pelo web server/CDN.

## Configurações da OS

Regras padrão e textos reutilizados na criação, edição e geração futura de PDFs da OS.

| Campo | Observação |
|---|---|
| Prazo padrão de entrega | Inteiro em **dias** (ver regra abaixo) |
| Termo de garantia | Texto longo -- PDFs de OS, orçamento e garantia |
| Termo de orçamento | Texto longo -- PDFs de orçamento/aprovação |
| Termo de autorização de serviço | Texto longo -- PDFs de autorização de execução |
| Termo de ciência do cliente | Texto longo -- documentos de aceite/retirada/entrega |
| Observações padrão da OS | Texto longo |
| Texto padrão do rodapé dos PDFs | Texto longo |
| Instruções para documentos impressos | Texto longo |
| Condições gerais de atendimento | Texto longo |

### Prazo padrão de entrega

- Define a **quantidade padrão de dias** para a previsão de entrega. **Valor inicial: `7 dias`.**
- Ao criar uma **nova OS**, o campo **"Previsão de entrega" é preenchido automaticamente** com
  **data de abertura + prazo padrão**. Exemplo: OS aberta em `01/08/2026` com prazo de `7 dias` →
  previsão `08/08/2026`. Se a data de abertura mudar, a previsão é recalculada automaticamente até
  que o usuário a ajuste manualmente.
- O usuário pode **alterar manualmente** a previsão dentro da OS, sem mudar a configuração global.
- Alterar a configuração global **não altera OS já criadas** -- o cálculo é aplicado apenas na
  criação de novas OS (o backend preenche a previsão na criação quando ela não é informada).
- Não aceita valor **negativo**; aceita **`0`** (entrega no mesmo dia). O campo exibe a unidade
  "dias".

### Termos e textos padrão (uso futuro nos PDFs)

- Os termos serão usados nos PDFs correspondentes (garantia, orçamento, autorização, ciência do
  cliente) e o texto de rodapé no rodapé dos documentos gerados.
- Os campos aceitam **texto longo** e **preservam quebras de linha** (`textarea` simples nesta fase;
  editor rico fica para o futuro).
- Já vêm com **valores padrão** para facilitar o uso em desenvolvimento.
- **Nenhum termo é obrigatório** para criar uma OS -- a ausência de termos não bloqueia a criação.

## Máscaras brasileiras utilizadas

- **CNPJ:** `00.000.000/0000-00`
- **CEP:** `00000-000` (com consulta ViaCEP)
- **Telefone/WhatsApp:** `(00) 00000-0000` / `(00) 0000-0000`
- **UF:** duas letras maiúsculas

Todas reutilizam `lib/masks.ts` e o componente `components/shared/MaskedInput.tsx`, e a integração de
CEP reutiliza `lib/cepService.ts`.

## API

Ambos os endpoints operam sobre o registro único e exigem autenticação (cookie JWT); a escrita
(`PATCH`) exige superusuário.

| Método | Rota | Ação |
|---|---|---|
| GET | `/api/workshop-profile/` | Retorna os dados da oficina (cria o singleton com padrões na primeira leitura) |
| PATCH | `/api/workshop-profile/` | Atualiza os dados da oficina (superusuário) |
| POST | `/api/workshop-profile/logo/` | Envia/substitui o logotipo (multipart, campo `logo`; superusuário) |
| DELETE | `/api/workshop-profile/logo/` | Remove o logotipo (superusuário) |
| GET | `/api/order-settings/` | Retorna as configurações da OS (com os termos padrão) |
| PATCH | `/api/order-settings/` | Atualiza as configurações da OS (superusuário) |

## Limitações conhecidas desta fase

- **Editor de texto simples** (`textarea`) para os termos -- sem editor rico (negrito/listas) nesta
  fase; a formatação básica por quebras de linha é preservada.
- Registro **único por instância** (não há multiempresa/multi-oficina nesta fase; o padrão singleton
  já isola um conjunto ativo de cada configuração).
- A **geração de PDFs** ainda não existe -- os dados e textos ficam preparados para consumo futuro.
