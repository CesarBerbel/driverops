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
│       └── core/               # health check e concerns compartilhados
└── frontend/                 # React + Vite + TS + Tailwind + shadcn/ui
    └── src/
        ├── features/
        │   ├── auth/           # contexto de autenticação, guardas de rota, páginas
        │   ├── dashboard/      # página do dashboard
        │   ├── profile/        # página de perfil
        │   └── landing/        # página pública
        ├── components/
        │   ├── layout/         # AppShell, Sidebar, Topbar, UserMenu
        │   ├── ui/              # primitivos shadcn/ui
        │   └── shared/          # PasswordInput e outros componentes reutilizáveis
        ├── lib/                 # cliente axios com refresh automático, utils
        └── routes/               # definição de rotas
```

## Backend

Dois apps Django: `accounts` (User customizado, autenticação JWT via cookies httpOnly, perfil,
troca/recuperação de senha, permissão de superusuário, comando `seed_admin`) e `core` (health check
e concerns compartilhados futuros). Ver também [Segurança](security.md) para as decisões por trás
do esquema de autenticação.

## Frontend

Organizado por feature (`auth`, `dashboard`, `profile`, `landing`), com componentes de layout
(`AppShell`/`Sidebar`/`Topbar`/`UserMenu`) e primitivos de UI (`components/ui`, estilo shadcn/ui)
separados dos componentes de página. `lib/api-client.ts` centraliza o cliente axios com renovação
automática de token em respostas 401.

---
Voltar para o [índice da documentação](README.md).
