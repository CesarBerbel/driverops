# Página pública institucional (Landing)

Vitrine pública da oficina, servida na raiz (`/`), sem autenticação. Transmite
confiança e organização e funciona como ponto de entrada para agendamento,
contato, orçamento e acesso ao sistema. O visual é inspirado na identidade do
logo (fundo escuro, moldura/azul de destaque e acento em vermelho).

- **Rota:** `/` (pública, fora do `AppShell`)
- **Feature frontend:** `features/landing`
- **Endpoint público:** `GET /api/public/landing/` (AllowAny)

## Seções

Header fixo com menu (drawer no mobile) · Hero com CTAs e badges · Marcas
atendidas (carrossel) · Por que escolher a gente · Serviços prestados · Como
funciona o atendimento (10 etapas) · CTA intermediário · Depoimentos · Sobre ·
FAQ · Contato e localização (com mapa) · Footer institucional.

## Dados reais x fallback

A página consome dados **reais** quando configurados, com **fallback seguro**:

| Dado | Origem | Fallback |
|---|---|---|
| Nome, logo, contatos, endereço, horário, CNPJ | Configurações → Dados da Oficina (`WorkshopProfile`) | Nome genérico + mark tipográfico; seções/itens vazios são ocultados |
| Serviços | Serviços **ativos** (`Service.is_active`) | Catálogo padrão de serviços com ícones |
| Marcas | Lista estática organizada | Mensagem neutra se vazia |
| Depoimentos | Estrutura pronta (exemplos por ora) | — |

O endpoint público expõe **apenas** campos institucionais seguros (nunca notas
internas, inscrição estadual, responsável, etc.).

### CTAs / rotas

O CTA principal é **comercial** ("Pedir marcação de horário", "Pedir orçamento ou
diagnóstico", "Solicitar atendimento") e abre o **formulário público de pedido de
contato** — ver [Pedidos do Site](pedidos-site.md). O visitante não precisa criar
conta. O botão **"Entrar"** deixou de ser CTA principal; o acesso administrativo
fica discreto no rodapé (**"Área da oficina"** → `/login`).

- **WhatsApp**, **telefone**, **e-mail**, **endereço** → clicáveis (wa.me, tel,
  mailto, Google Maps).

## SEO / acessibilidade / performance

- **SEO:** `title`, `meta description`, Open Graph e **JSON-LD `AutoRepair`**
  aplicados dinamicamente (`useLandingSeo`) a partir dos dados da oficina;
  `lang="pt-BR"` e headings em ordem lógica.
- **Acessibilidade:** navegação por teclado, foco visível, alt/nomes claros,
  carrossel com controles manuais e **respeito a `prefers-reduced-motion`**,
  FAQ com `<details>/<summary>` nativo.
- **Performance:** sem bibliotecas de carrossel/animação pesadas (CSS + estado),
  `loading="lazy"` no mapa e imagens fora do hero.

## Responsividade

Mobile-first: hero com CTA visível, cards em coluna única, carrossel com swipe,
botões grandes para toque e header compacto (drawer). No desktop, hero em duas
colunas e grids para serviços/diferenciais, respeitando largura máxima.

Volte para o [índice da documentação](README.md).
