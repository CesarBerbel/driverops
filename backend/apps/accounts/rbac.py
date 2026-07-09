"""Catálogo de RBAC (perfis, módulos, ações e permissões) do DriverOps.

Fonte única da verdade para as permissões granulares (``modulo.acao``), os
perfis iniciais e o mapeamento perfil -> permissões. Consumido pela migração de
seed (``0002_seed_rbac``), pelos serializers e pela verificação de acesso.

O **superuser** (``User.is_superuser``) é um usuário especial com acesso total e
NÃO é um perfil -- ver docs/users-permissions.md. O perfil "Administrador" é um
perfil operacional configurável, sem as permissões críticas por padrão.
"""

# Cada módulo: (chave, rótulo, [(ação, rótulo, é_crítica)])
MODULES = [
    ("dashboard", "Dashboard", [("view", "Visualizar", False)]),
    (
        "kanban",
        "Kanban OS",
        [
            ("view", "Visualizar", False),
            ("move", "Mover cards", False),
            ("configure", "Configurar colunas", True),
        ],
    ),
    (
        "orders",
        "Ordens de Serviço",
        [
            ("view", "Visualizar", False),
            ("create", "Criar", False),
            ("edit", "Editar", False),
            ("cancel", "Cancelar", True),
            ("finish", "Finalizar", True),
            ("delete", "Excluir/desativar", True),
            ("reactivate", "Reativar", False),
        ],
    ),
    (
        "quotes",
        "Orçamentos",
        [
            ("view", "Visualizar", False),
            ("create", "Criar", False),
            ("send", "Enviar por e-mail", False),
            ("approve", "Aprovar", False),
            ("reject", "Recusar", False),
            ("cancel", "Cancelar", True),
            ("pdf", "Gerar PDF", False),
            ("reopen", "Reabrir aprovado", True),
        ],
    ),
    (
        "customers",
        "Clientes",
        [
            ("view", "Visualizar", False),
            ("create", "Criar", False),
            ("edit", "Editar", False),
            ("delete", "Excluir/desativar", False),
            ("reactivate", "Reativar", False),
        ],
    ),
    (
        "vehicles",
        "Veículos",
        [
            ("view", "Visualizar", False),
            ("create", "Criar", False),
            ("edit", "Editar", False),
            ("delete", "Excluir/desativar", False),
            ("reactivate", "Reativar", False),
        ],
    ),
    (
        "services",
        "Serviços",
        [
            ("view", "Visualizar", False),
            ("create", "Criar", False),
            ("edit", "Editar", False),
            ("delete", "Excluir/desativar", False),
            ("reactivate", "Reativar", False),
        ],
    ),
    (
        "packages",
        "Pacotes",
        [
            ("view", "Visualizar", False),
            ("create", "Criar", False),
            ("edit", "Editar", False),
            ("delete", "Excluir/desativar", False),
            ("reactivate", "Reativar", False),
        ],
    ),
    (
        "parts",
        "Peças / Estoque",
        [
            ("view", "Visualizar", False),
            ("create", "Criar peça", False),
            ("edit", "Editar peça", False),
            ("delete", "Excluir/desativar", False),
            ("reactivate", "Reativar", False),
            ("stock_move", "Movimentar estoque", True),
            ("stock_adjust", "Ajustar estoque", True),
            ("view_cost", "Ver custo", True),
        ],
    ),
    (
        "suppliers",
        "Fornecedores",
        [
            ("view", "Visualizar", False),
            ("create", "Criar", False),
            ("edit", "Editar", False),
            ("delete", "Excluir/desativar", False),
            ("reactivate", "Reativar", False),
        ],
    ),
    (
        "financial",
        "Financeiro",
        [
            ("view", "Visualizar", False),
            ("view_margin", "Ver custos e margens", True),
            ("register_payment", "Registrar pagamento", False),
            ("register_expense", "Registrar despesa", False),
            ("reports", "Relatórios financeiros", False),
        ],
    ),
    (
        "reports",
        "Relatórios",
        [("view", "Visualizar", False), ("export", "Exportar", False)],
    ),
    (
        "settings",
        "Configurações",
        [("view", "Visualizar", False), ("edit", "Alterar configurações", True)],
    ),
    (
        "notifications",
        "Templates de Notificação",
        [
            ("view", "Visualizar templates", False),
            ("edit", "Editar/ativar/restaurar templates", True),
            ("test", "Enviar mensagem de teste", True),
        ],
    ),
    (
        "ai",
        "Assistente de IA",
        [
            ("view", "Visualizar configurações de IA", False),
            ("edit", "Editar/restaurar configurações de IA", True),
            ("use", "Usar IA nos textos da OS", False),
            ("logs", "Ver logs de uso da IA", True),
            ("test", "Testar prompt de IA", True),
        ],
    ),
    (
        "leads",
        "Pedidos do Site",
        [
            ("view", "Visualizar pedidos do site", False),
            ("attend", "Atender pedidos (status, notas, contato)", False),
            ("convert", "Converter em cliente/veículo/OS/orçamento", False),
            ("config", "Configurar formulário e notificações", True),
        ],
    ),
    (
        "alerts",
        "Central de Notificações",
        [
            ("view", "Ver a central e os avisos", False),
            ("configure", "Configurar avisos internos", True),
            ("send_manual", "Enviar aviso manual", False),
            ("view_financial", "Ver avisos financeiros", False),
            ("view_admin", "Ver avisos administrativos", False),
        ],
    ),
    (
        "users",
        "Usuários",
        [("view", "Visualizar", False), ("manage", "Gerenciar usuários", True)],
    ),
    ("permissions", "Permissões", [("manage", "Gerenciar permissões", True)]),
    ("audit", "Auditoria", [("view", "Visualizar auditoria", True)]),
]


