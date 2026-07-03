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
│       └── core/               # health check e concerns compartilhados
└── frontend/                 # React + Vite + TS + Tailwind + shadcn/ui
    └── src/
        ├── features/
        │   ├── auth/           # contexto de autenticação, guardas de rota, páginas
        │   ├── dashboard/      # página do dashboard
        │   ├── settings/       # página de Configurações (ponto de entrada administrativo)
        │   ├── categories/     # CRUD de categorias (consome apps.categories)
        │   ├── profile/        # página de perfil
        │   └── landing/        # página pública
        ├── components/
        │   ├── layout/         # AppShell, Topbar (menu superior fixo), UserMenu
        │   ├── ui/              # primitivos shadcn/ui
        │   └── shared/          # PasswordInput e outros componentes reutilizáveis
        ├── lib/                 # cliente axios com refresh automático, utils
        └── routes/               # definição de rotas
```

## Backend

Três apps Django: `accounts` (User customizado, autenticação JWT via cookies httpOnly, perfil,
troca/recuperação de senha, permissão de superusuário, comando `seed_admin`), `categories` (CRUD de
categorias com soft delete -- `is_active` nunca é exposto como um campo de "status" na API pública,
apenas usado para filtrar a listagem e decidir se a categoria pode ser reativada) e `core` (health
check e concerns compartilhados futuros). Ver também [Segurança](security.md) para as decisões por
trás do esquema de autenticação.

## Frontend

Organizado por feature (`auth`, `dashboard`, `settings`, `categories`, `profile`, `landing`), com
componentes de layout (`AppShell`/`Topbar`/`UserMenu` -- apenas menu superior fixo, sem sidebar) e
primitivos de UI (`components/ui`, estilo shadcn/ui) separados dos componentes de página.
`lib/api-client.ts` centraliza o cliente axios com renovação automática de token em respostas 401.

Navegação administrativa é toda por drill-down de cards, sem menus/submenus dedicados: Dashboard →
card "Configurações" → card "Categorias" → CRUD. Isso é deliberado -- ver o card "Configurações" em
`features/settings/pages/SettingsPage.tsx` para o padrão a seguir ao adicionar novas áreas
administrativas.

---
Voltar para o [índice da documentação](README.md).
