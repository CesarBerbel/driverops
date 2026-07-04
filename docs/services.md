# Serviços e Pacotes de Serviços

Módulo do catálogo de serviços: cadastro de serviços (com valor de mão de obra, categoria e peças
padrão vinculadas) e agrupamento em **pacotes de serviços** com cálculo automático de total,
desconto e valor final. Reutiliza as categorias de serviço (`Category`, `category_type="service"` --
ver [Categorias](categories.md)) e as peças do estoque ([Peças e Estoque](parts.md)).

Este é o primeiro módulo com **relacionamentos com dados extras** (peça padrão com quantidade
sugerida) e **escrita aninhada** na API -- os demais módulos usam apenas FKs simples.

## Fluxo

```
Dashboard → card "Serviços"                   → Lista de serviços
Lista de serviços → "Novo serviço"            → drawer de cadastro
Lista de serviços → "Editar" (por linha)      → drawer de edição, pré-preenchido
Lista de serviços → campo de busca            → filtra por nome ou categoria (ao vivo, debounced)
Lista de serviços → filtro por categoria      → filtra por categoria de serviço
Lista de serviços → "Excluir" (por linha)     → confirmação → desabilita o serviço (soft delete)
Lista de serviços → controle "Pacotes"        → Lista de pacotes de serviços
Lista de pacotes → "Novo pacote"              → drawer de cadastro (agrupa serviços)
```

O cadastro e a edição acontecem em um drawer lateral (`ServiceFormSheet.tsx` /
`PackageFormSheet.tsx`) -- a URL permanece em `/services` ou `/services/packages`. Não existe menu
lateral: o único ponto de entrada é o card "Serviços" no Dashboard. As duas áreas (Serviços e
Pacotes) são alternadas por um controle segmentado (`ServicesNav`) no topo de ambas as telas, sem
usar abas -- cada lista tem sua própria rota.

## Campos do cadastro de serviço

Somente **Nome do serviço**, **Categoria do serviço** e **Valor de mão de obra** são obrigatórios --
a mão de obra pode começar em `R$ 0,00`.

| Campo | Obrigatório? | Observação |
|---|---|---|
| Nome do serviço | **Sim** | Sem espaços nas extremidades; não pode ficar vazio |
| Categoria do serviço | **Sim** | Selecionada entre as categorias de serviço habilitadas |
| Valor de mão de obra | **Sim** | Moeda (Real), aceita `R$ 0,00`, não aceita negativo |
| Tempo estimado | Não | Em minutos (inteiro), opcional |
| Descrição | Não | Texto livre |
| Peças padrão | Não | Vínculo com peças do estoque + quantidade sugerida |
| Observações internas | Não | Texto livre |

## Valor do serviço

O **valor** de um serviço é calculado dinamicamente pelo backend (nunca persistido) e exposto como
campo somente-leitura na API:

```
valor = mão de obra + Σ (quantidade sugerida × preço de venda da peça)
```

Peça padrão sem preço de venda cadastrado conta como `R$ 0,00`. Como o cálculo é dinâmico, alterar o
preço de venda de uma peça ou a mão de obra do serviço reflete automaticamente no valor.

## Categoria do serviço

O campo **Categoria do serviço** lista apenas categorias de serviço **habilitadas**
(`listCategories("service", "active")`). Categorias desabilitadas nunca aparecem para novos
cadastros, mas o vínculo de um serviço já existente com uma categoria posteriormente desabilitada é
preservado (mesma regra "só a *nova* atribuição precisa estar habilitada" usada em Peças).

### Adicionar categoria inline

Ao lado do seletor existe um link "Adicionar categoria" que abre um modal de cadastro de categoria
de serviço (`CategoryQuickCreateDialog categoryType="service"`) **sobre** o drawer do serviço, sem
perder nenhum dado já preenchido. Ao salvar, o modal fecha e a categoria recém-criada já vem
selecionada. A categoria é criada com `category_type="service"` (nunca como categoria de cliente ou
de peça) e passa a existir também no CRUD de Categorias de Serviços em Configurações. Se o cadastro
da categoria falhar, o erro aparece dentro do próprio modal e o drawer do serviço permanece intacto.

