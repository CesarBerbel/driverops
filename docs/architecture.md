# Arquitetura e estrutura do projeto

```
driverops/
├── .env.example            # todas as variáveis de ambiente documentadas
├── docker-compose.yml      # db, mailpit, backend, frontend
├── Makefile                # automação dos comandos principais
├── docs/                   # esta documentação
├── scripts/                # scripts auxiliares (superusuário, entrypoint, wait-for-db)
├── backend/                 # Django + DRF
│   ├── config/               # settings (base/dev/prod), urls, wsgi/asgi
│   └── apps/
│       ├── accounts/          # User customizado, autenticação JWT via cookies, perfil,
│       │                      # troca/recuperação de senha, seed_admin, e o RBAC:
│       │                      # perfis, permissões, auditoria (ver users-permissions.md)
│       ├── categories/         # CRUD de categorias (clientes, peças, serviços) com soft delete
│       ├── customers/           # cadastro de clientes com endereço completo
│       ├── vehicles/             # cadastro de veículos vinculado a clientes, soft delete
│       ├── suppliers/             # cadastro de fornecedores com endereço completo, soft delete
│       ├── parts/                 # cadastro de peças em estoque vinculado a categorias/fornecedores, soft delete
│       ├── services/              # catálogo de serviços, peças padrão (through) e pacotes de serviços, soft delete
│       ├── orders/               # ordens de serviço (OS): veículo/cliente, itens cadastrados e avulsos, soft delete
│       ├── workshop/             # singletons de configuração: dados da oficina, configurações da OS e do Kanban
│       ├── quotes/              # orçamentos da OS: snapshot/versões, PDF, aprovação (física/tablet/link), página pública
│       └── core/               # health check e concerns compartilhados
└── frontend/                 # React + Vite + TS + Tailwind + shadcn/ui
    └── src/
        ├── features/
        │   ├── auth/           # contexto de autenticação, guardas de rota, páginas
        │   ├── dashboard/      # dashboard com abas (Operacional/OS/Administrativo), board de OS, indicadores
        │   ├── settings/       # página de Configurações (ponto de entrada administrativo)
        │   ├── categories/     # CRUD de categorias (clientes/peças/serviços, consome apps.categories)
        │   ├── customers/       # cadastro de clientes (consome apps.customers, cepService.ts)
        │   ├── vehicles/         # cadastro de veículos (consome apps.vehicles)
        │   ├── suppliers/        # cadastro de fornecedores (consome apps.suppliers)
        │   ├── parts/             # cadastro de peças em estoque (consome apps.parts e apps.suppliers)
        │   ├── services/          # serviços e pacotes de serviços (consome apps.services, apps.categories, apps.parts)
        │   ├── orders/            # ordens de serviço (consome apps.orders + clientes/veículos/serviços/peças)
        │   ├── kanban/            # Kanban OS: tela full width, colunas por status, drag and drop (consome apps.orders + apps.workshop)
        │   ├── quotes/            # orçamento da OS: painel na OS, assinatura no tablet, página pública /orcamento/:token (consome apps.quotes)
        │   ├── settings/          # Configurações: dados da oficina, OS e Kanban (consome apps.workshop)
        │   ├── profile/        # página de perfil
        │   └── landing/        # página pública
        ├── components/
        │   ├── layout/         # AppShell, Topbar (menu superior fixo), UserMenu
        │   ├── ui/              # primitivos shadcn/ui
        │   └── shared/          # PasswordInput, MaskedInput, CustomerCombobox, SupplierCombobox,
        │                        # PartCombobox, ServiceCombobox e outros componentes reutilizáveis
        ├── lib/                 # cliente axios com refresh automático, masks.ts, cepService.ts, utils
        └── routes/               # definição de rotas
```

## Backend

