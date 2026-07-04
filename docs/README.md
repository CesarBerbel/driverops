# Documentação do DriverOps

Documentação organizada por assunto. Para subir o ambiente rapidamente, comece por
[Primeiros passos](getting-started.md).

| Documento | Conteúdo |
|---|---|
| [Primeiros passos](getting-started.md) | Pré-requisitos, início rápido, URLs de acesso, credenciais de dev |
| [Variáveis de ambiente](environment-variables.md) | Tabela completa das variáveis usadas pelo `docker-compose.yml` |
| [Banco de dados e migrations](database.md) | Como e quando as migrations rodam |
| [Superusuário](superuser.md) | Criação/atualização idempotente do superusuário de desenvolvimento |
| [Comandos do Makefile](makefile.md) | Todos os alvos do `Makefile` e os comandos Docker equivalentes |
| [Testes e lint](testing.md) | Como rodar e o que cada suíte cobre |
| [Build de produção](build.md) | Geração do bundle de produção do frontend |
| [CI](ci.md) | Como o workflow do GitHub Actions funciona e por que é rápido |
| [Arquitetura e estrutura do projeto](architecture.md) | Organização de pastas do backend e frontend |
| [Categorias](categories.md) | Categorias de clientes, peças e serviços, soft delete, filtros |
| [Clientes](customers.md) | Fluxo de cadastro, campos, máscaras e integração com CEP (ViaCEP) |
| [Veículos](vehicles.md) | Cadastro vinculado a clientes, placa (formatos antigo/Mercosul), soft delete |
| [Fornecedores](suppliers.md) | Cadastro de fornecedores, vínculo com peças, soft delete |
| [Peças e Estoque](parts.md) | Cadastro de peças vinculado a categorias, estoque mínimo/baixo, formatação brasileira |
| [Segurança (escopo v1)](security.md) | Decisões de segurança tomadas nesta primeira versão |
| [Troubleshooting](troubleshooting.md) | Problemas comuns e como resolvê-los |

Volte para o [README principal](../README.md).
