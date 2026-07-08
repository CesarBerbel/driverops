import { useQuery } from "@tanstack/react-query";
import { AlertCircle, Bell, Pencil } from "lucide-react";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { usePermissionCheck } from "@/features/auth/usePermission";

import { getNotificationMetadata, listNotificationTemplates } from "../api";
import type {
  ChannelFilter,
  NotificationTemplate,
  StatusFilter,
} from "../types";
import { NotificationTemplateEditor } from "./NotificationTemplateEditor";

const CHANNEL_OPTIONS: { value: ChannelFilter; label: string }[] = [
  { value: "all", label: "Todos os canais" },
  { value: "email", label: "E-mail" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "sms", label: "SMS" },
  { value: "internal", label: "Notificação interna" },
];

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "Todos os status" },
  { value: "active", label: "Ativos" },
  { value: "inactive", label: "Inativos" },
];

export function NotificationTemplatesManager() {
  const can = usePermissionCheck();
  const canEdit = can("notifications.edit");
  const canTest = can("notifications.test");

  const [search, setSearch] = useState("");
  const [channel, setChannel] = useState<ChannelFilter>("all");
  const [event, setEvent] = useState<string>("all");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [selected, setSelected] = useState<NotificationTemplate | null>(null);

  const metadataQuery = useQuery({
    queryKey: ["notification-metadata"],
    queryFn: getNotificationMetadata,
  });

  const templatesQuery = useQuery({
    queryKey: ["notification-templates", { channel, event, status, search }],
    queryFn: () =>
      listNotificationTemplates({
        channel,
        event: event === "all" ? undefined : event,
        status,
        q: search.trim() || undefined,
      }),
  });

  if (selected && metadataQuery.data) {
    return (
      <NotificationTemplateEditor
        template={selected}
        metadata={metadataQuery.data}
        canEdit={canEdit}
        canTest={canTest}
        onBack={() => setSelected(null)}
      />
    );
  }

  const templates = templatesQuery.data ?? [];
  const isEmpty = templates.length === 0;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Input
          placeholder="Buscar por nome ou descrição…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Buscar templates"
        />
        <Select value={channel} onValueChange={(v) => setChannel(v as ChannelFilter)}>
          <SelectTrigger aria-label="Filtrar por canal">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CHANNEL_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={event} onValueChange={setEvent}>
          <SelectTrigger aria-label="Filtrar por evento">
            <SelectValue placeholder="Todos os eventos" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os eventos</SelectItem>
            {metadataQuery.data?.events.map((e) => (
              <SelectItem key={e.key} value={e.key}>
                {e.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={(v) => setStatus(v as StatusFilter)}>
          <SelectTrigger aria-label="Filtrar por status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {templatesQuery.isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : templatesQuery.isError ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
            <AlertCircle className="size-8 text-destructive" />
            <p className="text-sm text-muted-foreground">
              Não foi possível carregar os templates.
            </p>
            <Button size="sm" variant="outline" onClick={() => templatesQuery.refetch()}>
              Tentar novamente
            </Button>
          </CardContent>
        </Card>
      ) : isEmpty ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
            <Bell className="size-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Nenhum template encontrado com os filtros atuais.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Evento</TableHead>
                <TableHead>Canal</TableHead>
                <TableHead>Nome</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-0 text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {templates.map((template) => (
                <TableRow key={template.id}>
                  <TableCell className="font-medium">{template.event_display}</TableCell>
                  <TableCell>
                    <Badge>{template.channel_display}</Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{template.name}</TableCell>
                  <TableCell>
                    {template.is_active ? (
                      <span className="text-sm text-foreground">Ativo</span>
                    ) : (
                      <span className="text-sm text-muted-foreground">Inativo</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Editar template ${template.event_display} ${template.channel_display}`}
                      onClick={() => setSelected(template)}
                    >
                      <Pencil className="size-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
