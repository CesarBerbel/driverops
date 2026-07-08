# Assistente de IA para Textos da OS

Módulo que ajuda a **redigir, revisar, padronizar e melhorar** os textos da Ordem de Serviço
(relato do cliente, diagnóstico, observações internas etc.) **sem inventar informações** e sempre
respeitando o conteúdo original. A IA atua como **assistente de escrita**, nunca como fonte autônoma
de informação técnica: ela nunca cria sintomas, peças, serviços, valores, prazos ou aprovações que
não tenham sido informados.

- **App backend:** `apps.ai_assistant`
- **API base:** `/api/ai/...`
- **Rota frontend:** `/settings/ai` (card **"Assistente de IA para Textos da OS"** em Configurações)
- **Módulo de permissões (RBAC):** `ai` (`view`, `edit`, `use`, `logs`, `test`)

## Como funciona (visão geral)

1. O usuário escreve/cola um texto num campo da OS e aciona uma **ação de IA** (Melhorar, Corrigir
   português, Resumir, Adaptar para o cliente, Reescrever mantendo as informações, etc.).
2. O frontend envia ao backend: **campo de origem, texto atual, ação, OS (opcional) e nada mais**.
3. O **backend monta o prompt** combinando: **regras globais** → **instrução do campo** →
   estilo/fidelidade → **contexto permitido** (filtrado por campo) → texto original. O frontend
   **nunca escolhe prompts críticos**.
4. O provedor de IA retorna uma **sugestão**.
5. O frontend mostra uma **prévia comparando original × sugestão**. O texto original **só é
   substituído quando o usuário clica em "Aplicar"** — nunca automaticamente.
6. Cada uso é registrado em **log** (com status, provedor, tokens e se a sugestão foi aplicada).

## Permissões (módulo `ai`)

| Permissão | O que libera | Crítica? | Perfis padrão |
|---|---|---|---|
| `ai.view` | Ver as configurações de IA | Não | Administrador |
| `ai.edit` | Editar/restaurar configurações e instruções | Sim | Superuser (ou concessão) |
| `ai.use` | Usar a IA nos campos da OS | Não | Administrador, Atendente, Técnico |
| `ai.logs` | Ver o histórico de uso | Sim | Superuser (ou concessão) |
| `ai.test` | Testar prompt na tela de configuração | Sim | Superuser (ou concessão) |

O superusuário sempre passa. As permissões críticas são concedidas pelo superuser na tela de
permissões (ver [Usuários e Permissões](users-permissions.md)).

## Configuração do provedor

A **chave de API nunca é armazenada no banco** — o sistema guarda apenas o **nome da variável de
ambiente** que a contém (padrão de segredos do projeto). Defina a chave no `.env` e recrie o backend:

```bash
# .env (não versionado)
ANTHROPIC_API_KEY=sk-ant-...      # provedor padrão
# OPENAI_API_KEY=sk-...           # se usar OpenAI
# GEMINI_API_KEY=...              # se usar Gemini

docker compose up -d backend      # recria o container para ler a nova variável
```

Na tela **Configurações → Assistente de IA** (com `ai.edit`):

