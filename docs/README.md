# Documentação do DriverOps

Documentação organizada por assunto. Para subir o ambiente rapidamente, comece por
[Primeiros passos](getting-started.md).

| Documento | Conteúdo |
|---|---|
| [Primeiros passos](getting-started.md) | Pré-requisitos, início rápido, URLs de acesso, credenciais de dev |
| [Página pública (Landing)](landing.md) | Vitrine institucional pública, seções, dados reais x fallback, SEO, acessibilidade e performance |
| [Pedidos do Site (leads)](pedidos-site.md) | Formulário público de contato, inbox, matching cliente/veículo, divergências, conversão em OS/orçamento, permissões e auditoria |
| [Central de Notificações Interna](notificacoes-internas.md) | Sino/contador, dropdown, central com filtros, avisos automáticos (evento + rotina), deduplicação, permissões, preferências e envio manual |
| [CRM Inteligente (Próximas Ações)](crm.md) | Sugestões de relacionamento (regras + IA), follow-up, campanhas sazonais, tarefas, mensagens revisáveis, permissões e auditoria |
| [Variáveis de ambiente](environment-variables.md) | Tabela completa das variáveis usadas pelo `docker-compose.yml` |
| [Banco de dados e migrations](database.md) | Como e quando as migrations rodam |
| [Superusuário](superuser.md) | Criação/atualização idempotente do superusuário de desenvolvimento |
| [Usuários e Permissões (RBAC)](users-permissions.md) | Perfis, especialidades técnicas, permissões granulares, superuser × Administrador, matriz de permissões, auditoria |
| [Comandos do Makefile](makefile.md) | Todos os alvos do `Makefile` e os comandos Docker equivalentes |
| [Testes e lint](testing.md) | Como rodar e o que cada suíte cobre |
| [Estados de espera (EngineLoader)](loading.md) | Sistema de loading com animação de motor em V, skeletons, overlay e acessibilidade |
| [Build de produção](build.md) | Geração do bundle de produção do frontend |
| [Implantação em produção](production.md) | Stack `docker-compose.prod.yml` (gunicorn, nginx, WhiteNoise, TLS, backups) e checklist de `.env.prod` |
| [CI](ci.md) | Como o workflow do GitHub Actions funciona e por que é rápido |
| [Arquitetura e estrutura do projeto](architecture.md) | Organização de pastas do backend e frontend |
| [Categorias](categories.md) | Categorias de clientes, peças e serviços, soft delete, filtros |
| [Clientes](customers.md) | Fluxo de cadastro, campos, máscaras e integração com CEP (ViaCEP) |
| [Central do Cliente 360°](customer360.md) | Tela consolidada do cliente: cabeçalho, ações rápidas, cards, alertas, abas (veículos, OS, orçamentos, interações, financeiro, linha do tempo), permissões e endpoints |
| [Veículos](vehicles.md) | Cadastro vinculado a clientes, placa (formatos antigo/Mercosul), soft delete |
| [Fornecedores](suppliers.md) | Cadastro de fornecedores, vínculo com peças, soft delete |
| [Peças e Estoque](parts.md) | Cadastro de peças vinculado a categorias, estoque mínimo/baixo, formatação brasileira |
| [Serviços](services.md) | Cadastro de serviços, peças padrão, pacotes de serviços, cálculo de valores, soft delete |
| [Ordens de Serviço](orders.md) | OS com veículo/cliente, itens cadastrados e avulsos, cálculo de valores, status, soft delete |
| [Orçamento da OS](quotes.md) | Orçamento a partir da OS, snapshot/versões, PDF, aprovação física/tablet/link por e-mail, página pública e auditoria |
| [Check-in do Veículo](checkin.md) | Aba de check-in de entrada: mapa de avarias, severidade, fotos, checklist, objetos, conclusão/reabertura, permissões e auditoria |
| [Kanban OS](kanban.md) | Tela própria full width, colunas por status, drag and drop, transições, filtros, modal rápido e configuração de colunas |
| [Financeiro](financial.md) | Pagamentos por OS, status financeiro, contas a receber, despesas, relatórios e resultado (DRE), permissões |
| [Configurações da Oficina/OS](configuracoes.md) | Dados da oficina e configurações da OS (prazo padrão, termos para PDFs), singletons, permissões |
| [Assistente de IA para Textos da OS](ai-assistant.md) | Provedor/modelo, prompt global, instruções e contexto por campo, uso na OS, teste, logs, permissões e segurança |
| [Dashboard (abas)](dashboard.md) | Abas Operacional/OS/Administrativo, swipe no mobile, cards de OS em formato de carro, modal e indicadores |
| [Segurança (escopo v1)](security.md) | Decisões de segurança tomadas nesta primeira versão |
| [Troubleshooting](troubleshooting.md) | Problemas comuns e como resolvê-los |

Volte para o [README principal](../README.md).