## Peças padrão

Na seção **Peças padrão** o usuário vincula peças já cadastradas no estoque, cada uma com uma
**quantidade sugerida**:

- As peças são selecionadas por autocomplete (`PartCombobox`) a partir do cadastro de peças -- o
  campo **nunca aceita texto livre** sem um vínculo real; cada peça padrão salva o **ID** da peça.
- A quantidade sugerida aceita apenas números (padrão brasileiro) e não pode ser negativa.
- É possível adicionar várias peças, editar a quantidade de uma peça já vinculada e remover peças
  antes de salvar.
- Uma peça já vinculada não reaparece no autocomplete (não é possível vinculá-la duas vezes).
- Só peças **habilitadas** aparecem para novos vínculos; se um serviço antigo estiver vinculado a
  uma peça posteriormente desabilitada, o vínculo histórico é preservado (a peça continua listada e
  re-salvar o serviço não quebra).

### Adicionar peça inline

Ao lado do autocomplete existe um link "Adicionar peça" que abre o modal de cadastro de peça
(`PartQuickCreateDialog`, o mesmo formulário do Estoque) **sobre** o drawer do serviço, sem perder
os dados já preenchidos. Ao salvar, o modal fecha, o usuário volta ao serviço e a peça recém-criada
já entra automaticamente na lista de peças padrão (com quantidade `1`). Cancelar ou um erro no
cadastro da peça mantém o drawer do serviço intacto por trás.

## Pacotes de serviços

Um pacote agrupa vários serviços cadastrados para facilitar venda, orçamento e atendimento futuro.

| Campo | Obrigatório? | Observação |
|---|---|---|
| Nome do pacote | **Sim** | Sem espaços nas extremidades |
| Serviços vinculados | **Sim** | Ao menos um serviço |
| Descrição | Não | Texto livre |
| Tipo de desconto | Não | Nenhum / Percentual / Valor fixo |
| Desconto | Não | Percentual (0–100%) ou valor em R$ |
| Observações internas | Não | Texto livre |

Regras dos serviços dentro do pacote:

- Os serviços são selecionados por autocomplete (`ServiceCombobox`) a partir do cadastro de
  serviços -- o campo **nunca aceita texto livre**; cada item salva o **ID** do serviço.
- É possível adicionar vários serviços, ver o valor individual de cada um e remover serviços antes
  de salvar; um serviço já adicionado não reaparece no autocomplete.
- Só serviços **habilitados** aparecem para novos pacotes; se um pacote antigo estiver vinculado a
  um serviço posteriormente desabilitado, o vínculo histórico é preservado.

### Regras de cálculo

Todos os valores do pacote são calculados dinamicamente pelo backend (nunca persistidos) e também
recalculados ao vivo no formulário conforme o usuário adiciona serviços ou muda o desconto:

```
valor total = Σ (valor de cada serviço vinculado)
desconto    = percentual → total × (percentual / 100)
              valor fixo  → o valor informado
valor final = valor total − desconto     (nunca menor que R$ 0,00)
```

## Padrão brasileiro

Todo o módulo segue o padrão brasileiro em português: moeda em Real (`R$ 0,00`, vírgula decimal,
ponto de milhar), quantidades no formato numérico brasileiro, e todos os textos, labels e mensagens
em pt-BR.

## Máscaras, validações e normalização

| Campo | Máscara / formato | Exemplo |
|---|---|---|
| Valor de mão de obra | Moeda (Real), deslocamento de centavos | `R$ 120,50` |
| Desconto percentual | Número, 0 a 100 | `10` |
| Desconto em valor | Moeda (Real) | `R$ 50,00` |
| Quantidade sugerida | Número (padrão brasileiro) | `1.000,50` |
| Tempo estimado | Número inteiro (minutos) | `90` |

