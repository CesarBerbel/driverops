# Segurança (escopo v1)

- Autenticação via JWT (access + refresh) entregue em cookies `httpOnly`, nunca expostos ao
  JavaScript da página.
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
