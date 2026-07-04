# Peças e Estoque

Módulo de cadastro de peças em estoque, obrigatoriamente vinculado a uma Categoria de Peças
(`Category`, `category_type="part"` -- ver [Categorias](categories.md)). Todo cadastro de peça é
feito na área de Estoque; as categorias em si continuam sendo geridas em
Configurações → Categorias de Peças.

## Fluxo

```
Dashboard → card "Estoque"                → Peças em Estoque (lista)
Lista de peças → "Nova peça"              → drawer de cadastro (escolhe a categoria pelo seletor)
Lista de peças → "Editar" (por linha)     → drawer de edição, pré-preenchido
Lista de peças → campo de busca           → filtra por nome, código interno, categoria ou marca (ao vivo, debounced)
Lista de peças → "Limpar pesquisa"        → volta para a listagem completa
Lista de peças → "Excluir" (por linha)    → confirmação → desabilita a peça (soft delete)
Lista de peças → filtro de status         → Peças habilitadas / desabilitadas / Todas
```

Assim como [Clientes](customers.md) e [Veículos](vehicles.md), o cadastro e a edição acontecem em um
drawer lateral (`PartFormSheet.tsx`) -- a URL permanece em `/parts` o tempo todo. Não existe menu
lateral nem submenu dedicado: o único ponto de entrada é o card "Estoque" no Dashboard.

A busca funciona como uma lista filtrada em tempo real (debounce de ~300ms, mesmo padrão de
Clientes/Veículos): a própria tabela de peças é atualizada conforme o usuário digita, sem um
dropdown de sugestões separado.

## Vínculo com a categoria de peça

