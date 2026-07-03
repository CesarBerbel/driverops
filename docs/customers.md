# Clientes

Módulo de cadastro de clientes: cadastro completo com endereço, listagem com busca, máscaras de
entrada e preenchimento automático de endereço por CEP.

## Fluxo

```
Dashboard → card "Clientes" → Lista de clientes
Lista de clientes → "Novo cliente"      → formulário de cadastro
Lista de clientes → "Editar" (por linha) → formulário de edição
Lista de clientes → campo de busca       → filtra a lista pelo nome, ao vivo (debounced)
Lista de clientes → "Limpar pesquisa"    → volta para a listagem completa
```

Não existe menu lateral nem submenu dedicado para esta área -- o único ponto de entrada é o card
"Clientes" no Dashboard, seguindo o mesmo padrão de drill-down usado por
[Configurações → Categorias](architecture.md).

A tela de clientes (`frontend/src/features/customers/pages/CustomersPage.tsx`) cobre todos os
estados esperados: carregando (skeleton), erro (com botão "Tentar novamente"), lista vazia sem
nenhum cliente cadastrado, e lista vazia especificamente por busca sem resultado.

A busca funciona como uma lista filtrada em tempo real (debounce de ~300ms): a própria tabela de
clientes é atualizada conforme o usuário digita, sem um dropdown de sugestões separado. Isso cobre
o requisito de "autocomplete" com uma UX mais simples e responsiva.

## Campos do cadastro

Somente **Nome** exige preenchimento manual. **Tipo de cliente** também é obrigatório, mas já vem
preenchido com "Pessoa Física" por padrão -- o usuário só precisa alterá-lo se for cadastrar uma
Pessoa Jurídica. Todos os demais campos são opcionais nesta fase; nenhum deles bloqueia o cadastro.

| Campo | Obrigatório? | Observação |
|---|---|---|
| Nome | **Sim** | Único campo de preenchimento manual obrigatório |
| Tipo de cliente | Sim, mas com padrão | Padrão "Pessoa Física"; suporta "Pessoa Jurídica" |
| E-mail | Não | Validado como e-mail quando preenchido |
| Telefone | Não | Aceita fixo (10 dígitos) ou móvel (11 dígitos) |
| Documento (CPF/CNPJ) | Não | Máscara e validação dependem do tipo de cliente |
| CEP | Não | Consulta o ViaCEP automaticamente quando completo |
| Rua, Número, Complemento, Bairro, Cidade, Estado, País | Não | Preenchidos manualmente ou via CEP |
| Observações | Não | Texto livre |

## Máscaras de entrada

Implementadas em [`frontend/src/lib/masks.ts`](../frontend/src/lib/masks.ts) (funções puras,
testadas em `frontend/src/test/masks.test.ts`) e aplicadas via o componente reutilizável
[`MaskedInput`](../frontend/src/components/shared/MaskedInput.tsx).

| Campo | Máscara | Exemplo |
|---|---|---|
| Telefone | `(00) 00000-0000` (móvel, 11 dígitos) ou `(00) 0000-0000` (fixo, 10 dígitos) | `(11) 98765-4321` |
| CPF | `000.000.000-00` | `123.456.789-00` |
| CNPJ | `00.000.000/0000-00` | `12.345.678/0001-95` |
| CEP | `00000-000` | `01310-100` |
| Estado (UF) | Maiúsculas, 2 letras | `SP` |

O documento troca de máscara automaticamente conforme o "Tipo de cliente" selecionado (CPF para
Pessoa Física, CNPJ para Pessoa Jurídica). Se o usuário já tiver preenchido um documento e trocar o
tipo para um que não seja compatível com o tamanho do valor atual, o campo é limpo automaticamente e
uma notificação explica o motivo -- evitando salvar um documento com a quantidade errada de dígitos
para o tipo escolhido.