def all_permission_defs():
    """Gera (codename, module, action, label, is_critical) para cada permissão."""
    for module_key, _module_label, actions in MODULES:
        for action_key, action_label, is_critical in actions:
            yield (
                f"{module_key}.{action_key}",
                module_key,
                action_key,
                action_label,
                is_critical,
            )


def module_labels():
    return {key: label for key, label, _actions in MODULES}


# Todas as permissões não críticas (base do perfil Administrador).
def _non_critical_codes():
    return [c for c, _m, _a, _l, crit in all_permission_defs() if not crit]


def _codes_for_modules(module_keys, actions=None):
    result = []
    for code, module, action, _label, _crit in all_permission_defs():
        if module in module_keys and (actions is None or action in actions):
            result.append(code)
    return result


# Perfis iniciais e suas permissões (o superuser não é um perfil; tem acesso
# total independentemente disto).
ROLE_DEFS = {
    "administrador": {
        "name": "Administrador",
        "description": "Responsável administrativo da oficina. Gerencia usuários "
        "(criar/editar/desativar), mas NÃO edita permissões globais (isso é "
        "exclusivo do superuser) nem executa ações críticas por padrão.",
        # Todas as permissões não críticas + ações operacionais de OS/orçamento +
        # gerenciar usuários. NÃO inclui permissions.manage (edição de permissões),
        # cancelar/finalizar OS, ajustes de estoque, etc.
        "codes": sorted(
            set(_non_critical_codes())
            | {
                "orders.delete",
                "orders.reactivate",
                "quotes.cancel",
                "users.view",
                "users.manage",
                "alerts.configure",
            }
        ),
    },
    "atendente": {
        "name": "Atendente",
        "description": "Recepção: cadastro e acompanhamento inicial do cliente e da OS.",
        "codes": [
            "dashboard.view",
            "customers.view",
            "customers.create",
            "customers.edit",
            "vehicles.view",
            "vehicles.create",
            "vehicles.edit",
            "orders.view",
            "orders.create",
            "orders.edit",
            "quotes.view",
            "quotes.create",
            "quotes.send",
            "kanban.view",
            "ai.use",
            "leads.view",
            "leads.attend",
            "leads.convert",
            "alerts.view",
        ],
    },
    "tecnico": {
        "name": "Técnico",
        "description": "Execução, diagnóstico e acompanhamento técnico da OS.",
        "codes": [
            "dashboard.view",
            "kanban.view",
            "kanban.move",
            "orders.view",
            "orders.edit",
            "quotes.view",
            "customers.view",
            "vehicles.view",
            "ai.use",
            "alerts.view",
        ],
    },
    "estoque": {
        "name": "Estoque",
        "description": "Controle de peças, fornecedores e movimentações de estoque.",
        "codes": _codes_for_modules(["parts"], ["view", "create", "edit", "reactivate"])
        + ["parts.stock_move"]
        + _codes_for_modules(["suppliers"])
        + ["dashboard.view", "orders.view", "alerts.view"],
    },
    "financeiro": {
        "name": "Financeiro",
        "description": "Valores, pagamentos, relatórios e controle financeiro.",
        "codes": [
            "dashboard.view",
            "financial.view",
            "financial.register_payment",
            "financial.register_expense",
            "financial.reports",
            "reports.view",
            "reports.export",
            "orders.view",
            "quotes.view",
            "alerts.view",
            "alerts.view_financial",
        ],
    },
}


# Especialidades técnicas (subtipo do perfil Técnico).
TECHNICAL_SPECIALTIES = [
    ("mechanic", "Mecânico"),
    ("bodyworker", "Funileiro"),
    ("electrician", "Eletricista"),
    ("helper", "Ajudante"),
]
