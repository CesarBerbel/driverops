import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import {
  AlertCircle,
  Car,
  Info,
  MessageCircle,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { useState } from "react";
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
import { Can } from "@/features/auth/Can";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { extractErrorMessage } from "@/lib/api-client";
import { formatPhone } from "@/lib/masks";
import { useDebouncedValue } from "@/lib/useDebouncedValue";
import { buildWhatsAppUrl } from "@/lib/whatsapp";

import { deleteVehicle, listVehicles, reactivateVehicle } from "../api";
import { VEHICLE_STATUS_OPTIONS } from "../constants";
import { formatPlateForDisplay } from "../plate";
import type { Vehicle, VehicleStatusFilter } from "../types";
import { VehicleFormSheet } from "../VehicleFormSheet";

const VEHICLES_QUERY_KEY = ["vehicles"];

export function VehiclesPage() {
  const [searchInput, setSearchInput] = useState("");
  const debouncedSearch = useDebouncedValue(searchInput, 300);
  const effectiveSearch = searchInput === "" ? "" : debouncedSearch;

  const [statusFilter, setStatusFilter] = useState<VehicleStatusFilter>("active");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingVehicleId, setEditingVehicleId] = useState<number | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Vehicle | null>(null);

  const queryClient = useQueryClient();

  const {
    data: vehicles,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: [...VEHICLES_QUERY_KEY, effectiveSearch, statusFilter],
    queryFn: () => listVehicles({ search: effectiveSearch || undefined, status: statusFilter }),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteVehicle,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: VEHICLES_QUERY_KEY });
      await queryClient.invalidateQueries({ queryKey: ["customers"] });
      toast.success("Veículo excluído.");
      setDeleteTarget(null);
    },
    onError: (error) => {
      toast.error(extractErrorMessage(error, "Não foi possível excluir o veículo."));
      setDeleteTarget(null);
    },
  });

  const reactivateMutation = useMutation({
    mutationFn: reactivateVehicle,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: VEHICLES_QUERY_KEY });
      await queryClient.invalidateQueries({ queryKey: ["customers"] });
      toast.success("Veículo reativado.");
    },
    onError: (error) => {
      toast.error(extractErrorMessage(error, "Não foi possível reativar o veículo."));
    },
  });

  const isEmpty = (vehicles?.length ?? 0) === 0;

  function openCreateSheet() {
    setEditingVehicleId(null);
    setSheetOpen(true);
  }

  function openEditSheet(id: number) {
    setEditingVehicleId(id);
    setSheetOpen(true);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Veículos</h1>
          <p className="text-muted-foreground">Gerencie os veículos vinculados aos clientes.</p>
        </div>
        <Can code="vehicles.create"><Button onClick={openCreateSheet}>
          <Plus />
          Novo veículo
        </Button></Can>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative max-w-sm flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por placa, cliente, marca ou modelo..."
            className="pl-9"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
          />
        </div>
        {searchInput && (
          <Button variant="ghost" size="sm" onClick={() => setSearchInput("")}>
            <X />
            Limpar pesquisa
          </Button>
        )}
        <Select
          value={statusFilter}
          onValueChange={(value) => setStatusFilter(value as VehicleStatusFilter)}
        >
          <SelectTrigger className="w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {VEHICLE_STATUS_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {statusFilter === "inactive" && (
        <div className="flex items-start gap-2 rounded-md border bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
          <Info className="mt-0.5 size-4 shrink-0" />
          <span>
            Estes veículos estão desabilitados e não estão disponíveis para novos vínculos.
          </span>
        </div>
      )}

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
              Não foi possível carregar os veículos. Tente novamente.
            </p>
            <Button size="sm" variant="outline" onClick={() => refetch()}>
              Tentar novamente
            </Button>
          </CardContent>
        </Card>
      ) : isEmpty ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
            <Car className="size-8 text-muted-foreground" />
            {effectiveSearch ? (
              <p className="text-sm text-muted-foreground">
                Nenhum veículo encontrado para "{effectiveSearch}".
              </p>
            ) : statusFilter === "inactive" ? (
              <p className="text-sm text-muted-foreground">Nenhum veículo desabilitado.</p>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">Nenhum veículo cadastrado ainda.</p>
                <Can code="vehicles.create"><Button size="sm" onClick={openCreateSheet}>
                  <Plus />
                  Novo veículo
                </Button></Can>
              </>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Placa</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Marca/Modelo</TableHead>
                <TableHead>Ano</TableHead>
                <TableHead className="w-0 text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {vehicles?.map((vehicle) => (
                <TableRow key={vehicle.id}>
                  <TableCell className="font-medium">
                    {formatPlateForDisplay(vehicle.license_plate)}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <span>{vehicle.customer_name}</span>
                      {vehicle.customer_whatsapp && (
                        <a
                          href={buildWhatsAppUrl(vehicle.customer_whatsapp)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-success hover:underline"
                        >
                          <MessageCircle className="size-4" />
                          {formatPhone(vehicle.customer_whatsapp)}
                        </a>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {[vehicle.brand, vehicle.model].filter(Boolean).join(" ") || "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {vehicle.model_year ?? vehicle.manufacture_year ?? "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Editar veículo"
                        onClick={() => openEditSheet(vehicle.id)}
                      >
                        <Pencil className="size-4" />
                      </Button>
                      {statusFilter !== "inactive" ? (
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label="Excluir veículo"
                          onClick={() => setDeleteTarget(vehicle)}
                        >
                          <Trash2 className="size-4 text-destructive" />
                        </Button>
                      ) : (
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label="Reativar veículo"
                          disabled={reactivateMutation.isPending}
                          onClick={() => reactivateMutation.mutate(vehicle.id)}
                        >
                          <RotateCcw className="size-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      <VehicleFormSheet open={sheetOpen} onOpenChange={setSheetOpen} vehicleId={editingVehicleId} />

      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir veículo?</AlertDialogTitle>
            <AlertDialogDescription>
              O veículo de placa "{deleteTarget ? formatPlateForDisplay(deleteTarget.license_plate) : ""}"
              será desabilitado e deixará de aparecer na listagem padrão. O histórico é preservado
              e ele pode ser reativado depois.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteMutation.isPending}
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
