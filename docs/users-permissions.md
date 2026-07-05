# Usuários, Perfis e Permissões (RBAC)

Sistema de cadastro de usuários com **perfis**, **permissões granulares** (`modulo.acao`) e
controle de acesso por função, validado no **backend e no frontend**.

## Como rodar o projeto, migrations, seeds e testes

```bash
make up                 # sobe db, mailpit, backend e frontend
make migrate            # aplica as migrations (a 0003_seed_rbac cria permissões + perfis)
make seed-admin         # cria/atualiza o superuser de desenvolvimento (script próprio)
make seed-rbac          # (re)cria permissões + perfis a partir do catálogo (idempotente)
make test               # backend (pytest) + frontend (vitest)
make lint               # ruff + black --check + oxlint
make build              # bundle de produção do frontend
```

- As **permissões** e os **perfis** são semeados por **migração de dados**
  (`accounts/0003_seed_rbac`), então existem em qualquer banco após `make migrate`.
- O comando `make seed-rbac` (`python manage.py seed_rbac`) reaplica o catálogo — útil quando novas
  permissões são adicionadas em `apps/accounts/rbac.py`.
- O **superuser** é criado por script próprio (`make seed-admin` →
  `scripts/create-superuser.sh`, via variáveis de ambiente), **independente** do seed de perfis.

## Superuser × Administrador

| | Superuser / Super Admin | Perfil "Administrador" |
|---|---|---|
| O que é | Tipo especial de usuário (`is_superuser=True`) | Perfil operacional configurável |
| Acesso | **Total**, ignora todas as checagens | Amplo na operação, **sem** permissões críticas por padrão |
| Tela de permissões | **Exclusiva** dele | **Não** acessa (a menos que receba `permissions.manage`) |
| Elevar alguém a superuser | — (feito por script) | **Nunca** |
| Como é criado | Script/variáveis de ambiente | Cadastro de usuário com perfil |

O **Administrador não é** apenas um superuser com outro nome: não gerencia permissões globais, não
transforma outro usuário em superuser e não remove permissões do superuser.

## Perfis iniciais

| Perfil | Resumo |
|---|---|
| **Administrador** | Responsável administrativo da oficina. Acesso amplo à operação, sem gerenciar permissões nem ações críticas por padrão. |
| **Atendente** | Recepção: cadastro/consulta de clientes e veículos, abrir/editar OS, gerar/enviar orçamento. |
| **Técnico** | Execução/diagnóstico: Kanban, ver OS, editar diagnóstico. Tem **especialidade técnica**. |
| **Estoque** | Peças, estoque e fornecedores. |
| **Financeiro** | Valores, pagamentos e relatórios. |

### Especialidades técnicas

O perfil **Técnico** pode ter uma **especialidade** (subtipo, não substitui o perfil):
**Mecânico**, **Funileiro**, **Eletricista** ou **Ajudante**. O campo só aparece quando o perfil
selecionado é Técnico.

## Modelo de permissões

Permissões são granulares no formato `modulo.acao` (ex.: `orders.cancel`, `parts.stock_adjust`).
O catálogo (módulos, ações, criticidade e perfis) vive em `backend/apps/accounts/rbac.py`.

- **Módulos:** Dashboard, Kanban OS, Ordens de Serviço, Orçamentos, Clientes, Veículos, Serviços,
  Pacotes, Peças/Estoque, Fornecedores, Financeiro, Relatórios, Configurações, Usuários, Permissões,
  Auditoria.
- **Ações (exemplos):** visualizar, criar, editar, excluir/desativar, reativar, aprovar, recusar,
  cancelar, finalizar, gerar PDF, enviar e-mail, exportar, movimentar/ajustar estoque, ver custo/
  margem, alterar configurações, gerenciar permissões.

### Permissões efetivas

```
efetivas = (permissões do perfil) ∪ (concedidas ao usuário) − (removidas do usuário)
```

O **superuser** sempre tem **todas**. A tela de permissões distingue claramente:

- **Herdada** — vem do perfil.
- **Concedida** — permissão extra dada diretamente ao usuário.
- **Removida** — permissão do perfil bloqueada individualmente para o usuário.

### Permissões críticas

