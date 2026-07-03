# Veículos

Módulo de cadastro de veículos, obrigatoriamente vinculado a um cliente. Todo veículo pertence a um
cliente responsável/proprietário; não existe veículo "sem dono".

## Fluxo

```
Dashboard → card "Veículos"              → Lista de veículos
Lista de veículos → "Novo veículo"       → drawer de cadastro (escolhe o cliente por autocomplete)
Lista de veículos → "Editar" (por linha) → drawer de edição, pré-preenchido
Lista de veículos → campo de busca       → filtra por placa, cliente, marca ou modelo (ao vivo, debounced)
Lista de veículos → "Excluir" (por linha) → confirmação → desabilita o veículo (soft delete)
Lista de veículos → filtro de status     → Ativos / Desabilitados / Todos
```

Assim como [Clientes](customers.md), o cadastro e a edição acontecem em um drawer lateral
(`VehicleFormSheet.tsx`) -- a URL permanece em `/vehicles` o tempo todo. Não existe menu lateral nem
submenu dedicado: o único ponto de entrada é o card "Veículos" no Dashboard.

## Vínculo com o cliente

O campo **Cliente responsável** é obrigatório e é preenchido por um autocomplete
(`CustomerCombobox`, em `frontend/src/components/shared/CustomerCombobox.tsx`): o usuário digita o
nome do cliente, os resultados aparecem em um painel logo abaixo do campo (busca ao vivo, debounced),
e selecionar um resultado fixa o cliente escolhido (com um botão "×" para trocar). Não é possível
salvar um veículo sem um cliente selecionado.

### Ícone de carro na lista de clientes

A listagem de clientes (`CustomersPage.tsx`) ganhou uma coluna "Veículos" com um ícone de carro e a
contagem de veículos **ativos** daquele cliente (`vehicle_count`, anotado no backend via
`Count("vehicles", filter=Q(vehicles__is_active=True))` em `CustomerViewSet.get_queryset`). O
comportamento ao clicar depende da contagem:

- **0 veículos**: o ícone fica desabilitado (sem ação).
- **Exatamente 1 veículo**: clicar abre diretamente o `VehicleFormSheet` em modo de edição para esse
  veículo -- sem passo intermediário.
- **2 ou mais veículos**: clicar abre o `VehicleSelectorDialog`, um diálogo centralizado listando cada
  veículo (placa + marca/modelo); selecionar um item abre o `VehicleFormSheet` para o veículo
  escolhido.

Em ambos os casos, a lista de veículos do cliente é buscada sob demanda (`listVehicles({customerId})`)
no momento do clique -- não é pré-carregada junto com a listagem de clientes.

## Campos do cadastro

Somente **Cliente responsável** e **Placa** são obrigatórios. Todos os demais campos são opcionais.

