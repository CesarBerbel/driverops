# Superusuário: criação e atualização

Existem duas formas equivalentes de criar/atualizar o superusuário de desenvolvimento -- ambas
chamam o mesmo comando de gerenciamento do Django (`python manage.py seed_admin`), então há uma
única fonte de verdade:

**1. Via Makefile:**

```bash
make seed-admin
# ou, o mesmo comando com outro nome:
make createsuperuser
```

**2. Via script dedicado** (é o que os alvos acima chamam por baixo):

```bash
bash scripts/create-superuser.sh
```

O comando é **idempotente**: se o e-mail definido em `DJANGO_SUPERUSER_EMAIL` já existir, ele
apenas atualiza nome, senha e permissões (`is_staff`/`is_superuser`) -- nunca cria um usuário
duplicado. Rode quantas vezes quiser, inclusive depois de mudar a senha no `.env`.

As credenciais vêm exclusivamente de `DJANGO_SUPERUSER_EMAIL`, `DJANGO_SUPERUSER_PASSWORD` e
`DJANGO_SUPERUSER_NAME` (opcional) -- documentadas em [`.env.example`](../.env.example) e detalhadas
em [Variáveis de ambiente](environment-variables.md). O comando falha com uma mensagem clara se
e-mail/senha não estiverem definidos.

---
Voltar para o [índice da documentação](README.md).
