import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  AlertCircle,
  KeyRound,
  MoreHorizontal,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  ShieldCheck,
  Timer,
  UserX,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { useAuth } from "@/features/auth/useAuth";
import { Pagination } from "@/components/shared/Pagination";
import { extractErrorMessage } from "@/lib/api-client";
import { formatPhone } from "@/lib/masks";
import { DEFAULT_PAGE_SIZE } from "@/lib/pagination";
import { useDebouncedValue } from "@/lib/useDebouncedValue";
import { cn } from "@/lib/utils";

import {
  deactivateUser,
  forceUserPasswordChange,
  listRoles,
  listUsersPage,
  reactivateUser,
  resetUserPassword,
} from "../api";
import { TECHNICAL_SPECIALTY_OPTIONS, USER_STATUS_OPTIONS } from "../constants";
import { UserFormDialog } from "../components/UserFormDialog";
import type { ManagedUser } from "../types";

const ALL = "all";

function formatDateTime(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function UsersPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user: me } = useAuth();

  const [searchInput, setSearchInput] = useState("");
  const debounced = useDebouncedValue(searchInput, 300);
  const search = searchInput === "" ? "" : debounced;
  const [roleFilter, setRoleFilter] = useState(ALL);
  const [specialtyFilter, setSpecialtyFilter] = useState(ALL);
  const [statusFilter, setStatusFilter] = useState("active");
  const [page, setPage] = useState(1);
  // Voltar para a 1ª página sempre que um filtro/busca muda.
  useEffect(() => {
    setPage(1);
  }, [search, roleFilter, specialtyFilter, statusFilter]);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ManagedUser | null>(null);
  const [deactivateTarget, setDeactivateTarget] = useState<ManagedUser | null>(null);

  const rolesQuery = useQuery({ queryKey: ["roles"], queryFn: listRoles });

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["users", page, search, roleFilter, specialtyFilter, statusFilter],
    queryFn: () =>
      listUsersPage(page, {
        search: search || undefined,
        role: roleFilter === ALL ? undefined : roleFilter,
        specialty: specialtyFilter === ALL ? undefined : specialtyFilter,
        status: statusFilter as "active" | "inactive" | "all",
      }),
    // Mantém a página anterior visível enquanto a próxima carrega (sem "piscar").
    placeholderData: keepPreviousData,
  });
  const users = data?.results;

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["users"] });
  }
  function onError(error: unknown) {
    toast.error(extractErrorMessage(error, "Não foi possível concluir a ação."));
  }

  const deactivateMutation = useMutation({
    mutationFn: (id: number) => deactivateUser(id),
    onSuccess: () => {
      invalidate();
      setDeactivateTarget(null);
      toast.success("Usuário desativado.");
    },
    onError: (e) => {
      onError(e);
      setDeactivateTarget(null);
    },
  });
  const reactivateMutation = useMutation({
    mutationFn: (id: number) => reactivateUser(id),
    onSuccess: () => {
      invalidate();
      toast.success("Usuário reativado.");
    },
    onError,
  });
  const resetMutation = useMutation({
    mutationFn: (id: number) => resetUserPassword(id),
    onSuccess: () => toast.success("Convite de redefinição de senha enviado por e-mail."),
    onError,
  });
  const forceMutation = useMutation({
    mutationFn: (id: number) => forceUserPasswordChange(id),
    onSuccess: () => {
      invalidate();
      toast.success("O usuário terá que trocar a senha no próximo acesso.");
    },
    onError,
  });

  const isEmpty = (data?.count ?? 0) === 0;

  const hasFilters =
    Boolean(search) ||
    roleFilter !== ALL ||
    specialtyFilter !== ALL ||
    statusFilter !== "active";

  function clearFilters() {
    setSearchInput("");
    setRoleFilter(ALL);
    setSpecialtyFilter(ALL);
    setStatusFilter("active");
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Usuários</h1>
          <p className="text-muted-foreground">
            Cadastro de usuários com perfis, especialidade técnica e controle de acesso.
          </p>
        </div>
        <Button
          onClick={() => {
            setEditing(null);
            setFormOpen(true);
          }}
        >
          <Plus />
          Novo usuário
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[12rem] flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome ou e-mail..."
            className="pl-9"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
        </div>
        <Select value={roleFilter} onValueChange={setRoleFilter}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Perfil" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Todos os perfis</SelectItem>
            {rolesQuery.data?.map((role) => (
              <SelectItem key={role.id} value={role.key}>
                {role.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={specialtyFilter} onValueChange={setSpecialtyFilter}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Especialidade" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Toda especialidade</SelectItem>
            {TECHNICAL_SPECIALTY_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {USER_STATUS_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            <X />
            Limpar filtros
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : isError ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
            <AlertCircle className="size-8 text-destructive" />
            <p className="text-sm text-muted-foreground">
              Não foi possível carregar os usuários.
            </p>
            <Button size="sm" variant="outline" onClick={() => refetch()}>
              Tentar novamente
            </Button>
          </CardContent>
        </Card>
      ) : isEmpty ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Nenhum usuário encontrado.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>E-mail</TableHead>
                  <TableHead>Perfil</TableHead>
                  <TableHead>Contato</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Último acesso</TableHead>
                  <TableHead className="w-0 text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users?.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium">
                      {u.full_name || "—"}
                      {u.is_superuser && (
                        <span className="ml-2 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                          Superuser
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{u.email}</TableCell>
                    <TableCell>
                      {u.is_superuser ? (
                        <span className="text-muted-foreground">—</span>
                      ) : (
                        <div className="flex flex-col">
                          <span>{u.role_name ?? "—"}</span>
                          {u.technical_specialty_display && (
                            <span className="text-xs text-muted-foreground">
                              {u.technical_specialty_display}
                            </span>
                          )}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {u.whatsapp
                        ? formatPhone(u.whatsapp)
                        : u.phone
                          ? formatPhone(u.phone)
                          : "—"}
                    </TableCell>
                    <TableCell>
                      <span
                        className={cn(
                          "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
                          u.is_active
                            ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                            : "bg-muted text-muted-foreground",
                        )}
                      >
                        {u.is_active ? "Ativo" : "Inativo"}
                      </span>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDateTime(u.last_login)}
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" aria-label={`Ações de ${u.email}`}>
                            <MoreHorizontal className="size-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onSelect={() => {
                              setEditing(u);
                              setFormOpen(true);
                            }}
                          >
                            <Pencil className="size-4" /> Editar
                          </DropdownMenuItem>
                          {me?.is_superuser && !u.is_superuser && (
                            <DropdownMenuItem
                              onSelect={() => navigate(`/users/${u.id}/permissions`)}
                            >
                              <ShieldCheck className="size-4" /> Ver permissões
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem onSelect={() => resetMutation.mutate(u.id)}>
                            <KeyRound className="size-4" /> Redefinir senha
                          </DropdownMenuItem>
                          <DropdownMenuItem onSelect={() => forceMutation.mutate(u.id)}>
                            <Timer className="size-4" /> Forçar troca de senha
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          {u.is_active ? (
                            <DropdownMenuItem
                              variant="destructive"
                              onSelect={() => setDeactivateTarget(u)}
                            >
                              <UserX className="size-4" /> Desativar
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem onSelect={() => reactivateMutation.mutate(u.id)}>
                              <RotateCcw className="size-4" /> Reativar
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
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

      <UserFormDialog open={formOpen} onOpenChange={setFormOpen} user={editing} />

      <AlertDialog
        open={deactivateTarget !== null}
        onOpenChange={(open) => !open && setDeactivateTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Desativar usuário?</AlertDialogTitle>
            <AlertDialogDescription>
              {deactivateTarget?.email} não conseguirá mais acessar o sistema. O histórico é
              preservado e o usuário pode ser reativado depois.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deactivateMutation.isPending}
              onClick={() =>
                deactivateTarget && deactivateMutation.mutate(deactivateTarget.id)
              }
            >
              Desativar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