Marcadas com `is_critical` no catálogo e destacadas com ícone na matriz. Como a tela de permissões é
**exclusiva do superuser**, todas as concessões passam por ele. Exemplos: `permissions.manage`,
`audit.view`, `orders.cancel`/`orders.finish`, `quotes.reopen`, `parts.stock_adjust`,
`parts.view_cost`, `financial.view_margin`, `settings.edit`, `kanban.configure`, `users.manage`.

## Cadastro de usuários (`/users`)

Acessível por quem tem `users.manage` (item **Usuários** no menu do usuário).

- **Criar/editar** (nome, e-mail, telefone, WhatsApp, perfil, especialidade quando Técnico, status,
  observações). O **e-mail é o login**, obrigatório e único; o **nome** e o **perfil** são
  obrigatórios; a especialidade só aparece para Técnico.
- **Senha inicial** ou **envio de convite** por e-mail (o usuário define a própria senha via o
  fluxo de redefinição). **Forçar troca de senha** no próximo acesso.
- **Desativar/Reativar** (nunca remove fisicamente; histórico preservado). **Redefinir senha**.
- Filtros: nome/e-mail, perfil, especialidade, status, limpar.

Regras de segurança:

- Usuários criados pela tela **nunca** são superuser.
- Não é possível **desativar o próprio usuário**, o **último superuser** nem o **último
  administrativo**.
- Usuários **desativados não conseguem acessar** o sistema.

## Tela de permissões (`/users/:id/permissions`)

**Exclusiva do superuser** (permissão `permissions.manage`). Organizada em **matriz por módulo**,
com **checkbox por ação**. Marcar concede (ou mantém a herdada); desmarcar remove (bloqueia a
herdada). Botão **Salvar alterações**. Cada mudança é registrada na **auditoria**.

## Controle de acesso (backend + frontend)

- **Backend:** cada endpoint de domínio usa `HasModulePermission` (deriva `modulo.acao` do módulo do
  viewset e da action). As telas de gestão usam `require_permission("...")`. O **superuser** sempre
  passa; sem permissão → **403** (mesmo chamando a API direto). Ver `apps/accounts/permissions.py`.
- **Frontend:** `/users/me/` devolve as permissões efetivas; `useHasPermission`/`usePermissionCheck`
  ocultam/desabilitam ações; `RequirePermission` protege rotas e mostra **"Acesso negado"** para
  autenticados sem permissão. Não autenticados vão para o login.

## Auditoria (`/audit`)

Requer `audit.view`. Registra criação/edição/desativação/reativação de usuários, redefinição/força
de troca de senha e alterações de permissões, com **responsável, usuário afetado, data/hora, valores
anterior/novo, IP e user agent**.

## API

| Método | Rota | Descrição | Acesso |
|---|---|---|---|
| `GET` | `/api/users/me/` | Usuário logado + perfil + permissões efetivas | Autenticado |
| `GET/POST` | `/api/users/` | Listar / criar usuários | `users.manage` |
| `PATCH/DELETE` | `/api/users/{id}/` | Editar / desativar (soft) | `users.manage` |
| `POST` | `/api/users/{id}/reactivate/` | Reativar | `users.manage` |
| `POST` | `/api/users/{id}/reset-password/` | Redefinir senha / convite | `users.manage` |
| `POST` | `/api/users/{id}/force-password-change/` | Forçar troca | `users.manage` |
| `GET` | `/api/roles/` | Perfis + permissões do perfil | Autenticado |
| `GET` | `/api/permissions/catalog/` | Catálogo de permissões por módulo | superuser |
| `GET/PUT` | `/api/users/{id}/permissions/` | Permissões do usuário (matriz) | superuser |
| `GET` | `/api/audit/` | Trilha de auditoria | `audit.view` |

## Arquivos

- Backend: `apps/accounts/rbac.py` (catálogo), `models.py` (Role, Permission, UserPermission,
  AuditLog, User), `permissions.py` (enforcement), `rbac_views.py`/`rbac_serializers.py`,
  `audit.py`, `migrations/0003_seed_rbac.py`, `management/commands/seed_rbac.py`.
- Frontend: `features/users/` (Users, Permissions matrix, Audit), `features/auth/usePermission.ts`,
  `features/auth/RequirePermission.tsx`, `features/auth/pages/AccessDeniedPage.tsx`.

Volte para o [índice da documentação](README.md).
