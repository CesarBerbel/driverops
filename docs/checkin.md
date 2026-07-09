# Check-in do Veículo

Evolução da antiga aba "Fotos" da OS para uma área estruturada de **check-in de
entrada**: registra o estado visual do veículo (avarias no mapa, fotos), o
checklist de itens, objetos deixados pelo cliente e observações — um histórico
auditável do recebimento. **Não substitui o diagnóstico técnico.**

- **App backend:** `apps.checkin`
- **Aba:** OS → **Check-in** (`OrderForm`, substitui "Fotos")
- **RBAC:** módulo `checkin` (`view`, `edit`, `complete`, `reopen`)

## Fluxo

1. Na aba Check-in, "Iniciar check-in" cria o registro (com o checklist padrão).
2. Clicar no **mapa do veículo** (desenho visto de cima) adiciona uma bolinha de
   avaria na coordenada relativa (X/Y em %) e abre o formulário.
3. Cada avaria tem região, tipo, **severidade** (leve=verde, média=amarelo,
   grave=vermelho), descrição e fotos. A cor da bolinha segue a severidade e a
   lista fica sincronizada com o mapa (selecionar destaca).
4. Fotos gerais por categoria, checklist de itens (presente/ausente/não se
   aplica/não verificado), objetos deixados e dados gerais (km, combustível,
   chegou andando/guincho, cliente acompanhou/confirmou, observações).
5. **Concluir check-in** valida, registra responsável/data e **bloqueia a
   edição**; reabrir exige `checkin.reopen`.

## Modelo de dados (`apps.checkin`)

`VehicleCheckIn` (1 por OS) · `VehicleDamage` (x/y %, região, tipo, severidade,
descrição) · `VehicleDamagePhoto` · `VehicleCheckInPhoto` (foto geral por
categoria) · `VehicleCheckInItem` (checklist) · `VehicleCheckInBelonging`.

## API

| Método | Rota | Ação |
|---|---|---|
| GET/POST | `/api/work-orders/{id}/check-in/` | Buscar / iniciar (get-or-create) |
| PATCH | `/api/check-ins/{id}/` | Dados gerais |
| POST | `/api/check-ins/{id}/complete` `/reopen` | Concluir / reabrir |
| PATCH | `/api/check-ins/{id}/items` | Atualizar checklist |
| POST | `/api/check-ins/{id}/photos` `/belongings` | Foto geral / objeto |
| POST/PATCH/DELETE | `/api/check-in-damages/[{id}/]` | Avarias |
| POST | `/api/check-in-damages/{id}/photos` | Foto da avaria |
| DELETE | `/api/check-in-photos/{id}/`, `/check-in-damage-photos/{id}/`, `/check-in-belongings/{id}/` | Remover |

Uploads: imagem (ou PDF), até 10 MB. Endpoints de escrita bloqueiam edição
quando o check-in está concluído (código `locked`).

## Permissões (módulo `checkin`)

| Permissão | Libera | Perfis padrão |
|---|---|---|
| `checkin.view` | Ver o check-in | Atendente, Técnico (+ admin) |
| `checkin.edit` | Registrar/editar avarias, fotos, itens, objetos | Atendente, Técnico |
| `checkin.complete` | Concluir | Atendente |
| `checkin.reopen` | Reabrir concluído (crítica) | Administrador/superuser |

## Auditoria

Ações relevantes vão para `AuditLog`: `checkin.started/updated/completed/
reopened`, `damage_added/updated/removed`, `photo_added/removed`,
`belonging_added/removed` (com usuário, data, OS e check-in).

## UX / responsividade / acessibilidade

Mapa grande e tocável (mobile/tablet), câmera direta no upload (`capture`),
confirmação antes de remover avaria/foto, severidade **visual e textual** (não
só cor), estados de carregando/erro/vazio/bloqueado/sem-permissão. Dados de
avarias/fotos/itens/objetos persistem imediatamente na API (sem perda ao trocar
de aba); os campos gerais têm botão "Salvar".

## Fora do escopo desta versão (preparado para evolução)

Assinatura/ciência do cliente e geração de PDF/termo do check-in — o modelo já
suporta os dados necessários (avarias, fotos, itens, responsável) para essas
evoluções futuras.

Volte para o [índice da documentação](README.md).
