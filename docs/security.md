# Segurança (escopo v1)

- **Controle de acesso por função (RBAC):** perfis + permissões granulares (`modulo.acao`) validados
  no **backend** (`HasModulePermission`/`require_permission`) e no **frontend** (guards de rota +
  ocultação de ações). O **superuser** tem acesso total; a tela de permissões é **exclusiva** dele;
  usuários sem permissão recebem **403** mesmo chamando a API direto. Usuários desativados não
  acessam o sistema; ações sensíveis vão para a **auditoria**. Ver
  [Usuários e Permissões](users-permissions.md).
- **RBAC nega por padrão (*fail-closed*):** o `HasModulePermission` **rejeita** qualquer requisição
  para uma view que não declare `permission_module`, ou para uma *custom action* cujo nome não esteja
  no `permission_action_map` nem no mapa padrão -- em vez de liberar o acesso "por omissão". Adicionar
  uma nova rota sem mapeá-la resulta em **403**, não em um vazamento silencioso. As duas *actions* que
  antes ficavam sem verificação -- `QuoteViewSet.upload_signed` (mutante) e
  `NotificationTemplateViewSet.history` -- passaram a ser mapeadas explicitamente (`approve` e `view`).
- Autenticação via JWT (access + refresh) entregue em cookies `httpOnly`, nunca expostos ao
  JavaScript da página. O refresh token é **rotacionado** a cada uso (`ROTATE_REFRESH_TOKENS`),
  emitindo um novo token, e o token anterior é **invalidado imediatamente**
  (`BLACKLIST_AFTER_ROTATION=True`). Assim o **logout** (que faz *blacklist* do refresh atual e limpa
  os cookies) realmente encerra a sessão: um refresh token capturado antes do logout não consegue mais
  emitir novos access tokens. Tradeoff aceito: se duas requisições fizerem refresh exatamente ao mesmo
  tempo com o mesmo token (corrida de múltiplas abas), a segunda recebe 401 e precisa refazer o login
  -- preferimos esse custo raro à alternativa de deixar tokens rotacionados válidos após o logout.
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
- A página pública de aprovação de **[orçamento](quotes.md)** usa um **token seguro**
  (`secrets.token_urlsafe`, não sequencial) e é limitada àquele orçamento: sem login, sem edição de
  dados e sem acesso a outros orçamentos. Após a decisão (aprovar/recusar), o token não permite nova
  decisão. A aprovação por link registra IP e user agent.
- **Mídia privada:** os uploads (`/media/`) **não** são mais servidos diretamente pelo nginx. Toda
  requisição passa por `ProtectedMediaView`, que **exige autenticação** -- exceto um allowlist de
  prefixos públicos de *branding* (`workshop/logos/`). Em produção a view não lê o disco: valida a
  sessão e delega a entrega ao nginx via cabeçalho `X-Accel-Redirect` para uma *location* `internal;`
  (`/internal-media/`), inacessível diretamente de fora. Em desenvolvimento (`DEBUG=True`) o arquivo é
  devolvido via `FileResponse`. Tentativas de *path traversal* (`..`) resultam em **404**.
- **Uploads endurecidos (validação central em `apps/core/uploads.py`):** todo arquivo recebido
  (anexos de OS, fotos de check-in, documento assinado e assinatura de orçamento) passa por
  `validate_upload`, que:
  - confere o **tipo real** por *magic bytes* (assinatura binária do conteúdo), **ignorando** o
    `Content-Type` informado pelo cliente -- um `.exe` renomeado para `.pdf` é rejeitado;
  - impõe **limite de tamanho** por campo (padrão 10 MB; assinatura 2 MB);
  - **sanitiza o nome** do arquivo (`sanitize_filename`): remove componentes de caminho, normaliza para
    ASCII, troca caracteres inseguros por `_` e limita o comprimento, preservando a extensão --
    bloqueando *path traversal* e nomes maliciosos na gravação.
  Uploads que substituem um arquivo anterior (ex.: documento assinado) **removem o antigo** do disco.
- **Limpeza de arquivos órfãos:** *signals* `post_delete` removem os arquivos físicos quando os
  registros de fotos de check-in/dano/pertences são apagados, evitando lixo acumulado no volume de
  mídia.

---
Voltar para o [índice da documentação](README.md).
