# Categorias

Um único cadastro genérico de categorias (`Category`, `backend/apps/categories/`) serve três áreas
diferentes do sistema, distinguidas por um campo `category_type`: **Categorias de Clientes**,
**Categorias de Peças** e **Categorias de Serviços**. As três compartilham o mesmo modelo, a mesma
API, o mesmo componente de tela e o mesmo padrão de soft delete -- apenas o tipo muda.

## Fluxo

```
Dashboard → card "Configurações" → Configurações
Configurações → card "Categorias de Clientes"  → /settings/categories
Configurações → card "Categorias de Peças"     → /settings/categories/parts
Configurações → card "Categorias de Serviços"  → /settings/categories/services
```

Não existe menu lateral nem submenu dedicado -- o acesso é sempre por drill-down de cards, a partir
do Dashboard e depois de Configurações, seguindo o mesmo padrão usado por
[Clientes](customers.md) e [Veículos](vehicles.md).

Cada uma das três telas é a mesma tela (`CategoryManager.tsx`,
`frontend/src/features/categories/components/CategoryManager.tsx`) renderizada por um componente de
página fino que só passa o tipo, o título e a descrição
(`frontend/src/features/categories/pages/{Client,Part,Service}CategoriesPage.tsx`) -- criar/editar
acontece em um `Dialog` centralizado (mesmo padrão desde a primeira versão de Categorias), sem
navegar para uma página separada.

## Diferença entre os três tipos

- **Categorias de Clientes** -- organizam os clientes cadastrados no sistema.
- **Categorias de Peças** -- organizarão peças e insumos quando o módulo de Peças for construído
  (exemplos: Motor, Suspensão, Freios, Elétrica, Filtros, Lubrificantes, Pneus, Acessórios, Lataria,
  Arrefecimento -- exemplos de uso, não dados pré-cadastrados/seed).
- **Categorias de Serviços** -- organizarão os serviços da oficina quando o módulo de Serviços for
  construído (exemplos: Revisão, Diagnóstico, Freios, Suspensão, Motor, Elétrica, Troca de Óleo,
  Ar-condicionado, Alinhamento, Balanceamento -- também apenas exemplos).

