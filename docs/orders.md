# Ordens de Serviço (OS)

A **Ordem de Serviço** é o documento central da oficina: identifica o veículo e o cliente, agrupa os
itens do atendimento (serviços, pacotes e peças -- cadastrados ou avulsos), registra relato e
diagnóstico, e calcula os valores. É a funcionalidade em destaque no Dashboard.

Reutiliza os módulos de [Clientes](customers.md), [Veículos](vehicles.md),
[Serviços](services.md) (serviços e pacotes) e [Peças e Estoque](parts.md). É o primeiro módulo com
**itens de linha** que podem tanto referenciar um cadastro (FK) quanto ser **avulsos** (texto livre,
válidos apenas naquela OS).

- **Branch:** `feature/ordem-servico`
- **App backend:** `apps.orders` (modelos `WorkOrder`, `WorkOrderService`, `WorkOrderPackage`,
  `WorkOrderPart`)
- **API:** `/api/work-orders/`
- **Rotas frontend:** `/orders` (lista), `/orders/new` (cadastro), `/orders/:id` (edição)

## Como rodar

O módulo roda no mesmo ambiente Docker do restante do projeto (ver
[Primeiros passos](getting-started.md)):

```bash
make up                 # sobe db, mailpit, backend e frontend
make migrate            # aplica as migrations (inclui apps/orders/0001_initial)
make makemigrations     # gera migrations após alterar os models
make test               # backend (pytest) + frontend (vitest)
make lint               # ruff + black --check + oxlint
make build              # bundle de produção do frontend
make seed-scenarios     # popula catálogo + 10 cenários de OS (dev/teste)
```

### Dados de demonstração

`make seed-scenarios` (ou `docker compose exec backend python manage.py seed_scenarios`) popula um
catálogo completo (14 categorias de peças + 14 de serviços, 10 peças, 7 serviços com peças padrão e
4 pacotes) e **10 Ordens de Serviço realistas** cobrindo todo o fluxo: serviços cadastrados e avulsos,
pacotes cadastrados e avulsos, peças cadastradas e avulsas, peças padrão, descontos, e todos os
status operacionais. É **re-executável** (o catálogo é upsertado; os clientes/veículos/OS de demo são
recriados). Dados fictícios, apenas para desenvolvimento, testes e homologação.

Frontend em http://localhost:5173, API em http://localhost:8000/api. Todas as rotas de OS exigem
usuário autenticado.

## Destaque no Dashboard

O card **"Ordens de Serviço"** ocupa a **largura total** acima da grade dos demais cards, com ícone
maior, título em destaque e um botão **"Acessar ordens de serviço"**. A hierarquia visual é
propositalmente superior à dos outros módulos, por a OS ser a funcionalidade central. Toda a área do
card é clicável e leva para `/orders`. Nenhum menu lateral é criado nesta fase.

## Fluxo de criação

```
Dashboard → card "Ordens de Serviço"     → Lista de OS
Lista de OS → "Nova OS"                   → formulário de cadastro (/orders/new)
Lista de OS → "Editar" (por linha)        → formulário de edição (/orders/:id)
Lista de OS → busca (número/placa/cliente)→ filtra ao vivo (debounced)
Lista de OS → "Limpar pesquisa"           → volta à listagem padrão
Lista de OS → filtro de status            → por status da OS ou "Desabilitadas"
Lista de OS → "Excluir" (por linha)       → confirmação → desabilita a OS (soft delete)
```

O formulário é uma **página** (não um drawer), pois é extenso, e ocupa a **largura total**. Em telas
grandes os blocos ficam em **duas colunas**; no mobile empilham na ordem numerada abaixo. Além do
botão "Nova OS" na lista, há um atalho **"Nova OS" sempre visível no menu superior** (`/orders/new`).

- **Coluna esquerda:** Dados principais, Veículo, Cliente, Relato do cliente, Diagnóstico técnico,
  Observações internas.
- **Coluna direita:** Serviços, Pacotes de serviços, Peças utilizadas, Valores.

Blocos:

1. Dados principais (número gerado, data de abertura, previsão de entrega, quilometragem e o
   **Status da OS** ao lado da quilometragem)
2. **Veículo** (vem **antes** do cliente)
3. **Cliente**
4. Relato do cliente
5. Diagnóstico técnico
6. Serviços
7. Pacotes de serviços
8. Peças utilizadas
9. Valores
10. Observações internas

## Veículo antes do cliente (prioridade: placa)

A prioridade operacional é **identificar o veículo pela placa**. Por isso o bloco de **veículo vem
antes** do de cliente.