O frontend aplica as máscaras (`frontend/src/lib/masks.ts`,
`components/shared/CurrencyInput.tsx`) para facilitar a digitação; o backend
(`backend/apps/services/serializers.py`) **revalida e normaliza** independentemente -- textos têm
espaços das extremidades removidos, valores negativos são rejeitados, o desconto percentual é
validado entre 0 e 100, e o pacote exige ao menos um serviço. Valores monetários e quantidades são
persistidos em `DecimalField` (nunca `float`); o tempo estimado é um inteiro de minutos.

## Como os dados são salvos

- **Serviço**: `labor_cost` e `suggested_quantity` das peças padrão em `DecimalField`;
  `estimated_minutes` inteiro (ou nulo). As peças padrão são linhas de uma tabela de ligação
  (`ServicePart`) que guarda `service`, `part` e `suggested_quantity`.
- **Pacote**: `discount_type`/`discount_value` persistidos; total e final calculados. Os serviços do
  pacote são linhas de ligação (`PackageService`) guardando `package` e `service`.
- A escrita aninhada usa estratégia **replace-all**: ao atualizar, as linhas de ligação existentes
  são substituídas pelas do payload; a validação garante que uma peça/serviço já vinculado e depois
  desabilitado possa ser re-salvo (preservação histórica), mas bloqueia novos vínculos com itens
  desabilitados.

## Exclusão (soft delete)

Segue o mesmo padrão de [Categorias](categories.md), [Veículos](vehicles.md), [Peças](parts.md) e
[Fornecedores](suppliers.md): o campo `is_active` nunca é exposto na API nem na interface como um
campo de "status".

- **Excluir** (`DELETE /api/services/{id}/` ou `/api/service-packages/{id}/`) desabilita o registro
  (`is_active = False`) e retorna `204 No Content`. Nada é apagado fisicamente -- serviços e pacotes
  usados futuramente em orçamentos/OS permanecem preservados.
- A listagem por padrão mostra só habilitados (`?status=active`); o filtro também aceita `inactive`
  e `all`, com a mesma linguagem amigável ("Serviços/Pacotes habilitados/desabilitados/Todos").
- Um registro desabilitado pode ser reativado (`POST .../{id}/reactivate/`).

## API

- `GET /api/services/?search=&status=active|inactive|all&category=` -- lista, com busca por
  nome/categoria e filtro por status e categoria.
- `POST /api/services/` -- cria; aceita `standard_parts` aninhado (`[{part, suggested_quantity}]`).
- `PATCH /api/services/{id}/` -- edita; re-enviar `standard_parts` substitui as peças padrão.
- `DELETE /api/services/{id}/` -- soft delete; `POST /api/services/{id}/reactivate/` -- reativa.
- `GET /api/service-packages/?search=&status=` -- lista pacotes.
- `POST /api/service-packages/` -- cria; aceita `items` aninhado (`[{service}]`), mínimo 1.
- `PATCH /api/service-packages/{id}/` -- edita; `DELETE`/`reactivate` -- soft delete/reativa.

## Autenticação

As rotas (`/services`, `/services/packages` no frontend; `/api/services/...`,
`/api/service-packages/...` no backend) exigem usuário autenticado, seguindo o mesmo
[`ProtectedRoute`](../frontend/src/features/auth/ProtectedRoute.tsx) e a permissão padrão
(`IsAuthenticated`) do restante do sistema.

## Comandos relacionados

Nenhum comando novo foi criado -- o módulo usa a infraestrutura já documentada:
- Subir o ambiente e rodar migrations: [Primeiros passos](getting-started.md),
  [Banco de dados e migrations](database.md).
- Rodar os testes (`apps/services/tests/` no backend; `ServicesPage.test.tsx`,
  `ServicePackagesPage.test.tsx`, `ServiceFormSheet.test.tsx`, `PackageFormSheet.test.tsx` no
  frontend): [Testes e lint](testing.md).

---
Voltar para o [índice da documentação](README.md).
