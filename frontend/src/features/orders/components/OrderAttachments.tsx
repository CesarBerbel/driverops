import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FileText, Loader2, Paperclip, Trash2, Upload } from "lucide-react";
import { useRef } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Can } from "@/features/auth/Can";
import { extractErrorMessage } from "@/lib/api-client";

import {
  attachmentUrl,
  deleteAttachment,
  listAttachments,
  uploadAttachment,
} from "../api";

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function OrderAttachments({ orderId }: { orderId: number }) {
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const queryKey = ["work-orders", orderId, "attachments"];

  const { data, isLoading } = useQuery({
    queryKey,
    queryFn: () => listAttachments(orderId),
  });

  const uploadMutation = useMutation({
    mutationFn: (file: File) => uploadAttachment(orderId, file),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey });
      toast.success("Arquivo anexado.");
    },
    onError: (error) =>
      toast.error(extractErrorMessage(error, "Não foi possível anexar o arquivo.")),
  });

  const deleteMutation = useMutation({
    mutationFn: (attachmentId: number) => deleteAttachment(orderId, attachmentId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey });
      toast.success("Anexo removido.");
    },
    onError: (error) =>
      toast.error(extractErrorMessage(error, "Não foi possível remover o anexo.")),
  });

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) uploadMutation.mutate(file);
    // Permite reenviar o mesmo arquivo depois (limpa o valor do input).
    event.target.value = "";
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">Anexos</CardTitle>
        <Can code="orders.edit">
          <input
            ref={inputRef}
            type="file"
            accept="image/*,application/pdf"
            className="hidden"
            aria-label="Selecionar arquivo"
            onChange={handleFileChange}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={uploadMutation.isPending}
            onClick={() => inputRef.current?.click()}
          >
            {uploadMutation.isPending ? (
              <Loader2 className="animate-spin" />
            ) : (
              <Upload className="size-4" />
            )}
            Anexar arquivo
          </Button>
        </Can>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando…</p>
        ) : data && data.length > 0 ? (
          <ul className="grid gap-3 sm:grid-cols-2">
            {data.map((attachment) => (
              <li
                key={attachment.id}
                className="flex items-center gap-3 rounded-md border p-2"
              >
                <a
                  href={attachmentUrl(attachment.file)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0"
                >
                  {attachment.is_image ? (
                    <img
                      src={attachmentUrl(attachment.file)}
                      alt={attachment.original_name}
                      className="size-12 rounded object-cover"
                    />
                  ) : (
                    <span className="flex size-12 items-center justify-center rounded bg-muted">
                      <FileText className="size-5 text-muted-foreground" />
                    </span>
                  )}
                </a>
                <div className="min-w-0 flex-1">
                  <a
                    href={attachmentUrl(attachment.file)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block truncate text-sm font-medium hover:underline"
                  >
                    {attachment.original_name}
                  </a>
                  <p className="text-xs text-muted-foreground">
                    {formatSize(attachment.size)}
                    {attachment.uploaded_by_name
                      ? ` · ${attachment.uploaded_by_name}`
                      : ""}
                  </p>
                </div>
                <Can code="orders.edit">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={`Remover ${attachment.original_name}`}
                    disabled={deleteMutation.isPending}
                    onClick={() => deleteMutation.mutate(attachment.id)}
                  >
                    <Trash2 className="size-4 text-destructive" />
                  </Button>
                </Can>
              </li>
            ))}
          </ul>
        ) : (
          <div className="flex flex-col items-center gap-2 py-6 text-center">
            <Paperclip className="size-6 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Nenhum anexo. Envie fotos do veículo, laudos ou notas (imagem ou PDF, até 10 MB).
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