- O campo principal busca o veículo pela **placa** (aceita com ou sem hífen, maiúsculas/minúsculas --
  normalização idêntica ao [cadastro de veículos](vehicles.md)).
- Ao **selecionar um veículo**, o **cliente vinculado é preenchido automaticamente** e mostrado logo
  abaixo, com o WhatsApp clicável.
- Ao **selecionar primeiro o cliente**, o sistema **carrega os veículos vinculados**:
  - 1 veículo → é selecionado automaticamente;
  - mais de 1 → abre um seletor para escolha;
  - nenhum → oferece o cadastro de veículo inline.
- Selecionar um cliente diferente do dono do veículo já escolhido **limpa** o veículo, mantendo a
  consistência. O backend também recusa uma OS cujo veículo não pertença ao cliente informado.
- Não é possível salvar a OS **sem veículo** nem **sem cliente**.
- Depois da OS aberta, **veículo e cliente não podem ser alterados** -- só podem ser escolhidos na
  criação. Na edição, os campos ficam travados (sem seletor, sem cadastro inline) e o backend ignora
  qualquer tentativa de trocá-los, mantendo o histórico consistente.

## Campos e obrigatoriedade

| Campo | Obrigatório? | Observação |
|---|---|---|
| Número da OS | (gerado) | Sequencial automático, somente-leitura (`OS 0001`) |
| Veículo | **Sim** | Buscado pela placa; deve pertencer ao cliente |
| Cliente | **Sim** | Preenchido pelo veículo ou selecionado manualmente |
| Data de abertura | **Sim** | Formato `dd/mm/aaaa` na interface |
| Relato do cliente | **Sim** | Texto livre |
| Status da OS | **Sim** | Inicia como **Aberta** |
| Previsão de entrega | Não | Data |
| Quilometragem atual | Não | Inteiro, separador de milhar brasileiro |
| Diagnóstico técnico | Não | Pode ser preenchido depois |
| Serviços/Pacotes/Peças | Não | A OS pode iniciar sem itens |
| Observações internas | Não | Texto livre |
| Desconto | Não | Percentual ou valor fixo |

## Status da OS

Os status seguem o ciclo de atendimento:

`Aberta` · `Em diagnóstico` · `Aguardando aprovação` · `Aprovada` · `Em execução` ·
`Aguardando peças` · `Em teste` · `Pronta para entrega` · `Finalizada` · `Cancelada`.