O campo **Categoria da peça** é obrigatório e usa o mesmo padrão visual/técnico dos demais
seletores do sistema (`Select`). Ele só lista categorias de peças **habilitadas**
(`listCategories("part", "active")`) -- categorias desabilitadas nunca aparecem como opção para
novos cadastros ou reatribuições, mas o vínculo de uma peça já existente com uma categoria
posteriormente desabilitada é preservado (ver [Categorias → Consumidores futuros](categories.md#consumidores-futuros-peças-e-serviços),
a promessa que este módulo cumpre).

### Adicionar categoria inline

Ao lado do seletor de categoria existe um link discreto "Adicionar categoria". Clicar nele abre um
modal de cadastro de categoria de peça (`CategoryQuickCreateDialog.tsx`) **sobre** o drawer de
cadastro de peça, sem fechá-lo e sem perder nenhum dado já preenchido no formulário da peça:

1. O modal de categoria reaproveita o mesmo componente de formulário usado pelo CRUD de Categorias
   em Configurações (`CategoryForm.tsx`, extraído de `CategoryManager.tsx` para ser compartilhado) --
   mesma validação, mesmas mensagens de erro, mesma regra de duplicidade de nome ativo.
2. Apenas o campo **Nome** é obrigatório no cadastro inline (Descrição e Observações são opcionais,
   igual ao cadastro padrão de categorias).
3. Ao salvar com sucesso, a categoria é criada com `category_type="part"` (nunca como categoria de
   cliente ou de serviço) -- ela passa a existir também no CRUD de Categorias de Peças em
   Configurações, não é uma entidade paralela.
4. O modal de categoria fecha automaticamente e o usuário volta para o drawer de cadastro da peça,
   com a categoria recém-criada **já selecionada automaticamente** no seletor.
5. Se o usuário cancelar o cadastro da categoria (ou fechar o modal), volta para o drawer de peça
   mantendo tudo o que já havia preenchido.
6. Se houver erro ao salvar a categoria (por exemplo, nome duplicado), o erro aparece dentro do
   próprio modal de categoria -- o drawer de peça permanece aberto e intacto por trás.

Tecnicamente, o modal de peça e o modal de categoria são dois componentes Radix Dialog/Sheet
independentes que compartilham a mesma base (`@radix-ui/react-dialog`); o de categoria é aberto por
cima do drawer sem interferir no seu estado.

## Campos do cadastro

Somente **Nome da peça**, **Categoria da peça**, **Unidade de medida** e **Quantidade atual** são
obrigatórios. A quantidade atual pode começar em zero.

| Campo | Obrigatório? | Observação |
|---|---|---|
| Nome da peça | **Sim** | Sem espaços nas extremidades; não pode ficar vazio |
| Categoria da peça | **Sim** | Selecionada entre as categorias de peças habilitadas |
| Unidade de medida | **Sim** | Valor enumerado, padrão "Unidade" |
| Quantidade atual | **Sim** | Número (padrão brasileiro), aceita zero, não aceita negativo |
| Código interno | Não | Texto livre, normalizado em maiúsculas |
| Marca | Não | Texto livre |
| Modelo/aplicação | Não | Texto livre |
| Estoque mínimo | Não | Número (padrão brasileiro), não aceita negativo quando informado |
| Preço de custo | Não | Moeda (Real brasileiro), não aceita negativo quando informado |
| Preço de venda | Não | Moeda (Real brasileiro), não aceita negativo quando informado |
| Localização no estoque | Não | Texto livre |
| Fornecedor | Não | Texto livre por enquanto -- ver [Fornecedor](#fornecedor) |
| NCM | Não | 8 dígitos, exibido como `8708.99.90` |
| Código de barras | Não | Apenas números |
| Observações | Não | Texto livre |

Nenhum desses campos opcionais bloqueia o cadastro quando deixado em branco.

### Unidade de medida

Campo de valores controlados (não aceita texto livre), com "Unidade" como padrão: Unidade, Par,
Kit, Litro, Mililitro, Metro, Centímetro, Caixa, Pacote, Jogo, Outro.

### Fornecedor

Por enquanto é um campo de texto livre -- não existe um módulo de Fornecedores ainda. O campo está
propositalmente pronto para ser trocado por um vínculo (FK) com uma futura entidade de Fornecedor,
sem precisar de mudança na experiência de cadastro.

## Padrão brasileiro

Todo o módulo segue o padrão brasileiro em português:

- **Moeda**: Real brasileiro, exibida como `R$ 0,00` (vírgula decimal, ponto de milhar) --
  `frontend/src/lib/masks.ts`, `formatCurrencyBRL`/`parseCurrencyBRL`. O campo aceita colar valores
  com ou sem `R$`, com vírgula ou ponto decimal (`R$ 120,50`, `120.50`, `120,50` são todos aceitos e
  normalizados corretamente).
- **Quantidade**: mesmo padrão de agrupamento de milhar, com vírgula decimal quando há casas
  fracionárias (`1.000`, `1.000,50`) -- `formatQuantityBRL`/`parseQuantityBRL`.
- **NCM**: normalizado para apenas dígitos (8 caracteres) internamente, exibido agrupado como
  `XXXX.XX.XX` (`normalizeNCM`/`formatNCM`), mesmo estilo progressivo de máscara já usado em
  CEP/telefone.
- **Código de barras**: apenas dígitos.
- **Campos de texto**: espaços nas extremidades sempre removidos antes de salvar; o código interno,
  além de removido de espaços, é normalizado em maiúsculas (padrão adotado neste projeto, mesma
  ideia de chassi/placa em Veículos).

O preço de custo/venda usa um campo de moeda com máscara de "deslocamento de centavos"
(`components/shared/CurrencyInput.tsx`, digitar `12050` já forma `R$ 120,50`) -- a técnica padrão
para evitar problemas de arredondamento/parsing de valores monetários. A quantidade usa um campo
mais simples que aceita dígitos e uma vírgula decimal, já que "10" deve significar 10 unidades, não
0,10.

## Como os dados são salvos

O backend (`backend/apps/parts/models.py`) usa `DecimalField` para quantidade e preços -- nunca
`float` -- evitando problemas de arredondamento de ponto flutuante em valores monetários. O
serializer (`backend/apps/parts/serializers.py`) normaliza antes de salvar:
- **Nome, Marca, Modelo/aplicação, Localização, Fornecedor**: espaços nas extremidades removidos.
- **Código interno**: espaços removidos e convertido para maiúsculas.
- **NCM**: apenas dígitos; se preenchido, precisa ter exatamente 8 dígitos.
- **Código de barras**: apenas dígitos.
- **Quantidade atual, Estoque mínimo, Preço de custo, Preço de venda**: rejeitados com erro claro se
  negativos.

## Estoque mínimo e estoque baixo

Quando **Estoque mínimo** está preenchido e a **Quantidade atual** é menor ou igual a ele, a peça é
marcada como `is_low_stock` (calculado no backend, `Part.is_low_stock`, exposto como campo
somente-leitura na API) e a listagem mostra um indicativo discreto "Estoque baixo" ao lado da
quantidade (`components/ui/badge.tsx`, variante `muted`, cores sutis reaproveitando o token
`--destructive` já existente -- nenhum token de cor novo foi criado só para isso). Quando o estoque
mínimo não está definido, nenhuma comparação é feita e a peça nunca é marcada como baixa --
evitando ruído visual para peças sem um limite configurado.

A arquitetura está preparada para evoluir: um futuro modelo de movimentações de estoque
(`PartMovement`, com FK para `Part`) poderia registrar entradas/saídas/ajustes sem alterar o
cadastro atual -- por ora, sem esse histórico formal, a quantidade é editada diretamente no
cadastro da peça.

## Exclusão (soft delete)

Segue exatamente o mesmo padrão de [Categorias](categories.md) e [Veículos](vehicles.md): o campo
`is_active` nunca é exposto na API nem na interface como um campo de "status" -- ele só controla se
a peça aparece na listagem padrão e se pode ser reativada.

- **Excluir** (`DELETE /api/parts/{id}/`) desabilita a peça (`is_active = False`) e retorna
  `204 No Content`. O registro continua no banco, preservando o histórico de qualquer uso futuro em
  orçamentos/ordens de serviço.
- A listagem por padrão mostra só peças habilitadas (`?status=active`, o padrão); o filtro também
  aceita `inactive` e `all`, com a mesma linguagem amigável de Categorias: "Peças habilitadas" /
  "Peças desabilitadas" / "Todas".
- Uma peça desabilitada pode ser reativada (`POST /api/parts/{id}/reactivate/`) -- não há checagem
  de conflito de nome, já que peças não têm restrição de unicidade de nome.

## API

- `GET /api/parts/?search=&category=&status=active|inactive|all` -- lista, com busca por
  nome/código interno/marca/nome da categoria, filtro por categoria e por status.
- `POST /api/parts/` -- cria; `category` é obrigatório.
- `PATCH /api/parts/{id}/` -- edita; `category` pode ser alterado, mas só para outra categoria de
  peça **habilitada** -- manter a categoria atual (mesmo que ela tenha sido desabilitada depois) é
  sempre permitido.
- `DELETE /api/parts/{id}/` -- soft delete, `204 No Content`.
- `POST /api/parts/{id}/reactivate/` -- reativa.

## Autenticação

A rota de peças (`/parts` no frontend; `/api/parts/...` no backend) exige usuário autenticado,
seguindo o mesmo [`ProtectedRoute`](../frontend/src/features/auth/ProtectedRoute.tsx) e a mesma
permissão padrão (`IsAuthenticated`) usados pelo restante do sistema.

## Comandos relacionados

Nenhum comando novo foi criado para este módulo -- ele usa a infraestrutura já documentada:
- Subir o ambiente e rodar migrations: [Primeiros passos](getting-started.md),
  [Banco de dados e migrations](database.md).
- Rodar os testes (`apps/parts/tests/` no backend, `PartsPage.test.tsx`, `PartFormSheet.test.tsx` e
  as adições de `masks.test.ts` no frontend): [Testes e lint](testing.md).

---
Voltar para o [índice da documentação](README.md).
