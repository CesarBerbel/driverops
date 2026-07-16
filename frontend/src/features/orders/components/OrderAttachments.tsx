import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Camera, FileText, Loader2, Paperclip, Pencil, Trash2, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Can } from "@/features/auth/Can";
import { extractErrorMessage } from "@/lib/api-client";

import {
  attachmentUrl,
  deleteAttachment,
  listAttachments,
  updateAttachment,
  uploadAttachment,
} from "../api";
import { ATTACHMENT_CATEGORY_OPTIONS } from "../constants";
import type { AttachmentCategory, OrderAttachment } from "../types";

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function OrderAttachments({ orderId }: { orderId: number }) {
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const queryKey = ["work-orders", orderId, "attachments"];

  const [category, setCategory] = useState<AttachmentCategory>("other");
  const [caption, setCaption] = useState("");
  const [editing, setEditing] = useState<OrderAttachment | null>(null);
  const [lightbox, setLightbox] = useState<OrderAttachment | null>(null);

  const { data, isLoading } = useQuery({
    queryKey,
    queryFn: () => listAttachments(orderId),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey });

  const uploadMutation = useMutation({
    // Vários de uma vez: o mecânico costuma tirar/anexar N fotos seguidas.
    mutationFn: async (files: File[]) => {
      for (const file of files) {
        await uploadAttachment(orderId, file, { category, caption });
      }
    },
    onSuccess: async (_result, files) => {
      await invalidate();
      setCaption("");
      toast.success(
        files.length > 1 ? `${files.length} arquivos anexados.` : "Arquivo anexado.",
      );
    },
    onError: (error) =>
      toast.error(extractErrorMessage(error, "Não foi possível anexar o arquivo.")),
  });

  const deleteMutation = useMutation({
    mutationFn: (attachmentId: number) => deleteAttachment(orderId, attachmentId),
    onSuccess: async () => {
      await invalidate();
      toast.success("Anexo removido.");
    },
    onError: (error) =>
      toast.error(extractErrorMessage(error, "Não foi possível remover o anexo.")),
  });

  const editMutation = useMutation({
    mutationFn: (payload: { id: number; category: AttachmentCategory; caption: string }) =>
      updateAttachment(orderId, payload.id, {
        category: payload.category,
        caption: payload.caption,
      }),
    onSuccess: async () => {
      await invalidate();
      setEditing(null);
      toast.success("Anexo atualizado.");
    },
    onError: (error) =>
      toast.error(extractErrorMessage(error, "Não foi possível atualizar o anexo.")),
  });

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    if (files.length) uploadMutation.mutate(files);
    event.target.value = "";
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Fotos e anexos</CardTitle>
        <Can code="orders.edit">
          <div className="flex flex-col gap-2 pt-2 sm:flex-row sm:items-end">
            <div className="space-y-1">
              <Label htmlFor="attachment-category" className="text-xs">
                Categoria
              </Label>
              <Select
                value={category}
                onValueChange={(value) => setCategory(value as AttachmentCategory)}
              >
                <SelectTrigger id="attachment-category" className="w-full sm:w-52">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ATTACHMENT_CATEGORY_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1 space-y-1">
              <Label htmlFor="attachment-caption" className="text-xs">
                Legenda (opcional)
              </Label>
              <Input
                id="attachment-caption"
                placeholder="Ex.: risco na porta dianteira"
                value={caption}
                onChange={(event) => setCaption(event.target.value)}
              />
            </div>
            {/* Câmera direta (celular): abre a câmera traseira. No desktop, o
                capture é ignorado e vira um seletor de arquivo normal. */}
            <input
              ref={cameraRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              aria-label="Tirar foto"
              onChange={handleFileChange}
            />
            <input
              ref={inputRef}
              type="file"
              accept="image/*,application/pdf"
              multiple
              className="hidden"
              aria-label="Selecionar arquivo"
              onChange={handleFileChange}
            />
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                className="flex-1 sm:flex-none"
                disabled={uploadMutation.isPending}
                onClick={() => cameraRef.current?.click()}
              >
                {uploadMutation.isPending ? (
                  <Loader2 className="animate-spin" />
                ) : (
                  <Camera className="size-4" />
                )}
                Tirar foto
              </Button>
              <Button
                type="button"
                variant="outline"
                className="flex-1 sm:flex-none"
                disabled={uploadMutation.isPending}
                onClick={() => inputRef.current?.click()}
              >
                <Upload className="size-4" />
                Anexar
              </Button>
            </div>
          </div>
        </Can>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando…</p>
        ) : data && data.length > 0 ? (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {data.map((attachment) => (
              <li key={attachment.id} className="overflow-hidden rounded-md border">
                <button
                  type="button"
                  className="block w-full bg-muted"
                  onClick={() => attachment.is_image && setLightbox(attachment)}
                  aria-label={`Ver ${attachment.original_name}`}
                >
                  {attachment.is_image ? (
                    <img
                      src={attachmentUrl(attachment.file)}
                      alt={attachment.caption || attachment.original_name}
                      className="h-32 w-full object-cover"
                    />
                  ) : (
                    <span className="flex h-32 w-full items-center justify-center">
                      <FileText className="size-8 text-muted-foreground" />
                    </span>
                  )}
                </button>
                <div className="space-y-1 p-2">
                  <div className="flex items-center justify-between gap-2">
                    <Badge variant="muted">{attachment.category_display}</Badge>
                    <div className="flex shrink-0">
                      <Can code="orders.edit">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-7"
                          aria-label={`Editar ${attachment.original_name}`}
                          onClick={() => setEditing(attachment)}
                        >
                          <Pencil className="size-3.5" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-7"
                          aria-label={`Remover ${attachment.original_name}`}
                          disabled={deleteMutation.isPending}
                          onClick={() => deleteMutation.mutate(attachment.id)}
                        >
                          <Trash2 className="size-3.5 text-destructive" />
                        </Button>
                      </Can>
                    </div>
                  </div>
                  <a
                    href={attachmentUrl(attachment.file)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block truncate text-sm font-medium hover:underline"
                  >
                    {attachment.caption || attachment.original_name}
                  </a>
                  <p className="text-xs text-muted-foreground">
                    {formatSize(attachment.size)} · {formatDateTime(attachment.created_at)}
                    {attachment.uploaded_by_name ? ` · ${attachment.uploaded_by_name}` : ""}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <div className="flex flex-col items-center gap-2 py-6 text-center">
            <Paperclip className="size-6 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Nenhuma foto/anexo. Pelo celular, use <strong>Tirar foto</strong> para
              registrar a entrada do veículo, avarias e o andamento do serviço (imagem ou
              PDF, até 10 MB).
            </p>
          </div>
        )}
      </CardContent>

      {/* Editar categoria/legenda */}
      <Dialog open={editing !== null} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Editar anexo</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-4">
              <div className="space-y-1">
                <Label htmlFor="edit-category">Categoria</Label>
                <Select
                  value={editing.category}
                  onValueChange={(value) =>
                    setEditing({ ...editing, category: value as AttachmentCategory })
                  }
                >
                  <SelectTrigger id="edit-category">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ATTACHMENT_CATEGORY_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="edit-caption">Legenda</Label>
                <Input
                  id="edit-caption"
                  value={editing.caption}
                  onChange={(event) =>
                    setEditing({ ...editing, caption: event.target.value })
                  }
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setEditing(null)}>
              Cancelar
            </Button>
            <Button
              type="button"
              disabled={editMutation.isPending}
              onClick={() =>
                editing &&
                editMutation.mutate({
                  id: editing.id,
                  category: editing.category,
                  caption: editing.caption,
                })
              }
            >
              {editMutation.isPending && <Loader2 className="animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Lightbox */}
      <Dialog open={lightbox !== null} onOpenChange={(open) => !open && setLightbox(null)}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle className="text-base">
              {lightbox?.caption || lightbox?.original_name}
            </DialogTitle>
          </DialogHeader>
          {lightbox && (
            <img
              src={attachmentUrl(lightbox.file)}
              alt={lightbox.caption || lightbox.original_name}
              className="max-h-[70vh] w-full rounded-md object-contain"
            />
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}