| Campo | Descrição |
|---|---|
| **Assistente de IA ativo** | Interruptor geral. Desligado, os botões de IA não aparecem na OS. |
| **Provedor** | `Anthropic (Claude)` (padrão), `OpenAI`, `Gemini` ou `Outro (compatível OpenAI)`. |
| **Modelo** | Ex.: `claude-opus-4-8` (padrão), `claude-haiku-4-5`, `gpt-4o-mini`. |
| **Variável de ambiente da chave** | Em branco usa o padrão do provedor (`ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, …). O indicador mostra se a chave está configurada no servidor. |
| **Endpoint** | Opcional. Para provedor *custom* (Azure OpenAI, OpenRouter, local) ou Gemini com `base_url` próprio. |
| **Temperatura** | 0–2. **Ignorada** em modelos Anthropic Opus (não aceitam temperatura); usada em OpenAI/Gemini. |
| **Máx. de tokens** | Limite de saída (1–8000). |
| **Timeout (segundos)** | 1–120. |
| **Prompt global** | Regras gerais de comportamento aplicadas antes das instruções de cada campo. |
| **Registrar textos no log** | Privacidade: por padrão **desligado** (não grava os textos enviados/retornados). |
| **Retenção (dias)** | Política de retenção dos textos, quando o log de textos está ligado. |

### Provedores suportados

- **Anthropic (padrão/referência):** via SDK oficial `anthropic` (Messages API). A dependência já
  está em `backend/requirements.txt`.
- **OpenAI e compatíveis:** via HTTP (`/chat/completions`). Use `gpt-4o`, `gpt-4o-mini`, `gpt-4.1`
  (modelos de chat). Modelos de "reasoning" (o1/o3/gpt-5) usam parâmetros diferentes e podem exigir
  ajuste no adaptador.
- **Gemini:** via HTTP (`generateContent`).
- **Custom:** protocolo compatível com OpenAI + `base_url`.

## Instruções por campo

Cada campo textual da OS tem sua própria configuração (semeada com um padrão profissional):

- **Instrução principal da IA** (o que ela deve/não deve fazer naquele campo).
- **Tom** (objetivo/técnico/comercial/amigável/formal), **nível de detalhamento** e **público-alvo**.
- **Permissões da ação:** pode reescrever / corrigir ortografia / resumir / expandir.
- **Contexto permitido da OS** (por campo): cliente, veículo, OS, relato, diagnóstico, serviços,
  peças, orçamento, financeiro, observações internas, histórico. **A filtragem é por campo** — por
  exemplo, no **Relato do Cliente** a IA não recebe diagnóstico/peças/serviços e não transforma o
  relato em diagnóstico; no **Diagnóstico** pode usar relato/serviços/peças, sem inventar.
- **Fidelidade:** preservar termos técnicos, manter primeira pessoa do cliente, remover gírias.
- **Visível ao cliente** e **IA ativa no campo**.

Campos configuráveis: Relato do cliente, Diagnóstico técnico, Observações internas, Procedimentos
realizados, Recomendações técnicas, Observações para o cliente, Resumo da OS, Texto para orçamento,
Texto para aprovação, Texto para finalização, Texto para PDF, Comunicação por WhatsApp/e-mail.

Cada campo tem **Restaurar padrão** (volta a instrução de fábrica); a tela também permite restaurar
todos de uma vez.

## Uso na OS

Nos campos **Relato do cliente**, **Diagnóstico técnico** e **Observações internas** aparece um botão
**IA** (visível apenas para quem tem `ai.use` e com o módulo ativo). O menu mostra **apenas as ações
permitidas** para aquele campo. Ao gerar, abre um **diálogo de comparação** (original × sugestão) com:

- **Aplicar sugestão** (substitui o texto do campo — só aqui),
- **Copiar**, **Descartar**, **Gerar novamente**,
- e um **aviso** de que a IA pode cometer erros e deve ser revisada.

Se o provedor falhar (chave ausente/ inválida, timeout, indisponibilidade), o sistema exibe uma
mensagem clara e **preserva o texto digitado** — nada é perdido.

## Teste de prompt

Com `ai.test`, o botão **Testar prompt** na tela de configuração permite informar um **texto de
exemplo**, escolher **campo + ação** e ver como a IA responderia **sem abrir uma OS real**.

## Log de uso

Com `ai.logs`, a seção **Histórico de uso da IA** lista usuário, campo, ação, provedor, status e se a
sugestão foi aplicada. Os **textos** enviados/retornados só são gravados quando **"Registrar textos no
log"** está ativo.

## Endpoints da API

| Método | Rota | Permissão | Descrição |
|---|---|---|---|
| GET/PATCH | `/api/ai/settings/` | `ai.view` / `ai.edit` | Configuração global (singleton). |
| GET | `/api/ai/metadata/` | `ai.view` ou `ai.use` | Campos, ações, tons, públicos, grupos de contexto e estado do módulo. |
| GET/PATCH | `/api/ai/field-instructions/{id}/` | `ai.view` / `ai.edit` | Instrução por campo. |
| POST | `/api/ai/field-instructions/{id}/restore/` | `ai.edit` | Restaura o padrão do campo. |
| POST | `/api/ai/field-instructions/restore-all/` | `ai.edit` | Restaura todas as instruções. |
| POST | `/api/ai/generate/` | `ai.use` | Gera sugestão para um campo/ação. |
| POST | `/api/ai/test/` | `ai.test` | Testa o prompt com texto de exemplo. |
| GET | `/api/ai/logs/` | `ai.logs` | Histórico de uso. |
| POST | `/api/ai/logs/{id}/outcome/` | `ai.use` | Marca a sugestão como aplicada/descartada. |

## Segurança e privacidade

- **Nunca enviar mais contexto do que o necessário:** o contexto é filtrado por campo.
- **O prompt crítico é montado no backend** — o frontend não escolhe regras livremente.
- **Permissões não são confiadas apenas ao frontend** — a API valida `ai.use`/`ai.edit`/etc.
- **A chave de API fica só em variável de ambiente**, nunca no banco nem no repositório.
- **O texto do usuário nunca é substituído sem confirmação** e é preservado em caso de falha.
- **Respostas da IA não são verdade técnica automática:** devem ser revisadas por um responsável.
- Toda alteração de configuração/instrução é **auditada** (ver [Auditoria](users-permissions.md)).

Volte para o [índice da documentação](README.md).