Nove apps Django: `accounts` (User customizado, autenticação JWT via cookies httpOnly, perfil,
troca/recuperação de senha, permissão de superusuário, comando `seed_admin`), `categories` (um único
modelo `Category` genérico com um discriminador `category_type` (`client`/`part`/`service`) atende
as categorias de clientes, peças e serviços -- a unicidade do nome é escopada por
`(category_type, name)`, e `is_active` nunca é exposto como um campo de "status" na API pública,
apenas usado para filtrar a listagem e decidir se a categoria pode ser reativada; ver
[Categorias](categories.md)), `customers`
(cadastro de clientes com endereço completo e soft delete -- ver [Clientes](customers.md)), `vehicles`
(cadastro de veículos com soft delete, obrigatoriamente vinculado a um cliente -- ver
[Veículos](vehicles.md)), `suppliers` (cadastro de fornecedores com endereço completo e soft
delete, mesmo formato de campos de `customers` -- ver [Fornecedores](suppliers.md)), `parts`
(cadastro de peças em estoque com soft delete, obrigatoriamente vinculado a uma categoria de peça e
opcionalmente a um fornecedor -- ver [Peças e Estoque](parts.md)), `services` (catálogo de serviços
e pacotes de serviços com soft delete -- ver [Serviços](services.md)) e `core` (health check,
indicadores consolidados do Dashboard em `GET /api/dashboard/stats/`, e concerns compartilhados como
os grupos de período -- ver [Dashboard](dashboard.md)). A listagem de OS também aceita
`?board=operational` (só OS no fluxo, sem finalizadas/canceladas) e `?period=` para as visões do
Dashboard. Ver também [Segurança](security.md) para as decisões por trás do
esquema de autenticação.

**Paginação (sempre limitada, *fail-safe*).** As listagens do DRF usam
`OptionalPageNumberPagination` (`apps/core/pagination.py`): **nenhuma** resposta é
ilimitada. Com `?page=N` (e opcional `?page_size=`, máx. 200) a resposta é o
envelope paginado `{count, next, previous, results}`; **sem** `?page` a resposta
é a lista **cortada em 200** e devolvida como array cru (compatível com o
frontend, que lê arrays), acompanhada do cabeçalho `X-Result-Limit` avisando o
teto -- para ir além, o cliente pagina com `?page`. As poucas *views* com
`list()` próprio (CRM, leads) também impõem esse teto (`[:200]`). Isso protege o
servidor de varreduras/respostas gigantes sem exigir mudança simultânea no
frontend. Observabilidade e logging estruturado ficam em `LOGGING` (nível por
`LOG_LEVEL`), com captura de erros opcional via Sentry em produção.

`apps.vehicles` depende de `apps.customers` (FK `Vehicle.customer`), nunca o contrário -- o
`CustomerViewSet.get_queryset()` anota `vehicle_count` (contagem de veículos ativos de cada cliente)
usando a relação reversa `related_name="vehicles"` do Django, resolvida via app registry, sem importar
`apps.vehicles` em `apps.customers`. Esse acoplamento é unidirecional por design: um app de domínio
pode depender de outro "abaixo" dele, mas o inverso quebraria o isolamento entre apps.
`apps.parts` segue a mesma regra: depende de `apps.categories` (FK `Part.category`, restrita a
`category_type="part"`) e de `apps.suppliers` (FK `Part.supplier`, opcional -- `null=True`), nunca o
contrário; `apps.suppliers` nunca importa `apps.parts`. `apps.services` também segue a regra:
depende de `apps.categories` (FK `Service.category`, restrita a `category_type="service"`) e de
`apps.parts` (`ServicePart.part`), nunca o contrário. É o primeiro app com **modelos de ligação**
(`ServicePart`, `PackageService`) e os primeiros serializers com **escrita aninhada** -- todo o
restante do backend usa apenas FKs simples. Os valores calculados (valor do serviço, total e final
do pacote) são derivados no serializer e nunca persistidos. `apps.orders` (Ordens de Serviço) fica no
topo dessa cadeia: depende de `apps.customers`, `apps.vehicles`, `apps.services` e `apps.parts`,
nunca o contrário. Cada OS tem linhas (`WorkOrderService`, `WorkOrderPackage`, `WorkOrderPart`) que
podem referenciar um cadastro (FK opcional) ou ser **avulsas** (FK nula + texto livre) -- o nome e o
valor são congelados na linha (snapshot) para preservar o histórico. Os totais (serviços, pacotes,
peças, bruto e final com desconto) são calculados no serializer, nunca persistidos, e o veículo é
validado como pertencente ao cliente. Ver [Ordens de Serviço](orders.md). `apps.workshop` guarda três
**singletons** de configuração (`WorkshopProfile` = Dados da Oficina; `OrderSettings` = Configurações
da OS; `KanbanSettings` = colunas visíveis/ordem do Kanban), cada um com um único registro (`pk=1`). A
escrita exige superusuário (`IsSuperUser`); a leitura, apenas autenticação. As regras de transição de
status da OS no Kanban ficam em `apps.orders/status_transitions.py` (validadas no endpoint dedicado
`POST /api/work-orders/{id}/move/`) -- ver [Kanban OS](kanban.md). `apps.orders` depende de `apps.workshop` para preencher a previsão de
entrega de novas OS (data de abertura + prazo padrão), aplicado só na criação -- alterar o prazo
global nunca altera uma OS existente. Ver [Configurações](configuracoes.md). `apps.quotes` (Orçamentos)
fica acima de `apps.orders`: depende de `apps.orders` (a OS de origem) e de `apps.workshop` (dados da
oficina e termos), nunca o contrário. Cada orçamento é um **snapshot** dos itens/valores da OS
(congelado por versão), com totais calculados no backend, token público seguro para a página de
aprovação (`/api/public/quotes/{token}/`, sem autenticação e limitada àquele orçamento), geração de
PDF (xhtml2pdf) e trilha de auditoria. Ver [Orçamento da OS](quotes.md).

