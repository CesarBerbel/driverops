import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Pagination } from "@/components/shared/Pagination";
import { DEFAULT_PAGE_SIZE } from "@/lib/pagination";

import { listAuditPage } from "../api";

const ACTION_LABELS: Record<string, string> = {
  "user.create": "Usuário criado",
  "user.update": "Usuário editado",
  "user.deactivate": "Usuário desativado",
  "user.reactivate": "Usuário reativado",
  "user.reset_password": "Senha redefinida",
  "user.force_password_change": "Troca de senha forçada",
  "permission.set": "Permissões alteradas",
};

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function AuditPage() {
  const [page, setPage] = useState(1);
  const { data, isLoading, isError } = useQuery({
    queryKey: ["audit", page],
    queryFn: () => listAuditPage(page),
    // Mantém a página anterior visível enquanto a próxima carrega (sem "piscar").
    placeholderData: keepPreviousData,
  });
  const entries = data?.results;
  const isEmpty = (data?.count ?? 0) === 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Auditoria</h1>
        <p className="text-muted-foreground">
          Registro das ações sensíveis de usuários e permissões (200 mais recentes).
        </p>
      </div>

      {isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : isEmpty ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Nenhum registro de auditoria ainda.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data/hora</TableHead>
                  <TableHead>Ação</TableHead>
                  <TableHead>Responsável</TableHead>
                  <TableHead>Usuário afetado</TableHead>
                  <TableHead>IP</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries?.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell className="whitespace-nowrap text-muted-foreground">
                      {formatDateTime(entry.created_at)}
                    </TableCell>
                    <TableCell>{ACTION_LABELS[entry.action] ?? entry.action}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {entry.actor_email ?? "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {entry.target_email ?? "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{entry.ip ?? "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}

      {!isLoading && !isError && !isEmpty && (
        <Pagination
          page={page}
          pageSize={DEFAULT_PAGE_SIZE}
          count={data?.count ?? 0}
          onPageChange={setPage}
        />
      )}
    </div>
  );
}
