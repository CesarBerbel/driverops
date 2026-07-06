# Ordens de Serviço (OS)

A **Ordem de Serviço** é o documento central da oficina: identifica o veículo e o cliente, agrupa os
itens do atendimento (serviços, pacotes e peças -- cadastrados ou avulsos), registra relato e
diagnóstico, e calcula os valores. É a funcionalidade em destaque no Dashboard.

Reutiliza os módulos de [Clientes](customers.md), [Veículos](vehicles.md),
[Serviços](services.md) (serviços e pacotes) e [Peças e Estoque](parts.md). É o primeiro módulo com
**itens de linha** que podem tanto referenciar um cadastro (FK) quanto ser **avulsos** (texto livre,
válidos apenas naquela OS).

A partir de uma OS salva é possível gerar um **[Orçamento](quotes.md)** (snapshot dos itens, PDF e
aprovação por assinatura física, no tablet ou por link enviado por e-mail). O painel de Orçamentos
fica abaixo do formulário da OS.

Cada linha de **peça** tem um campo **"Serviço vinculado"** que permite associá-la a um serviço da OS
(inclusive peças e serviços **avulsos**). No orçamento, a peça vinculada é aprovada/recusada em
conjunto com o serviço — ver [Orçamento da OS](quotes.md#peça-vinculada-ao-serviço).

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

O formulário é uma **página** (não um drawer), pois é extenso, e ocupa a **largura total**. Além do
botão "Nova OS" na lista, há um atalho **"Nova OS" sempre visível no menu superior** (`/orders/new`).

## Tela de OS em abas

O cadastro e a edição da OS são organizados em **abas** (`ServiceOrderTabs`), reduzindo a poluição
visual e separando as informações por contexto. A troca de aba é **instantânea** (não recarrega a
página) e **preserva os dados já preenchidos** — o formulário é um único `react-hook-form`, então
sair e voltar de uma aba nunca perde o que foi digitado. No mobile/tablet a barra de abas tem
**rolagem horizontal** e aceita **swipe** por toque.

As sete abas, nesta ordem:

1. **Veículo e cliente** — os blocos aparecem **obrigatoriamente** nesta ordem: **Veículo primeiro**
   (a placa é a prioridade operacional), **Cliente** logo abaixo (preenchido automaticamente ao
   escolher o veículo) e, por fim, os **Dados principais** da OS (data de abertura, previsão de
   entrega, quilometragem, **Status** e **Técnico responsável**).
2. **Relato e diagnóstico** — relato do cliente (obrigatório), diagnóstico técnico e **observações
   internas** (uso interno; não aparecem no PDF nem na página pública do cliente).
3. **Serviços e peças** — serviços, pacotes e peças (cadastrados ou avulsos), com cadastro inline.
4. **Fotos** — anexos/fotos da OS (ver [Anexos](#anexos)). Só em OS já salva.
5. **Orçamento** — o [orçamento da OS](quotes.md). Só em OS já salva.
6. **Resumo e valores** — resumo consolidado (veículo, cliente, status, contagem de itens) e o bloco
   de **Valores** (totais + desconto + valor final, calculados no backend).
7. **Histórico** — a [linha do tempo de status](#histórico-de-status-linha-do-tempo). Só em OS já salva.

As abas **Fotos**, **Orçamento** e **Histórico** ficam **desabilitadas ao criar** uma OS nova (com
dica "Salve a OS para ..."), pois dependem de uma OS já existente.

### Barra de ações

No topo do formulário há uma **barra de ações persistente**: **Voltar** (à lista), **Kanban OS**
(abre o [Kanban](kanban.md)), **Salvar** (salva e volta à lista) e **Salvar e continuar** (salva e
permanece no editor — ao criar, abre o editor da OS recém-criada para liberar Fotos/Orçamento/Histórico).

### Validação por aba

Cada campo é mapeado à sua aba. Se um campo obrigatório inválido está numa aba **não visível**, a aba
exibe um **indicador de erro** (ícone) na barra. Ao tentar salvar com erros, o sistema **leva o
usuário para a primeira aba com erro** (na ordem Veículo/cliente → Relato → Itens → Resumo), para que
a mensagem fique visível. A aba **Histórico** é somente leitura e não exige validação.

### Responsividade

- **Desktop:** abas no topo; cards em grid quando cabível; tabelas para itens; galeria de fotos em grid.
- **Tablet/Mobile:** abas com **rolagem horizontal** + **swipe**; campos e cards empilham em largura
  total; na primeira aba a ordem **Veículo → Cliente → Dados da OS** é preservada ao empilhar.

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

Ao entrar em **Finalizada**, a OS dá **baixa automática de estoque** das peças cadastradas lançadas
nela -- cada uma vira uma movimentação de saída vinculada à OS. A baixa é idempotente (nunca dupla) e
vale tanto pelo arrastar no Kanban quanto pela mudança de status no editor. Detalhes e regras em
[Peças e Estoque → Baixa automática ao finalizar a OS](parts.md#baixa-automática-ao-finalizar-a-os).

### Histórico de status (linha do tempo)

Cada mudança de status é registrada automaticamente (modelo `OrderStatusHistory`): a criação da OS, o
arrastar no Kanban e as edições de status no editor. Cada linha guarda o status anterior, o novo, o
usuário responsável e o horário. O editor da OS mostra a **linha do tempo** ("Histórico de status",
mais recente primeiro); a listagem vem de `GET /api/work-orders/{id}/status-history/`. É um registro
imutável -- útil para auditar o andamento do atendimento sem depender da memória da equipe.

## Técnico responsável

Cada OS pode ter um **técnico responsável** (opcional), escolhido no bloco "Dados principais". O
seletor lista apenas usuários **ativos** com o perfil **Técnico** (`GET /api/work-orders/technicians/`,
mostra nome + especialidade). O vínculo pode ser trocado a qualquer momento; um técnico já atribuído
que for desativado depois continua válido no histórico (mesma regra de "só um *novo* vínculo precisa
estar ativo" usada em cliente/veículo). O [Kanban](kanban.md) permite **filtrar por técnico** e cada
card mostra o técnico atribuído.

## Anexos

Cada OS pode receber **anexos** (fotos do veículo, laudos, notas) -- imagens ou PDF, até **10 MB** por
arquivo. No editor, o bloco "Anexos" permite enviar, baixar (abre em nova aba) e remover arquivos;
imagens aparecem como miniatura. Enviar/remover exige `orders.edit`; qualquer um que veja a OS
(`orders.view`) consegue listar e baixar. Endpoints: `GET/POST /api/work-orders/{id}/attachments/` e
`DELETE /api/work-orders/{id}/attachments/{anexo_id}/`. Os arquivos são gravados em `MEDIA_ROOT`
(`media/orders/<id>/`) e servidos por `/media/` (ver [Variáveis de ambiente](environment-variables.md)).

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
| GET | `/api/work-orders/` | Lista (filtros: `search`, `active`, `status`, `customer`, `vehicle`, `technician`) |
| POST | `/api/work-orders/` | Cria uma OS |
| GET | `/api/work-orders/{id}/` | Detalha uma OS |
| PATCH | `/api/work-orders/{id}/` | Atualiza uma OS |
| DELETE | `/api/work-orders/{id}/` | Soft delete (`is_active = False`, 204) |
| POST | `/api/work-orders/{id}/reactivate/` | Reativa uma OS desabilitada |
| POST | `/api/work-orders/{id}/move/` | Muda o status respeitando o fluxo do Kanban |
| GET | `/api/work-orders/{id}/status-history/` | Linha do tempo de status (mais recente primeiro) |
| GET | `/api/work-orders/technicians/` | Técnicos ativos, para o seletor de responsável |
| GET/POST | `/api/work-orders/{id}/attachments/` | Lista / envia anexos (imagem ou PDF, 10 MB) |
| DELETE | `/api/work-orders/{id}/attachments/{anexo_id}/` | Remove um anexo |

Parâmetros de listagem:

- `active`: `active` (padrão) · `inactive` · `all` -- dimensão de soft delete.
- `status`: um dos status da OS (`open`, `in_progress`, ...), independente de `active`.
- `technician`: id do técnico responsável (usado pelo filtro do Kanban).
- `search`: casa número da OS, placa, nome do cliente, WhatsApp/telefone e marca/modelo.

## Limitações conhecidas desta fase

- **Não há trava de edição para OS finalizada/cancelada** -- o status pode ser alterado livremente
  nesta fase. O registro nunca é apagado.
- A baixa automática de estoque registra o consumo no momento da finalização; correções após reabrir
  a OS são feitas por um **ajuste manual** de estoque (ver [Peças e Estoque](parts.md)).