## Frontend

Organizado por feature (`auth`, `dashboard`, `settings`, `categories`, `customers`, `vehicles`,
`suppliers`, `parts`, `services`, `orders`, `quotes`, `kanban`, `profile`, `landing`), com componentes de layout
(`AppShell`/`Topbar`/`UserMenu` -- apenas menu superior fixo, sem sidebar) e primitivos de UI
(`components/ui`, estilo shadcn/ui) separados dos componentes de página. `lib/api-client.ts`
centraliza o cliente axios com renovação automática de token em respostas 401; `lib/masks.ts`
centraliza as funções de máscara (telefone, CPF/CNPJ, CEP, UF, moeda/quantidade em padrão
brasileiro, NCM) reutilizadas via os componentes `components/shared/MaskedInput.tsx` e
`components/shared/CurrencyInput.tsx`; `lib/cepService.ts` centraliza a integração com o ViaCEP
(relocado de `features/customers/cepService.ts` quando Fornecedores passou a precisar da mesma
consulta -- deixou de ser algo exclusivo de Clientes). `CustomerCombobox`
(`components/shared/CustomerCombobox.tsx`) e `SupplierCombobox`
(`components/shared/SupplierCombobox.tsx`) são autocompletes reutilizáveis com a mesma estrutura,
usados respectivamente pelo formulário de veículos (cliente responsável) e pelo formulário de peças
(fornecedor). `PartCombobox` e `ServiceCombobox` seguem a mesma estrutura como seletores
"adicionar-à-lista" (múltiplos itens): o de peças alimenta a seção de peças padrão do serviço, e o
de serviços alimenta a montagem do pacote. `VehicleCombobox` (busca por placa, seleção única com
autopreenchimento do cliente) e `PackageCombobox` (adicionar-à-lista) foram acrescentados para a
Ordem de Serviço. Os cadastros inline reaproveitam os `QuickCreateDialog`/`FormSheet` existentes:
`CustomerFormSheet` e `VehicleFormSheet` ganharam um callback opcional `onCreated` (e o de veículo
aceita um cliente padrão) para devolver o registro recém-criado à OS e selecioná-lo sem perder os
dados já preenchidos. Os formulários de cadastro (clientes, veículos, fornecedores, peças, serviços,
pacotes e categorias) aceitam uma prop `allowAddAnother`: quando ligada (apenas na criação avulsa a
partir da listagem, nunca em edição ou no cadastro inline), exibem um botão **"Salvar e adicionar
outro"** que salva e **reseta o formulário** (via `reset`) em vez de fechar, para incluir vários
registros em sequência.

