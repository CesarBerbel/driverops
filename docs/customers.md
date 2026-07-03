# Clientes

Módulo de cadastro de clientes: cadastro completo com endereço, listagem com busca, máscaras de
entrada e preenchimento automático de endereço por CEP.

## Fluxo

```
Dashboard → card "Clientes" → Lista de clientes
Lista de clientes → "Novo cliente"      → drawer (painel lateral) de cadastro
Lista de clientes → "Editar" (por linha) → drawer de edição, pré-preenchido
Lista de clientes → campo de busca       → filtra a lista pelo nome, ao vivo (debounced)
Lista de clientes → "Limpar pesquisa"    → volta para a listagem completa
```

Criar e editar clientes acontece em um drawer lateral (`CustomerFormSheet.tsx`), sem navegar para
uma página separada -- a URL permanece em `/customers` o tempo todo. Isso é deliberado: um formulário
de ~15 campos com bloco de endereço não cabe bem em um modal centralizado pequeno (que é o que
Categorias usa, por ter só 2 campos), mas também não precisa de uma página cheia -- um drawer mantém
o usuário no contexto da listagem.

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
| WhatsApp | Não | Mesmo formato do telefone; exibido como link clicável em todo lugar (ver [WhatsApp](#whatsapp)) |
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
| WhatsApp | Mesma máscara do telefone | `(11) 91234-5678` |
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
**normaliza telefone, WhatsApp, documento e CEP para conter apenas dígitos** antes de persistir -- a
máscara existe só na camada de apresentação (frontend). Por exemplo, `(11) 98765-4321` é enviado como
está mas salvo no banco como `11987654321`. O Estado (UF) é salvo em maiúsculas. Isso garante que
buscas, comparações e integrações futuras não precisem lidar com variações de formatação.

Validações do backend (fonte da verdade -- o frontend replica as mesmas regras como conveniência de
UX, mas quem decide é a API):
- Telefone, se preenchido, precisa ter 10 ou 11 dígitos.
- WhatsApp, se preenchido, precisa ter 10 ou 11 dígitos (mesma regra do telefone).
- CEP, se preenchido, precisa ter exatamente 8 dígitos.
- Documento, se preenchido, precisa ter 11 dígitos (CPF) ou 14 dígitos (CNPJ), de acordo com o tipo
  de cliente selecionado no mesmo request.
- E-mail, se preenchido, precisa ter formato válido.

## WhatsApp

O campo WhatsApp é independente do Telefone (um cliente pode ter números diferentes para cada um) e
usa a mesma máscara/normalização. **Em todo lugar que o número aparece, ele é um link clicável** que
abre uma conversa no WhatsApp Web/app via o link de "click-to-chat" `https://wa.me/<código do
país><número>`:

- Na listagem de clientes (`CustomersPage.tsx`), a coluna "WhatsApp" mostra o número formatado como
  link (com um ícone), ou um traço (`—`) quando o cliente não tem WhatsApp cadastrado.
- No próprio formulário de cadastro/edição (`CustomerFormSheet.tsx`), assim que o número atinge 10 ou
  11 dígitos, um ícone de link aparece ao lado do campo para abrir a conversa sem precisar salvar
  primeiro.
- Os links sempre abrem em uma nova aba (`target="_blank"`).

A montagem do link fica isolada em
[`frontend/src/lib/whatsapp.ts`](../frontend/src/lib/whatsapp.ts) (`buildWhatsAppUrl`), testada em
`frontend/src/test/whatsapp.test.ts`. O código do país é fixo em `55` (Brasil), consistente com o
restante do módulo (CPF/CNPJ, CEP, UF, país padrão "Brasil") -- o número é salvo no banco sem código
de país, então ele é adicionado só na hora de montar o link.

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

## Veículos vinculados

A listagem de clientes tem uma coluna "Veículos" com um ícone de carro e a contagem de veículos
ativos de cada cliente. Clicar no ícone abre o veículo diretamente (quando há só 1) ou um seletor
(quando há 2 ou mais) -- comportamento completo documentado em
[Veículos → Vínculo com o cliente](vehicles.md#vínculo-com-o-cliente).

## Autenticação

A rota de clientes (`/customers` no frontend; `/api/customers/...` no backend) exige usuário
autenticado, seguindo o mesmo [`ProtectedRoute`](../frontend/src/features/auth/ProtectedRoute.tsx) e
a mesma permissão padrão (`IsAuthenticated`) usados pelo restante do sistema. Não existe rota de
exclusão (`DELETE` retorna 405) -- excluir clientes nunca foi um requisito deste módulo.

## Comandos relacionados

Nenhum comando novo foi criado para este módulo -- ele usa a infraestrutura já documentada:
- Subir o ambiente e rodar migrations: [Primeiros passos](getting-started.md),
  [Banco de dados e migrations](database.md).
- Rodar os testes (`apps/customers/tests/` no backend, `CustomersPage.test.tsx`,
  `CustomerFormSheet.test.tsx`, `masks.test.ts` e `whatsapp.test.ts` no frontend):
  [Testes e lint](testing.md).

---
Voltar para o [índice da documentação](README.md).