Todos os campos mascarados aceitam colar valores já formatados (`(11) 98765-4321`) ou apenas os
dígitos (`11987654321`) -- o `MaskedInput` sempre extrai só os dígitos do que foi digitado/colado
antes de aplicar a máscara visual, então qualquer caractere inválido é descartado automaticamente.

## Como os dados são salvos

O backend ([`backend/apps/customers/serializers.py`](../backend/apps/customers/serializers.py))
**normaliza telefone, documento e CEP para conter apenas dígitos** antes de persistir -- a máscara
existe só na camada de apresentação (frontend). Por exemplo, `(11) 98765-4321` é enviado como está
mas salvo no banco como `11987654321`. O Estado (UF) é salvo em maiúsculas. Isso garante que buscas,
comparações e integrações futuras não precisem lidar com variações de formatação.

Validações do backend (fonte da verdade -- o frontend replica as mesmas regras como conveniência de
UX, mas quem decide é a API):
- Telefone, se preenchido, precisa ter 10 ou 11 dígitos.
- CEP, se preenchido, precisa ter exatamente 8 dígitos.
- Documento, se preenchido, precisa ter 11 dígitos (CPF) ou 14 dígitos (CNPJ), de acordo com o tipo
  de cliente selecionado no mesmo request.
- E-mail, se preenchido, precisa ter formato válido.

## Integração com CEP (ViaCEP)

A consulta de CEP usa a API pública [ViaCEP](https://viacep.com.br/) (`https://viacep.com.br/ws/{cep}/json/`),
chamada diretamente do navegador -- a API já libera CORS para isso, então não há necessidade de um
proxy no backend.

Toda a integração fica isolada em um único arquivo,
[`frontend/src/features/customers/cepService.ts`](../frontend/src/features/customers/cepService.ts),
que expõe uma única função `lookupCep(cep)`. Trocar de provedor no futuro significa editar só esse
arquivo -- nenhuma outra parte do formulário conhece detalhes do ViaCEP.

Comportamento:
- A consulta só é disparada quando o campo CEP atinge os 8 dígitos completos (nunca antes).
- Enquanto a consulta está em andamento, o campo permanece utilizável; não há bloqueio de tela.
- Se o CEP for encontrado, os campos Rua, Bairro, Cidade e Estado são preenchidos automaticamente,
  mas continuam editáveis -- o usuário pode corrigir qualquer valor. Número, Complemento e País
  nunca são sobrescritos pela consulta.
- **Se o CEP não for encontrado** (formato válido, mas inexistente): uma notificação amigável avisa
  ("CEP não encontrado. Preencha o endereço manualmente.") e o formulário continua utilizável
  normalmente.
- **Se a API falhar** (rede indisponível, erro do serviço, etc.): uma notificação amigável avisa
  ("Não foi possível consultar o CEP agora. Preencha o endereço manualmente.") -- o cadastro nunca é
  bloqueado por uma falha na consulta externa.
- Editar um cliente existente **não** dispara uma nova consulta automaticamente ao carregar a
  tela -- a consulta só ocorre quando o usuário efetivamente digita/altera o campo CEP, evitando
  sobrescrever um endereço já salvo só por abrir a tela de edição.

## Autenticação

Todas as rotas de clientes (`/customers`, `/customers/new`, `/customers/:id/edit` no frontend;
`/api/customers/...` no backend) exigem usuário autenticado, seguindo o mesmo
[`ProtectedRoute`](../frontend/src/features/auth/ProtectedRoute.tsx) e a mesma permissão padrão
(`IsAuthenticated`) usados pelo restante do sistema.

## Comandos relacionados

Nenhum comando novo foi criado para este módulo -- ele usa a infraestrutura já documentada:
- Subir o ambiente e rodar migrations: [Primeiros passos](getting-started.md),
  [Banco de dados e migrations](database.md).
- Rodar os testes (`apps/customers/tests/` no backend, `CustomersPage.test.tsx` e
  `CustomerFormPage.test.tsx` no frontend, além de `masks.test.ts`): [Testes e lint](testing.md).

---
Voltar para o [índice da documentação](README.md).