| Campo | Obrigatório? | Observação |
|---|---|---|
| Cliente responsável | **Sim** | Selecionado via autocomplete (`CustomerCombobox`) |
| Placa | **Sim** | Formato antigo ou Mercosul (ver [Placa](#placa)) |
| Marca, Modelo, Versão, Cor | Não | Texto livre |
| Tipo de veículo | Não | Carro, Moto, Caminhonete, Van, Caminhão, Utilitário, Outro |
| Categoria de uso | Não | Particular, Comercial, Aplicativo, Táxi, Frota, Outro |
| Ano de fabricação, Ano do modelo | Não | Ano de 4 dígitos; modelo não pode ser anterior à fabricação |
| Quilometragem | Não | Número inteiro não negativo |
| Combustível | Não | Gasolina, Etanol, Flex, Diesel, Híbrido, Elétrico, GNV, Outro |
| Câmbio | Não | Manual, Automático, Automatizado, CVT, Outro |
| Direção | Não | Mecânica, Hidráulica, Elétrica, Eletro-hidráulica, Outra |
| Portas | Não | 2, 3, 4 ou 5 |
| Ar-condicionado | Não | Sim / Não / Não informado (campo de três estados) |
| Veículo modificado | Não | Sim / Não / Não informado; "Sim" revela o campo de observações da modificação |
| Chassi | Não | Normalizado em maiúsculas, sem espaços |
| RENAVAM | Não | Normalizado para conter apenas dígitos |
| Código FIPE | Não | Texto livre |
| Observações | Não | Texto livre |

Os campos de seleção (combustível, câmbio, direção, tipo de veículo, categoria de uso, portas,
ar-condicionado, modificado) usam valores enumerados fixos, com uma opção "Não informado" quando o
dado não foi preenchido -- eles nunca aceitam texto livre.

## Placa

A placa aceita os dois formatos em uso no Brasil:
- **Formato antigo**: 3 letras + 4 dígitos (ex.: `ABC1234`).
- **Formato Mercosul**: 3 letras + 1 dígito + 1 letra + 2 dígitos (ex.: `ABC1D23`).

### Normalização

Enquanto o usuário digita, o campo é normalizado em tempo real
([`frontend/src/features/vehicles/plate.ts`](../frontend/src/features/vehicles/plate.ts),
`normalizePlate`): tudo é convertido para maiúsculas, qualquer caractere que não seja letra ou dígito
é removido (então tanto `abc-1234` quanto `abc 1234` viram `ABC1234`), e o valor é limitado a 7
caracteres. Nenhum separador é inserido automaticamente durante a digitação -- os dois formatos
divergem a partir do 5º caractere (dígito no formato antigo, letra no Mercosul), então tentar advinhar
qual máscara aplicar enquanto o usuário ainda está digitando erraria com frequência.

O backend ([`backend/apps/vehicles/serializers.py`](../backend/apps/vehicles/serializers.py),
`validate_license_plate`) aplica a mesma normalização (maiúsculas, sem espaços/hífen) de forma
independente -- ele é a fonte da verdade; o frontend só replica a regra como conveniência de UX. Um
valor que não corresponda a nenhum dos dois formatos após a normalização é rejeitado com erro 400.

Na listagem (somente leitura), a placa no formato antigo é exibida com o hífen convencional
(`ABC-1234`, via `formatPlateForDisplay`); a placa Mercosul é exibida como está (`ABC1D23`), seguindo
a convenção real de não usar separador nesse formato. O valor salvo no banco nunca contém hífen, em
nenhum dos dois formatos.

### Unicidade

A placa é única **apenas entre veículos ativos** (mesmo padrão de unicidade escopada usado por
[Categorias](categories.md) e reaproveitado aqui via `Vehicle.has_active_plate_conflict`). Isso
significa que, depois de um veículo ser excluído (soft delete), sua placa pode ser reutilizada em um
novo cadastro -- o histórico do veículo antigo é preservado, apenas desabilitado.

## Ano e quilometragem

- Ano de fabricação e ano do modelo, quando preenchidos, precisam ser um ano de 4 dígitos plausível
  (entre 1900 e o ano atual + 2 -- a margem cobre a venda antecipada do próximo ano-modelo sem ser
  excessivamente rígida).
- O ano do modelo não pode ser anterior ao ano de fabricação (quando ambos estão preenchidos).
- A quilometragem, quando preenchida, não pode ser negativa.

Essas regras são validadas tanto no frontend (`frontend/src/features/vehicles/schemas.ts`, para
feedback imediato) quanto no backend (fonte da verdade).

## Como os dados são salvos

O backend normaliza antes de persistir:
- **Placa** e **Chassi**: maiúsculas, sem espaços/hífen.
- **RENAVAM**: apenas dígitos.
- **Marca, Modelo, Versão, Cor, Código FIPE**: espaços nas extremidades removidos (`strip()`).
- **Ano de fabricação, Ano do modelo, Quilometragem, Portas**: números inteiros ou `null` quando não
  informados (nunca uma string vazia).
- **Ar-condicionado, Veículo modificado**: campos de três estados (`true` / `false` / `null` para "não
  informado") -- nunca forçados para um booleano quando o dado não foi informado.

## Exclusão (soft delete)

Segue exatamente o mesmo padrão de [Categorias](categories.md): o campo `is_active` nunca é exposto
na API como um campo de "status" editável -- ele só controla se o veículo aparece na listagem padrão
e se pode ser reativado.

- **Excluir** (`DELETE /api/vehicles/{id}/`) desabilita o veículo (`is_active = False`) e retorna
  `204 No Content`. O registro continua no banco, preservando o histórico.
- A listagem por padrão mostra só veículos ativos (`?status=active`, o padrão); o filtro de status
  também aceita `inactive` e `all`.
- Um veículo desabilitado pode ser reativado (`POST /api/vehicles/{id}/reactivate/`), exceto se sua
  placa colidir com a de outro veículo atualmente ativo -- nesse caso a reativação é bloqueada com
  400, pelo mesmo motivo que a unicidade de placa é escopada a veículos ativos.

## Autenticação

A rota de veículos (`/vehicles` no frontend; `/api/vehicles/...` no backend) exige usuário
autenticado, seguindo o mesmo [`ProtectedRoute`](../frontend/src/features/auth/ProtectedRoute.tsx) e
a mesma permissão padrão (`IsAuthenticated`) usados pelo restante do sistema.

## Comandos relacionados

Nenhum comando novo foi criado para este módulo -- ele usa a infraestrutura já documentada:
- Subir o ambiente e rodar migrations: [Primeiros passos](getting-started.md),
  [Banco de dados e migrations](database.md).
- Rodar os testes (`apps/vehicles/tests/` no backend, `VehiclesPage.test.tsx`,
  `VehicleFormSheet.test.tsx` e `plate.test.ts` no frontend, além do teste de `vehicle_count` em
  `apps/customers/tests/`): [Testes e lint](testing.md).

---
Voltar para o [índice da documentação](README.md).
