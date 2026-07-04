# Fornecedores

Módulo de cadastro de fornecedores, com o mesmo padrão de campos/máscaras/CEP já usado em
[Clientes](customers.md), soft delete (que Clientes deliberadamente não tem, mas
[Categorias](categories.md), [Veículos](vehicles.md) e [Peças e Estoque](parts.md) têm), e o campo
**Fornecedor** de [Peças e Estoque](parts.md) agora vinculado a esta entidade em vez de texto livre.

## Fluxo

```
Dashboard → card "Fornecedores"              → Lista de fornecedores
Lista de fornecedores → "Novo fornecedor"    → drawer de cadastro
Lista de fornecedores → "Editar" (por linha) → drawer de edição, pré-preenchido
Lista de fornecedores → campo de busca       → filtra por nome, nome fantasia ou documento (ao vivo, debounced)
Lista de fornecedores → "Limpar pesquisa"    → volta para a listagem completa
Lista de fornecedores → "Excluir" (por linha) → confirmação → desabilita o fornecedor (soft delete)
Lista de fornecedores → filtro de status     → Fornecedores habilitados / desabilitados / Todos
```

Assim como Clientes, o cadastro e a edição acontecem em um drawer lateral
(`SupplierFormSheet.tsx`) -- a URL permanece em `/suppliers` o tempo todo. Não existe menu lateral
nem submenu dedicado: o único ponto de entrada é o card "Fornecedores" no Dashboard.

