import { useQuery } from "@tanstack/react-query";
import { AlertCircle, Car, MessageCircle, Search, Users, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { listVehicles } from "@/features/vehicles/api";
import { VehicleFormSheet } from "@/features/vehicles/VehicleFormSheet";
import { VehicleSelectorDialog } from "@/features/vehicles/VehicleSelectorDialog";
import type { Vehicle } from "@/features/vehicles/types";
import { formatPhone } from "@/lib/masks";
import { useDebouncedValue } from "@/lib/useDebouncedValue";
import { cn } from "@/lib/utils";
import { buildWhatsAppUrl } from "@/lib/whatsapp";

import { listCustomers } from "../api";
import { CustomerFormSheet } from "../CustomerFormSheet";
import { CUSTOMER_TYPE_LABELS } from "../constants";
import type { Customer } from "../types";

export function CustomersPage() {
  const [searchInput, setSearchInput] = useState("");
  const debouncedSearch = useDebouncedValue(searchInput, 300);
  // Bypass the debounce when the box is empty, so "Limpar pesquisa" (and
  // deleting the text manually) restores the full list instantly.
  const effectiveSearch = searchInput === "" ? "" : debouncedSearch;

  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingCustomerId, setEditingCustomerId] = useState<number | null>(null);

  const [vehicleSheetOpen, setVehicleSheetOpen] = useState(false);
  const [selectedVehicleId, setSelectedVehicleId] = useState<number | null>(null);
  const [selectorOpen, setSelectorOpen] = useState(false);
  const [selectorVehicles, setSelectorVehicles] = useState<Vehicle[]>([]);
  const [loadingVehiclesFor, setLoadingVehiclesFor] = useState<number | null>(null);

  const {
    data: customers,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["customers", effectiveSearch],
    queryFn: () => listCustomers(effectiveSearch || undefined),
  });

  const isEmpty = (customers?.length ?? 0) === 0;

  function openCreateSheet() {
    setEditingCustomerId(null);
    setSheetOpen(true);
  }

  function openEditSheet(id: number) {
    setEditingCustomerId(id);
    setSheetOpen(true);
  }

  async function handleCarIconClick(customer: Customer) {
    if (customer.vehicle_count === 0 || loadingVehiclesFor !== null) return;
    setLoadingVehiclesFor(customer.id);
    try {
      const vehicles = await listVehicles({ customerId: customer.id });
      if (vehicles.length === 1) {
        setSelectedVehicleId(vehicles[0].id);
        setVehicleSheetOpen(true);
      } else if (vehicles.length > 1) {
        setSelectorVehicles(vehicles);
        setSelectorOpen(true);
      }
    } catch {
      toast.error("Não foi possível carregar os veículos deste cliente.");
    } finally {
      setLoadingVehiclesFor(null);
    }
  }

  function handleSelectVehicleFromDialog(vehicle: Vehicle) {
    setSelectorOpen(false);
    setSelectedVehicleId(vehicle.id);
    setVehicleSheetOpen(true);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Clientes</h1>
          <p className="text-muted-foreground">Gerencie os clientes cadastrados no sistema.</p>
        </div>
        <Button onClick={openCreateSheet}>Novo cliente</Button>
      </div>

      <div className="flex items-center gap-2">
        <div className="relative max-w-sm flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar cliente pelo nome..."
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
              Não foi possível carregar os clientes. Tente novamente.
            </p>
            <Button size="sm" variant="outline" onClick={() => refetch()}>
              Tentar novamente
            </Button>
          </CardContent>
        </Card>
      ) : isEmpty ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
            <Users className="size-8 text-muted-foreground" />
            {effectiveSearch ? (
              <p className="text-sm text-muted-foreground">
                Nenhum cliente encontrado para "{effectiveSearch}".
              </p>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">Nenhum cliente cadastrado ainda.</p>
                <Button size="sm" onClick={openCreateSheet}>
                  Novo cliente
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>E-mail</TableHead>
                <TableHead>Telefone</TableHead>
                <TableHead>WhatsApp</TableHead>
                <TableHead>Cidade/UF</TableHead>
                <TableHead>Veículos</TableHead>
                <TableHead className="w-0 text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {customers?.map((customer) => (
                <TableRow key={customer.id}>
                  <TableCell className="font-medium">{customer.name}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {CUSTOMER_TYPE_LABELS[customer.customer_type]}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{customer.email || "—"}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {customer.phone ? formatPhone(customer.phone) : "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {customer.whatsapp ? (
                      <a
                        href={buildWhatsAppUrl(customer.whatsapp)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-success hover:underline"
                      >
                        <MessageCircle className="size-4" />
                        {formatPhone(customer.whatsapp)}
                      </a>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {customer.city ? `${customer.city}${customer.state ? `/${customer.state}` : ""}` : "—"}
                  </TableCell>
                  <TableCell>
                    <button
                      type="button"
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-sm",
                        customer.vehicle_count > 0
                          ? "text-foreground hover:bg-accent"
                          : "cursor-default text-muted-foreground",
                      )}
                      disabled={customer.vehicle_count === 0 || loadingVehiclesFor === customer.id}
                      onClick={() => handleCarIconClick(customer)}
                      aria-label={`${customer.vehicle_count} veículo(s) vinculados`}
                    >
                      <Car className="size-4" />
                      {customer.vehicle_count}
                    </button>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openEditSheet(customer.id)}
                    >
                      Editar
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      <CustomerFormSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        customerId={editingCustomerId}
      />

      <VehicleFormSheet
        open={vehicleSheetOpen}
        onOpenChange={setVehicleSheetOpen}
        vehicleId={selectedVehicleId}
      />

      <VehicleSelectorDialog
        open={selectorOpen}
        onOpenChange={setSelectorOpen}
        vehicles={selectorVehicles}
        onSelect={handleSelectVehicleFromDialog}
      />
    </div>
  );
}