Navegação administrativa é toda por drill-down de cards, sem menus/submenus dedicados: Dashboard →
card "Configurações" → cards "Dados da Oficina"/"Configurações da OS" (singletons de `apps.workshop`,
edição só para superusuário) e "Categorias de Clientes"/"de Peças"/"de Serviços" → CRUD, Dashboard →
card "Clientes" → CRUD, Dashboard → card "Veículos" → CRUD, Dashboard → card "Fornecedores" → CRUD,
Dashboard → card "Estoque" → CRUD de peças, Dashboard → card "Serviços" → CRUD de serviços (com um
controle segmentado interno para alternar entre Serviços e Pacotes de Serviços, já que não há
primitivo de abas), e Dashboard → card "Ordens de Serviço" (em destaque, largura total) → lista de OS
→ formulário de cadastro/edição em página própria (`/orders/new`, `/orders/:id`). Isso é deliberado -- ver o card "Configurações" em
`features/settings/pages/SettingsPage.tsx` para o padrão a seguir ao adicionar novas áreas
administrativas. As três telas de categorias são a mesma tela
(`features/categories/components/CategoryManager.tsx`) parametrizada por tipo/título/descrição,
renderizada por três componentes de página finos -- esse é o padrão a seguir sempre que uma "nova
área administrativa" for na verdade uma variação de algo que já existe, em vez de duplicar o
CRUD inteiro.

`features/vehicles` depende de `features/customers` (a página de clientes renderiza o
`VehicleFormSheet` e o `VehicleSelectorDialog` para o ícone de carro por linha -- ver
["Ícone de carro na lista de clientes"](vehicles.md#ícone-de-carro-na-lista-de-clientes) em
[Veículos](vehicles.md)) -- essa é a única direção de acoplamento entre as duas features de página.

`features/parts` depende de `features/categories` (o formulário de peça reutiliza
`CategoryForm.tsx` -- extraído de `CategoryManager.tsx` justamente para isso -- dentro de um
`CategoryQuickCreateDialog.tsx` próprio, permitindo criar uma categoria de peça sem sair do
cadastro da peça; ver [Peças e Estoque → Adicionar categoria inline](parts.md#adicionar-categoria-inline))
e, pelo mesmo motivo, de `features/suppliers` (`SupplierCombobox` para o seletor de fornecedor e
`SupplierQuickCreateDialog.tsx` -- envolvendo `SupplierForm.tsx`, extraído de forma idêntica ao
`CategoryForm.tsx` -- para o cadastro rápido; ver
[Peças e Estoque → Adicionar fornecedor inline](parts.md#adicionar-fornecedor-inline)). Esse é o
padrão a seguir sempre que um formulário precisar de um "criar rapidamente" para uma entidade
relacionada: extrair o formulário da entidade relacionada para um componente exportado e
reutilizável, em vez de duplicar sua lógica de criação/validação. Seguindo esse padrão, o próprio
`PartForm` foi extraído de `PartFormSheet.tsx` para `features/parts/components/PartForm.tsx` (com um
`PartQuickCreateDialog.tsx`) para que `features/services` possa criar uma peça inline a partir do
cadastro de serviço.

`features/services` depende de `features/categories` (`CategoryQuickCreateDialog` com
`categoryType="service"`) e de `features/parts` (`PartCombobox` para vincular peças padrão e
`PartQuickCreateDialog` para criar uma peça inline) -- as duas peças do cadastro de serviço reusam o
mesmo padrão de "criar rapidamente" descrito acima. O `ServiceForm` também é embutível
(`onSuccess(entidade)`), envolvido por um `ServiceQuickCreateDialog` usado no cadastro de pacote
para criar um serviço inline (`PackageForm` → `ServiceQuickCreateDialog` → `ServiceForm` →
`PartQuickCreateDialog`, aninhamento de diálogos que o Radix suporta e cujos `stopPropagation` de
submit isolam cada formulário).

**Convenção de `id` em formulários reutilizáveis**: como um formulário pode ser aninhado dentro de
outro via Dialog/Portal (ex.: `PartForm` dentro de `ServiceForm`), os `id`/`htmlFor` de cada
formulário reutilizável são prefixados pelo domínio (`part-`, `supplier-`, `category-`,
`service-`...) para evitar colisão de `id` no DOM quando dois formulários coexistem.

---
Voltar para o [índice da documentação](README.md).