O formulário em si (`features/suppliers/components/SupplierForm.tsx`) é exportado como um
componente reutilizável independente do drawer -- o mesmo padrão de extração já usado em
`CategoryForm.tsx` -- porque ele é consumido em dois lugares: o drawer de CRUD completo
(`SupplierFormSheet.tsx`) e o modal de criação rápida usado a partir do cadastro de peças (ver
[Adicionar fornecedor inline](parts.md#adicionar-fornecedor-inline)).

## Campos do cadastro

Somente **Nome/Razão social** exige preenchimento manual. **Tipo de fornecedor** também é
obrigatório, mas já vem preenchido com "Pessoa Jurídica" por padrão -- o oposto do padrão de
Clientes ("Pessoa Física"), já que a maioria dos fornecedores de peças é pessoa jurídica; o usuário
só precisa alterar o tipo para cadastrar um fornecedor autônomo (pessoa física). Todos os demais
campos são opcionais nesta fase; nenhum deles bloqueia o cadastro.

| Campo | Obrigatório? | Observação |
|---|---|---|
| Nome/Razão social | **Sim** | Único campo de preenchimento manual obrigatório |
| Tipo de fornecedor | Sim, mas com padrão | Padrão "Pessoa Jurídica"; suporta "Pessoa Física" |
| Nome fantasia | Não | Texto livre |
| Documento (CPF/CNPJ) | Não | Máscara e validação dependem do tipo de fornecedor |
| Inscrição estadual | Não | Texto livre |
| Nome do contato | Não | Texto livre |
| E-mail | Não | Validado como e-mail quando preenchido |
| Telefone | Não | Aceita fixo (10 dígitos) ou móvel (11 dígitos) |
| WhatsApp | Não | Mesmo formato do telefone; exibido como link clicável no formulário (ver [Clientes → WhatsApp](customers.md#whatsapp)) |
| CEP | Não | Consulta o ViaCEP automaticamente quando completo |
| Rua, Número, Complemento, Bairro, Cidade, Estado, País | Não | Preenchidos manualmente ou via CEP |
| Observações | Não | Texto livre |

## Tipo de fornecedor

Mesma regra de Clientes: o documento troca de máscara automaticamente conforme o tipo selecionado
(CNPJ para Pessoa Jurídica, CPF para Pessoa Física). Se o usuário já tiver preenchido um documento e
trocar para um tipo incompatível com o tamanho do valor atual, o campo é limpo automaticamente com
uma notificação explicando o motivo.

## Máscaras de entrada

Reaproveitadas de Clientes -- mesmas funções em
[`frontend/src/lib/masks.ts`](../frontend/src/lib/masks.ts) e o mesmo componente
[`MaskedInput`](../frontend/src/components/shared/MaskedInput.tsx):

| Campo | Máscara | Exemplo |
|---|---|---|
| Telefone / WhatsApp móvel | `(00) 00000-0000` | `(11) 98765-4321` |
| Telefone fixo | `(00) 0000-0000` | `(11) 3456-7890` |
| CPF | `000.000.000-00` | `123.456.789-00` |
| CNPJ | `00.000.000/0000-00` | `12.345.678/0001-95` |
| CEP | `00000-000` | `01310-100` |
| Estado (UF) | Maiúsculas, 2 letras | `SP` |

Todos os campos mascarados aceitam colar valores já formatados ou apenas os dígitos -- o
`MaskedInput` sempre extrai só os dígitos antes de aplicar a máscara visual.

## Como os dados são salvos

O backend ([`backend/apps/suppliers/serializers.py`](../backend/apps/suppliers/serializers.py))
normaliza telefone, WhatsApp, documento e CEP para conter apenas dígitos antes de persistir -- a
máscara existe só na camada de apresentação. O Estado (UF) é salvo em maiúsculas.

Validações do backend (fonte da verdade):
- Telefone e WhatsApp, se preenchidos, precisam ter 10 ou 11 dígitos.
- CEP, se preenchido, precisa ter exatamente 8 dígitos.
- Documento, se preenchido, precisa ter 11 dígitos (CPF) ou 14 dígitos (CNPJ), de acordo com o tipo
  de fornecedor selecionado no mesmo request.
- E-mail, se preenchido, precisa ter formato válido.

## Integração com CEP (ViaCEP)

Reaproveita integralmente a integração de Clientes, agora movida para um local compartilhado:
[`frontend/src/lib/cepService.ts`](../frontend/src/lib/cepService.ts) (antes
`features/customers/cepService.ts`; relocada para `lib/` neste módulo porque deixou de ser algo
exclusivo de Clientes). Mesmo comportamento documentado em
[Clientes → Integração com CEP](customers.md#integração-com-cep-viacep): a consulta só dispara com
os 8 dígitos completos, nunca bloqueia o formulário em caso de CEP não encontrado ou falha da API, e
os campos preenchidos automaticamente continuam editáveis.

## Vínculo com Peças

O campo **Fornecedor** do cadastro de peças agora é uma referência real a este cadastro (FK
`Part.supplier`), nunca mais um campo de texto livre -- comportamento completo documentado em
[Peças e Estoque → Vínculo com o fornecedor](parts.md#vínculo-com-o-fornecedor). Em resumo:

- O seletor de fornecedor em Peças (`SupplierCombobox`) só lista fornecedores **habilitados**; um
  fornecedor desabilitado nunca aparece como opção para um novo vínculo.
- Uma peça já vinculada a um fornecedor que foi desabilitado depois **mantém o vínculo histórico**
  -- desabilitar um fornecedor nunca quebra peças que já o referenciam.
- É possível cadastrar um novo fornecedor sem sair do formulário de peça (ver
  [Adicionar fornecedor inline](parts.md#adicionar-fornecedor-inline)); o fornecedor criado dessa
  forma aparece normalmente neste CRUD depois.

## Exclusão (soft delete)

Segue exatamente o mesmo padrão de [Categorias](categories.md), [Veículos](vehicles.md) e
[Peças e Estoque](parts.md): o campo `is_active` nunca é exposto na API nem na interface como um
campo de "status" -- ele só controla se o fornecedor aparece na listagem padrão e se pode ser
reativado. Não existe forma de excluir fisicamente um fornecedor pela interface.

- **Excluir** (`DELETE /api/suppliers/{id}/`) desabilita o fornecedor (`is_active = False`) e
  retorna `204 No Content`. O registro continua no banco, preservando o vínculo histórico com
  qualquer peça que já o referencie.
- A listagem por padrão mostra só fornecedores habilitados (`?status=active`, o padrão); o filtro
  também aceita `inactive` e `all`, com a mesma linguagem amigável dos demais módulos:
  "Fornecedores habilitados" / "Fornecedores desabilitados" / "Todos".
- Um fornecedor desabilitado pode ser reativado (`POST /api/suppliers/{id}/reactivate/`) -- não há
  checagem de conflito, já que fornecedores não têm restrição de unicidade.

## API

- `GET /api/suppliers/?search=&status=active|inactive|all` -- lista, com busca por nome, nome
  fantasia ou documento, e filtro por status.
- `POST /api/suppliers/` -- cria; só o nome é obrigatório.
- `PATCH /api/suppliers/{id}/` -- edita.
- `DELETE /api/suppliers/{id}/` -- soft delete, `204 No Content`.
- `POST /api/suppliers/{id}/reactivate/` -- reativa.

## Autenticação

A rota de fornecedores (`/suppliers` no frontend; `/api/suppliers/...` no backend) exige usuário
autenticado, seguindo o mesmo [`ProtectedRoute`](../frontend/src/features/auth/ProtectedRoute.tsx) e
a mesma permissão padrão (`IsAuthenticated`) usados pelo restante do sistema.

## Comandos relacionados

Nenhum comando novo foi criado para este módulo -- ele usa a infraestrutura já documentada:
- Subir o ambiente e rodar migrations: [Primeiros passos](getting-started.md),
  [Banco de dados e migrations](database.md).
- Rodar os testes (`apps/suppliers/tests/` e a extensão de `apps/parts/tests/` no backend,
  `SuppliersPage.test.tsx`, `SupplierFormSheet.test.tsx` e a extensão de `PartFormSheet.test.tsx`/
  `PartsPage.test.tsx` no frontend): [Testes e lint](testing.md).

---
Voltar para o [índice da documentação](README.md).