Os três tipos são independentes entre si: o mesmo nome pode existir em mais de um tipo (por exemplo,
"Freios" faz sentido tanto como categoria de peça quanto de serviço) sem conflito, porque a
unicidade do nome é escopada por tipo -- ver [Unicidade do nome](#unicidade-do-nome).

## Campos do cadastro

Somente **Nome** é obrigatório.

| Campo | Obrigatório? | Observação |
|---|---|---|
| Nome | **Sim** | Sem espaços nas extremidades; não pode ficar vazio nem ser só espaços |
| Descrição | Não | Texto livre, até 255 caracteres |
| Observações | Não | Texto livre, sem limite de tamanho |

`category_type` não é um campo do formulário -- ele é implícito pela tela em que o usuário está (a
tela de Categorias de Peças sempre cria/edita categorias `part`, por exemplo) e nunca aparece como
uma opção selecionável na interface.

## Unicidade do nome

O nome só precisa ser único **dentro do mesmo tipo**, entre categorias **ativas**
(`Category.has_active_conflict(category_type, name)`, comparação sem diferenciar maiúsculas de
minúsculas). Isso significa:
- "Freios" pode existir como categoria de peça e, separadamente, como categoria de serviço.
- Dentro do mesmo tipo, "Freios" e "FREIOS" conflitam (o backend rejeita com 400).
- Depois que uma categoria é excluída (soft delete), seu nome pode ser reutilizado em um novo
  cadastro do mesmo tipo -- o histórico da categoria antiga é preservado, apenas desabilitada.

## Como os dados são salvos

O backend (`backend/apps/categories/serializers.py`, `validate_name`) remove espaços nas
extremidades do nome antes de salvar e rejeita um nome vazio ou só com espaços -- essa validação é a
fonte da verdade; o frontend (`frontend/src/features/categories/schemas.ts`) replica a mesma regra
(`z.string().trim().min(1, ...)`) como conveniência de UX, para dar feedback imediato sem round-trip.

## Status ativo/inativo é interno

A flag técnica `is_active` existe apenas no banco de dados e na lógica do backend -- ela **nunca**
aparece como um campo "Status"/"Ativo"/"Habilitado" no formulário de criação/edição, nem como uma
coluna na tabela de listagem, nem em nenhum outro lugar da interface. O único lugar onde o conceito
aparece é o seletor de filtro, e sempre com linguagem amigável:

- **Categorias habilitadas** (padrão da listagem)
- **Categorias desabilitadas**
- **Todas**

## Exclusão (soft delete)

O botão "Excluir" nunca remove uma categoria do banco de dados. Ele apenas desabilita
(`is_active = False`) via `DELETE /api/categories/{id}/`, que retorna `204 No Content` e mantém o
registro intacto -- preservando o histórico de qualquer peça/serviço/cliente que já tenha usado essa
categoria no passado.

- A listagem por padrão mostra só categorias habilitadas (`?status=active`, o padrão); o filtro
  também aceita `inactive` e `all`.
- Uma categoria desabilitada pode ser reativada (`POST /api/categories/{id}/reactivate/`), exceto se
  o nome colidir com o de outra categoria **do mesmo tipo** atualmente habilitada -- nesse caso a
  reativação é bloqueada com 400.
- Categorias desabilitadas nunca aparecem como opção em novos cadastros -- ver
  [Consumidores futuros](#consumidores-futuros-peças-e-serviços).

## Consumidores futuros (Peças e Serviços)

Os módulos de Peças e Serviços ainda não existem, mas o cadastro de categorias já está pronto para
ser consumido por eles: um futuro seletor de categoria no formulário de peça (ou de serviço) deve
buscar `GET /api/categories/?category_type=part&status=active` (ou `service`) -- nunca deve mostrar
categorias desabilitadas como opção selecionável, mesmo que o registro sendo editado já esteja
vinculado a uma categoria que foi desabilitada depois (nesse caso, o vínculo antigo continua visível
no registro, só não deve aparecer como opção para *novos* vínculos).

## API

- `GET /api/categories/?category_type=client|part|service&status=active|inactive|all` -- lista,
  filtrada por tipo (obrigatório na prática, já que cada tela só usa um tipo) e por status.
- `POST /api/categories/` -- cria; `category_type` é obrigatório no payload.
- `PATCH /api/categories/{id}/` -- edita `name`/`description`/`notes`; `category_type` **não pode
  ser alterado** depois de criado (o backend rejeita com 400 se o payload tentar mudá-lo -- proteção
  defensiva, já que a tela nunca envia esse campo na edição).
- `DELETE /api/categories/{id}/` -- soft delete, `204 No Content`.
- `POST /api/categories/{id}/reactivate/` -- reativa, bloqueado por conflito de nome no mesmo tipo.

## Autenticação

As três telas (`/settings/categories`, `/settings/categories/parts`, `/settings/categories/services`
no frontend; `/api/categories/...` no backend) exigem usuário autenticado, seguindo o mesmo
[`ProtectedRoute`](../frontend/src/features/auth/ProtectedRoute.tsx) e a mesma permissão padrão
(`IsAuthenticated`) usados pelo restante do sistema.

## Comandos relacionados

Nenhum comando novo foi criado para este módulo -- ele usa a infraestrutura já documentada:
- Subir o ambiente e rodar migrations: [Primeiros passos](getting-started.md),
  [Banco de dados e migrations](database.md).
- Rodar os testes (`apps/categories/tests/` no backend, `ClientCategoriesPage.test.tsx`,
  `PartCategoriesPage.test.tsx` e `ServiceCategoriesPage.test.tsx` no frontend):
  [Testes e lint](testing.md).

---
Voltar para o [índice da documentação](README.md).
