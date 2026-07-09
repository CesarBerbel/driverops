# Estados de espera (EngineLoader)

Sistema padronizado de loading com uma animação temática de **pistões de um
motor em V** (CSS puro, sem bibliotecas). Substitui spinners genéricos por um
feedback consistente, acessível e alinhado ao universo automotivo.

- **Módulo:** [`src/components/loading/`](../frontend/src/components/loading/)
- **Animação:** keyframes em [`src/index.css`](../frontend/src/index.css) (`engine-piston`, `engine-crank`)

## Componentes

| Componente | Uso |
|---|---|
| `EngineLoader` | Núcleo visual (o motor animado). Props: `size` (`sm/md/lg/xl`), `label`, `showLabel`, `className`. |
| `PageLoader` | Página inteira carregando (centralizado + mensagem). |
| `InlineLoader` | Áreas pequenas (cards, dropdowns). |
| `ButtonLoader` | Dentro de `<Button>` durante uma ação (Salvar/Enviar/Gerar PDF). |
| `LoadingOverlay` | Ações longas/críticas; cobre o container e **bloqueia cliques** (`active`, `fullscreen`). |
| `LoadingState` | Padroniza carregando/erro/vazio/sem permissão; renderiza `children` quando ocioso. |
| `CardSkeleton` / `TableSkeleton` | Esqueletos para dashboards, listas e tabelas. |

## Quando usar cada um

- **Skeleton** — quando o layout do conteúdo é previsível (listas, tabelas,
  dashboards). Mantém a interface estável e reduz a sensação de lentidão.
- **EngineLoader compacto (`sm`)** — ação curta (botão, inline).
- **PageLoader (`lg`)** — a página inteira está carregando.
- **EngineLoader `xl`** — carregamento global (ex.: `ProtectedRoute` →
  "Preparando a oficina...").
- **LoadingOverlay** — quando o usuário não pode interagir até terminar (evita
  clique duplo).

Evite múltiplos loaders simultâneos na mesma tela.

## Acessibilidade

- `role="status"` + `aria-busy="true"` + `aria-live="polite"` na região.
- Texto **`sr-only`** sempre presente (ex.: "Carregando, aguarde.") — não
  depende só da animação.
- A animação é `aria-hidden`.
- **Respeita `prefers-reduced-motion`**: com redução ativa, o motor fica estático
  (sem movimento), via `@media (prefers-reduced-motion: reduce)` no CSS.
- Cores vêm de `currentColor`/tokens do tema → adapta a **claro/escuro**.

## Exemplos

```tsx
// Página
<PageLoader label="Carregando dados da oficina..." />

// Botão
<Button disabled={isSaving}>
  {isSaving ? <ButtonLoader label="Salvando..." /> : "Salvar"}
</Button>

// Overlay (ação longa; o pai precisa ser relative, ou use fullscreen)
<LoadingOverlay active={isGeneratingPdf} label="Gerando PDF da OS..." />

// Estados padronizados
<LoadingState isLoading={q.isLoading} isError={q.isError} onRetry={q.refetch}>
  {conteudo}
</LoadingState>
```

## Integrações já feitas

Global (`ProtectedRoute`), Login, formulário público de pedido (site), botão de
PDF da OS e o sino de notificações. Os demais fluxos podem adotar o padrão
incrementalmente (as listas já usam skeletons).

Volte para o [índice da documentação](README.md).
