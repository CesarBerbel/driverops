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
│       ├── accounts/          # User customizado, autenticação JWT via cookies,
│       │                      # perfil, troca/recuperação de senha, seed_admin
│       ├── categories/         # CRUD de categorias (clientes, peças, serviços) com soft delete
│       ├── customers/           # cadastro de clientes com endereço completo
│       ├── vehicles/             # cadastro de veículos vinculado a clientes, soft delete
│       ├── parts/                 # cadastro de peças em estoque vinculado a categorias, soft delete
│       └── core/               # health check e concerns compartilhados
└── frontend/                 # React + Vite + TS + Tailwind + shadcn/ui
    └── src/
        ├── features/
        │   ├── auth/           # contexto de autenticação, guardas de rota, páginas
        │   ├── dashboard/      # página do dashboard
        │   ├── settings/       # página de Configurações (ponto de entrada administrativo)
        │   ├── categories/     # CRUD de categorias (clientes/peças/serviços, consome apps.categories)
        │   ├── customers/       # cadastro de clientes (consome apps.customers, cepService.ts)
        │   ├── vehicles/         # cadastro de veículos (consome apps.vehicles)
        │   ├── parts/             # cadastro de peças em estoque (consome apps.parts)
        │   ├── profile/        # página de perfil
        │   └── landing/        # página pública
        ├── components/
        │   ├── layout/         # AppShell, Topbar (menu superior fixo), UserMenu
        │   ├── ui/              # primitivos shadcn/ui
        │   └── shared/          # PasswordInput, MaskedInput, CustomerCombobox e outros componentes
        │                        # reutilizáveis
        ├── lib/                 # cliente axios com refresh automático, masks.ts, utils
        └── routes/               # definição de rotas
```

## Backend

Cinco apps Django: `accounts` (User customizado, autenticação JWT via cookies httpOnly, perfil,
troca/recuperação de senha, permissão de superusuário, comando `seed_admin`), `categories` (um único
modelo `Category` genérico com um discriminador `category_type` (`client`/`part`/`service`) atende
as categorias de clientes, peças e serviços -- a unicidade do nome é escopada por
`(category_type, name)`, e `is_active` nunca é exposto como um campo de "status" na API pública,
apenas usado para filtrar a listagem e decidir se a categoria pode ser reativada; ver
[Categorias](categories.md)), `customers`
(cadastro de clientes com endereço completo, sem exclusão -- ver [Clientes](customers.md)), `vehicles`
(cadastro de veículos com soft delete, obrigatoriamente vinculado a um cliente -- ver
[Veículos](vehicles.md)), `parts` (cadastro de peças em estoque com soft delete, obrigatoriamente
vinculado a uma categoria de peça -- ver [Peças e Estoque](parts.md)) e `core` (health check e
concerns compartilhados futuros). Ver também [Segurança](security.md) para as decisões por trás do
esquema de autenticação.

`apps.vehicles` depende de `apps.customers` (FK `Vehicle.customer`), nunca o contrário -- o
`CustomerViewSet.get_queryset()` anota `vehicle_count` (contagem de veículos ativos de cada cliente)
usando a relação reversa `related_name="vehicles"` do Django, resolvida via app registry, sem importar
`apps.vehicles` em `apps.customers`. Esse acoplamento é unidirecional por design: um app de domínio
pode depender de outro "abaixo" dele, mas o inverso quebraria o isolamento entre apps.
`apps.parts` segue a mesma regra: depende de `apps.categories` (FK `Part.category`, restrita a
`category_type="part"`), nunca o contrário.

## Frontend

Organizado por feature (`auth`, `dashboard`, `settings`, `categories`, `customers`, `vehicles`,
`parts`, `profile`, `landing`), com componentes de layout (`AppShell`/`Topbar`/`UserMenu` -- apenas
menu superior fixo, sem sidebar) e primitivos de UI (`components/ui`, estilo shadcn/ui) separados dos
componentes de página. `lib/api-client.ts` centraliza o cliente axios com renovação automática de
token em respostas 401; `lib/masks.ts` centraliza as funções de máscara (telefone, CPF/CNPJ, CEP, UF,
moeda/quantidade em padrão brasileiro, NCM) reutilizadas via os componentes
`components/shared/MaskedInput.tsx` e `components/shared/CurrencyInput.tsx`. `CustomerCombobox`
(`components/shared/CustomerCombobox.tsx`) é um autocomplete de clientes reutilizável, usado pelo
formulário de veículos para selecionar o cliente responsável.

Navegação administrativa é toda por drill-down de cards, sem menus/submenus dedicados: Dashboard →
card "Configurações" → cards "Categorias de Clientes"/"de Peças"/"de Serviços" → CRUD, Dashboard →
card "Clientes" → CRUD, Dashboard → card "Veículos" → CRUD, e Dashboard → card "Estoque" → CRUD de
peças. Isso é deliberado -- ver o card "Configurações" em
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
cadastro da peça; ver [Peças e Estoque → Adicionar categoria inline](parts.md#adicionar-categoria-inline)).
Esse é o padrão a seguir sempre que um formulário precisar de um "criar rapidamente" para uma
entidade relacionada: extrair o formulário da entidade relacionada para um componente exportado e
reutilizável, em vez de duplicar sua lógica de criação/validação.

---
Voltar para o [índice da documentação](README.md).
