import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, ArrowLeft, Loader2, ShieldAlert } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { extractErrorMessage } from "@/lib/api-client";
import { cn } from "@/lib/utils";

import { getUserPermissions, setUserPermissions } from "../api";
import type { PermissionItem, UserPermissionsResponse } from "../types";

function badge(item: PermissionItem, checked: boolean) {
  if (item.inherited && checked) return { text: "Herdada", cls: "bg-muted text-muted-foreground" };
  if (!item.inherited && checked)
    return { text: "Concedida", cls: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300" };
  if (item.inherited && !checked)
    return { text: "Removida", cls: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300" };
  return null;
}

export function PermissionsMatrixPage() {
  const { id } = useParams();
  const userId = Number(id);
  const queryClient = useQueryClient();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["user-permissions", userId],
    queryFn: () => getUserPermissions(userId),
  });

  // Conjunto de códigos efetivos (marcados). Inicializado a partir da resposta.
  const [effective, setEffective] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (data) {
      const set = new Set<string>();
      for (const m of data.modules) {
        for (const p of m.permissions) if (p.effective) set.add(p.codename);
      }
      setEffective(set);
    }
  }, [data]);

  const inheritedByCode = useMemo(() => {
    const map = new Map<string, boolean>();
    data?.modules.forEach((m) =>
      m.permissions.forEach((p) => map.set(p.codename, p.inherited)),
    );
    return map;
  }, [data]);

  const mutation = useMutation({
    mutationFn: () => {
      const granted: string[] = [];
      const revoked: string[] = [];
      inheritedByCode.forEach((inherited, code) => {
        const checked = effective.has(code);
        if (checked && !inherited) granted.push(code);
        if (!checked && inherited) revoked.push(code);
      });
      return setUserPermissions(userId, { granted, revoked });
    },
    onSuccess: (updated: UserPermissionsResponse) => {
      queryClient.setQueryData(["user-permissions", userId], updated);
      toast.success("Permissões atualizadas.", { id: "perms-saved" });
    },
    onError: (error) =>
      toast.error(extractErrorMessage(error, "Não foi possível salvar as permissões.")),
  });

  function toggle(code: string, value: boolean) {
    setEffective((prev) => {
      const next = new Set(prev);
      if (value) next.add(code);
      else next.delete(code);
      return next;
    });
  }

  return (
    <div className="space-y-6">
      <Link
        to="/users"
        className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Usuários
      </Link>

      {isLoading ? (
        <Skeleton className="h-96 w-full" />
      ) : isError || !data ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
            <AlertCircle className="size-8 text-destructive" />
            <p className="text-sm text-muted-foreground">
              Não foi possível carregar as permissões.
            </p>
            <Button size="sm" variant="outline" onClick={() => refetch()}>
              Tentar novamente
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Permissões</h1>
            <p className="text-muted-foreground">
              {data.user.full_name || data.user.email} · Perfil:{" "}
              <strong>{data.user.role_name ?? "—"}</strong>. As permissões{" "}
              <em>herdadas</em> vêm do perfil; marque para <em>conceder</em> extras ou desmarque
              para <em>remover</em> individualmente.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {data.modules.map((module) => (
              <Card key={module.module}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">{module.label}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-1.5">
                  {module.permissions.map((perm) => {
                    const checked = effective.has(perm.codename);
                    const tag = badge(perm, checked);
                    return (
                      <label
                        key={perm.codename}
                        className="flex items-center justify-between gap-2 rounded-md px-1.5 py-1 text-sm hover:bg-accent/50"
                      >
                        <span className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            className="size-4 accent-primary"
                            checked={checked}
                            onChange={(e) => toggle(perm.codename, e.target.checked)}
                          />
                          <span>{perm.label}</span>
                          {perm.is_critical && (
                            <ShieldAlert
                              className="size-3.5 text-amber-600"
                              aria-label="Permissão crítica"
                            />
                          )}
                        </span>
                        {tag && (
                          <span
                            className={cn(
                              "rounded-full px-2 py-0.5 text-[10px] font-medium",
                              tag.cls,
                            )}
                          >
                            {tag.text}
                          </span>
                        )}
                      </label>
                    );
                  })}
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" asChild>
              <Link to="/users">Voltar</Link>
            </Button>
            <Button disabled={mutation.isPending} onClick={() => mutation.mutate()}>
              {mutation.isPending && <Loader2 className="animate-spin" />}
              Salvar alterações
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
