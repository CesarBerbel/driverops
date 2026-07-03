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
│       ├── categories/         # CRUD de categorias com soft delete
│       ├── customers/           # cadastro de clientes com endereço completo
│       ├── vehicles/             # cadastro de veículos vinculado a clientes, soft delete
│       └── core/               # health check e concerns compartilhados
└── frontend/                 # React + Vite + TS + Tailwind + shadcn/ui
    └── src/
        ├── features/
        │   ├── auth/           # contexto de autenticação, guardas de rota, páginas
        │   ├── dashboard/      # página do dashboard
        │   ├── settings/       # página de Configurações (ponto de entrada administrativo)
        │   ├── categories/     # CRUD de categorias (consome apps.categories)
        │   ├── customers/       # cadastro de clientes (consome apps.customers, cepService.ts)
        │   ├── vehicles/         # cadastro de veículos (consome apps.vehicles)
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
troca/recuperação de senha, permissão de superusuário, comando `seed_admin`), `categories` (CRUD de
categorias com soft delete -- `is_active` nunca é exposto como um campo de "status" na API pública,
apenas usado para filtrar a listagem e decidir se a categoria pode ser reativada), `customers`
(cadastro de clientes com endereço completo, sem exclusão -- ver [Clientes](customers.md)), `vehicles`
(cadastro de veículos com soft delete, obrigatoriamente vinculado a um cliente -- ver
[Veículos](vehicles.md)) e `core` (health check e concerns compartilhados futuros). Ver também
[Segurança](security.md) para as decisões por trás do esquema de autenticação.

`apps.vehicles` depende de `apps.customers` (FK `Vehicle.customer`), nunca o contrário -- o
`CustomerViewSet.get_queryset()` anota `vehicle_count` (contagem de veículos ativos de cada cliente)
usando a relação reversa `related_name="vehicles"` do Django, resolvida via app registry, sem importar
`apps.vehicles` em `apps.customers`. Esse acoplamento é unidirecional por design: um app de domínio
pode depender de outro "abaixo" dele, mas o inverso quebraria o isolamento entre apps.

## Frontend

Organizado por feature (`auth`, `dashboard`, `settings`, `categories`, `customers`, `vehicles`,
`profile`, `landing`), com componentes de layout (`AppShell`/`Topbar`/`UserMenu` -- apenas menu
superior fixo, sem sidebar) e primitivos de UI (`components/ui`, estilo shadcn/ui) separados dos
componentes de página. `lib/api-client.ts` centraliza o cliente axios com renovação automática de
token em respostas 401; `lib/masks.ts` centraliza as funções de máscara (telefone, CPF/CNPJ, CEP, UF)
reutilizadas via o componente `components/shared/MaskedInput.tsx`. `CustomerCombobox`
(`components/shared/CustomerCombobox.tsx`) é um autocomplete de clientes reutilizável, usado pelo
formulário de veículos para selecionar o cliente responsável.

Navegação administrativa é toda por drill-down de cards, sem menus/submenus dedicados: Dashboard →
card "Configurações" → card "Categorias" → CRUD, Dashboard → card "Clientes" → CRUD, e Dashboard →
card "Veículos" → CRUD. Isso é deliberado -- ver o card "Configurações" em
`features/settings/pages/SettingsPage.tsx` para o padrão a seguir ao adicionar novas áreas
administrativas.

`features/vehicles` depende de `features/customers` (a página de clientes renderiza o
`VehicleFormSheet` e o `VehicleSelectorDialog` para o ícone de carro por linha -- ver
["Ícone de carro na lista de clientes"](vehicles.md#ícone-de-carro-na-lista-de-clientes) em
[Veículos](vehicles.md)) -- essa é a única direção de acoplamento entre as duas features de página.

---
Voltar para o [índice da documentação](README.md).