Toda OS nova inicia como **Aberta**. O status é alterado por ação explícita no bloco "Status da OS".
Uma OS **cancelada** ou **desabilitada** nunca é apagada fisicamente (ver
[Soft delete](#soft-delete-e-histórico)).

## Itens da OS: cadastrados e avulsos

Cada bloco de itens (serviços, pacotes, peças) aceita duas origens:

- **Cadastrado:** escolhido por autocomplete a partir do respectivo cadastro. Apenas registros
  **habilitados** aparecem para novos vínculos. O nome e o valor são copiados (snapshot) para a OS.
- **Avulso:** criado com o botão "Serviço/Pacote/Peça avulso". Tem **descrição livre**, quantidade e
  valor unitário, é usado **apenas naquela OS** e **não vira cadastro global** -- não aparece depois
  nos cadastros nem nos seletores. É identificado com o selo **"Avulso"** na interface.

Em ambos os casos é possível ajustar **quantidade** e **valor unitário**. Se o valor não for
informado, entra como `R$ 0,00` no cálculo, sem bloquear a OS. Cada linha mostra o **subtotal**
(quantidade × valor unitário).

### Peças padrão dos serviços

Ao adicionar um **serviço cadastrado** que possui peças padrão, essas peças são **sugeridas
automaticamente** no bloco "Peças utilizadas" (com a quantidade sugerida). O usuário pode
**confirmar, ajustar ou remover** cada peça antes de salvar. Para evitar dupla contagem, a linha do
serviço usa o **valor de mão de obra** e as peças entram como itens de peça próprios.

### Pacotes

Um pacote cadastrado traz seu **valor final** (calculado conforme o [cadastro de
pacotes](services.md)) como valor unitário da linha. Serviços que compõem o pacote podem ser
consultados no próprio cadastro do pacote.

## Cadastro inline

Sempre que a OS depende de um cadastro que ainda não existe, é possível criá-lo **inline por modal**
sem sair do formulário e **sem perder os dados já preenchidos**. Ao salvar, o modal fecha, o novo
registro fica disponível no seletor e **já selecionado/adicionado** quando fizer sentido. Se o
usuário cancelar, volta à OS com tudo preservado. Erros aparecem dentro do próprio modal.

Cadastros inline disponíveis:

- **Cliente** (`Adicionar cliente`) → volta selecionado; sugere em seguida escolher/cadastrar o
  veículo.
- **Veículo** (`Adicionar veículo`) → vinculado automaticamente ao cliente já selecionado; volta
  selecionado.
- **Serviço** (`Novo serviço`) → adicionado ao bloco de serviços.
- **Pacote de serviços** (`Novo pacote`) → adicionado ao bloco de pacotes.
- **Peça** (`Nova peça`) → adicionada ao bloco de peças.
- **Categoria de serviço / de peça** e **Fornecedor** → disponíveis dentro dos modais de serviço e
  peça, reutilizando os mesmos componentes dos cadastros principais.

Os cadastros inline reutilizam os componentes, validações, máscaras e regras dos cadastros
principais -- não há regra duplicada.

## Cálculo de valores

Os totais são calculados **no backend** (fonte da verdade) e recalculados ao vivo no frontend para
feedback imediato:

```
total de serviços = Σ (quantidade × valor unitário) dos serviços
total de pacotes  = Σ (quantidade × valor unitário) dos pacotes
total de peças    = Σ (quantidade × valor unitário) das peças
total bruto       = total de serviços + total de pacotes + total de peças
desconto          = percentual (total × %/100) ou valor fixo
valor final       = máx(0, total bruto − desconto)
```

Itens sem valor entram como `R$ 0,00`. Valores nunca ficam negativos. O desconto percentual é
limitado a 0–100 e o valor final nunca fica abaixo de zero.

## Padrão brasileiro

- Interface em **português do Brasil**.
- Moeda em **Real** (`R$ 0,00`), vírgula decimal, ponto de milhar.
- Datas em `dd/mm/aaaa`; quilometragem com separador de milhar.
- Telefone/WhatsApp, CPF/CNPJ, CEP e placa seguem as máscaras e normalizações já adotadas.
- Na lista e no formulário, o **WhatsApp do cliente** aparece como link clicável
  (`https://wa.me/55...`); sem número cadastrado, exibe "WhatsApp não informado".

## Soft delete e histórico

- A OS **nunca é apagada** pela interface. "Excluir" faz **soft delete** (`is_active = False`): a OS
  some da listagem padrão, mas o registro é preservado e pode ser **reativado**.
- A flag técnica `is_active` **não aparece** como campo na interface.
- O filtro **"Desabilitadas"** mostra as OS desabilitadas e habilita a ação de reativar.
- Cliente, veículo, serviços, pacotes e peças vinculados permanecem íntegros no histórico da OS mesmo
  que sejam desabilitados depois -- os itens guardam o nome e o valor no momento da OS.
- Serviços e pacotes **avulsos** ficam gravados dentro da OS como itens históricos e **não** viram
  cadastros globais.

## Como os dados são salvos

- Valores monetários e quantidades são `DecimalField` (nunca float), serializados como string pela
  API.
- A placa é normalizada (maiúscula, sem espaços/hífen) no backend, como no cadastro de veículos.
- O número da OS é gerado no primeiro `save()` (`max(number) + 1`) e é único.
- Escrita aninhada: os itens (`service_items`, `package_items`, `part_items`) são substituídos por
  completo (delete + recreate) a cada atualização -- a mesma estratégia dos pacotes de serviços.

## API

Todas as rotas exigem autenticação (cookie JWT):

| Método | Rota | Ação |
|---|---|---|
| GET | `/api/work-orders/` | Lista (filtros: `search`, `active`, `status`, `customer`, `vehicle`) |
| POST | `/api/work-orders/` | Cria uma OS |
| GET | `/api/work-orders/{id}/` | Detalha uma OS |
| PATCH | `/api/work-orders/{id}/` | Atualiza uma OS |
| DELETE | `/api/work-orders/{id}/` | Soft delete (`is_active = False`, 204) |
| POST | `/api/work-orders/{id}/reactivate/` | Reativa uma OS desabilitada |

Parâmetros de listagem:

- `active`: `active` (padrão) · `inactive` · `all` -- dimensão de soft delete.
- `status`: um dos status da OS (`open`, `in_progress`, ...), independente de `active`.
- `search`: casa número da OS, placa, nome do cliente, WhatsApp/telefone e marca/modelo.

## Limitações conhecidas desta fase

- **Baixa automática de estoque não é feita.** As peças cadastradas já ficam vinculadas à OS, e a
  arquitetura permite adicionar essa baixa numa fase futura sem refatoração.
- **Não há trava de edição para OS finalizada/cancelada** -- o status pode ser alterado livremente
  nesta fase. O registro nunca é apagado.
- O histórico de mudanças de status não é versionado nesta fase (apenas o status atual é guardado).
