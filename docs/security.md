# Segurança (escopo v1)

- Autenticação via JWT (access + refresh) entregue em cookies `httpOnly`, nunca expostos ao
  JavaScript da página. O refresh token é **rotacionado** a cada uso (`ROTATE_REFRESH_TOKENS`),
  emitindo um novo token. O token anterior **não** é invalidado imediatamente
  (`BLACKLIST_AFTER_ROTATION=False`) de propósito: quando o access token expira e várias requisições
  fazem refresh ao mesmo tempo (múltiplas abas, ou uma corrida de requisições), invalidar o token
  antigo faria o segundo refresh falhar com 401, limpar os cookies e jogar o usuário de volta para a
  tela de login. O logout encerra a sessão limpando os cookies. Tradeoff: um refresh token rotacionado
  permanece válido até expirar naturalmente.
- A sessão só é encerrada em falha de autenticação **definitiva** (401): a consulta `/users/me/` e o
  fluxo de refresh do `api-client` só deslogam o usuário quando a resposta é 401. Erros transitórios
  (rede instável, 5xx, o backend reiniciando durante uma requisição) **não** derrubam a sessão -- a
  requisição falha e pode ser repetida, mas o usuário continua logado.
- Mitigação de CSRF via `SameSite=Lax` + allowlist estrita de `CORS_ALLOWED_ORIGINS` com
  `credentials: true`. Não há um esquema de double-submit token nesta v1 -- decisão deliberada para
  um app de demonstração/v1: toda requisição que altera estado ainda exige um JWT válido, que não é
  falsificável.
- Senhas validadas pelos validadores nativos do Django (tamanho mínimo, não totalmente numérica,
  não estar entre as mais comuns, não ser muito parecida com dados do usuário).
- Links de redefinição de senha expiram em 1 hora e ficam automaticamente inválidos após o primeiro
  uso (o token é gerado a partir do hash da senha atual, que muda ao ser redefinida).
- O endpoint de solicitação de redefinição de senha sempre responde com a mesma mensagem genérica,
  para não revelar quais e-mails estão cadastrados.
- Login e solicitação de redefinição de senha possuem *rate limiting* (`5/min` e `3/min`,
  respectivamente).

---
Voltar para o [índice da documentação](README.md).
