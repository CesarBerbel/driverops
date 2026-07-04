import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, UserPlus } from "lucide-react";
import { useRef, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";

import { CustomerCombobox } from "@/components/shared/CustomerCombobox";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { extractErrorMessage } from "@/lib/api-client";
import { onlyDigits } from "@/lib/masks";
import { CustomerFormSheet } from "@/features/customers/CustomerFormSheet";
import type { Customer } from "@/features/customers/types";

import { createVehicle, getVehicle, updateVehicle } from "./api";
import {
  DOORS_OPTIONS,
  FUEL_TYPE_OPTIONS,
  STEERING_OPTIONS,
  TRANSMISSION_OPTIONS,
  TRI_STATE_OPTIONS,
  UNSPECIFIED,
  USAGE_CATEGORY_OPTIONS,
  VEHICLE_TYPE_OPTIONS,
} from "./constants";
import { normalizePlate } from "./plate";
import { vehicleSchema, type VehicleFormValues } from "./schemas";
import type { Vehicle, VehiclePayload } from "./types";

const EMPTY_VALUES: VehicleFormValues = {
  customer_id: null,
  license_plate: "",
  brand: "",
  model: "",
  version: "",
  manufacture_year: "",
  model_year: "",
  color: "",
  mileage: "",
  fuel_type: "",
  transmission: "",
  steering: "",
  doors: "",
  air_conditioning: "",
  is_modified: "",
  modification_notes: "",
  vehicle_type: "",
  usage_category: "",
  chassis: "",
  renavam: "",
  fipe_code: "",
  notes: "",
};

function toFormValues(vehicle: Vehicle): VehicleFormValues {
  return {
    customer_id: vehicle.customer,
    license_plate: vehicle.license_plate,
    brand: vehicle.brand,
    model: vehicle.model,
    version: vehicle.version,
    manufacture_year: vehicle.manufacture_year !== null ? String(vehicle.manufacture_year) : "",
    model_year: vehicle.model_year !== null ? String(vehicle.model_year) : "",
    color: vehicle.color,
    mileage: vehicle.mileage !== null ? String(vehicle.mileage) : "",
    fuel_type: vehicle.fuel_type,
    transmission: vehicle.transmission,
    steering: vehicle.steering,
    doors: vehicle.doors !== null ? String(vehicle.doors) : "",
    air_conditioning: vehicle.air_conditioning === null ? "" : String(vehicle.air_conditioning),
    is_modified: vehicle.is_modified === null ? "" : String(vehicle.is_modified),
    modification_notes: vehicle.modification_notes,
    vehicle_type: vehicle.vehicle_type,
    usage_category: vehicle.usage_category,
    chassis: vehicle.chassis,
    renavam: vehicle.renavam,
    fipe_code: vehicle.fipe_code,
    notes: vehicle.notes,
  };
}

function toPayload(values: VehicleFormValues): Partial<VehiclePayload> {
  return {
    customer: values.customer_id as number,
    license_plate: values.license_plate,
    brand: values.brand,
    model: values.model,
    version: values.version,
    manufacture_year: values.manufacture_year ? Number(values.manufacture_year) : null,
    model_year: values.model_year ? Number(values.model_year) : null,
    color: values.color,
    mileage: values.mileage ? Number(values.mileage) : null,
    fuel_type: values.fuel_type as VehiclePayload["fuel_type"],
    transmission: values.transmission as VehiclePayload["transmission"],
    steering: values.steering as VehiclePayload["steering"],
    doors: values.doors ? Number(values.doors) : null,
    air_conditioning: values.air_conditioning === "" ? null : values.air_conditioning === "true",
    is_modified: values.is_modified === "" ? null : values.is_modified === "true",
    modification_notes: values.modification_notes,
    vehicle_type: values.vehicle_type as VehiclePayload["vehicle_type"],
    usage_category: values.usage_category as VehiclePayload["usage_category"],
    chassis: values.chassis,
    renavam: values.renavam,
    fipe_code: values.fipe_code,
    notes: values.notes,
  };
}

interface VehicleFormSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vehicleId: number | null;
  // Fired with the saved vehicle -- lets a caller (e.g. inline creation from an
  // Ordem de Serviço) grab the new record and auto-select it.
  onCreated?: (vehicle: Vehicle) => void;
  // When creating, pre-link (and lock) the customer -- used when the OS already
  // knows which customer the new vehicle belongs to.
  defaultCustomerId?: number | null;
  defaultCustomerName?: string;
}

export function VehicleFormSheet({
  open,
  onOpenChange,
  vehicleId,
  onCreated,
  defaultCustomerId,
  defaultCustomerName,
}: VehicleFormSheetProps) {
  const isEditMode = vehicleId !== null;

  const { data: vehicle } = useQuery({
    queryKey: ["vehicles", vehicleId],
    queryFn: () => getVehicle(vehicleId as number),
    enabled: isEditMode && open,
  });

  // Gate on the data itself, not `isLoading` -- see CustomerFormSheet for why:
  // isLoading can read false for one render right after `enabled` flips true.
  const isWaitingForData = isEditMode && !vehicle;

  const createDefaults: VehicleFormValues =
    defaultCustomerId != null
      ? { ...EMPTY_VALUES, customer_id: defaultCustomerId }
      : EMPTY_VALUES;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-2xl">
        <SheetHeader className="shrink-0 border-b">
          <SheetTitle>{isEditMode ? "Editar veículo" : "Novo veículo"}</SheetTitle>
          <SheetDescription>
            Apenas o cliente e a placa são obrigatórios -- os demais dados podem ser completados
            depois.
          </SheetDescription>
        </SheetHeader>

        {isWaitingForData ? (
          <div className="flex-1 space-y-4 overflow-y-auto p-6">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
        ) : (
          <VehicleForm
            key={vehicleId ?? "create"}
            vehicleId={vehicleId}
            defaultValues={vehicle ? toFormValues(vehicle) : createDefaults}
            defaultCustomerName={vehicle?.customer_name ?? defaultCustomerName ?? ""}
            onClose={() => onOpenChange(false)}
            onCreated={onCreated}
            allowAddAnother={!isEditMode && !onCreated}
          />
        )}
      </SheetContent>
    </Sheet>
  );
}

function VehicleForm({
  vehicleId,
  defaultValues,
  defaultCustomerName,
  onClose,
  onCreated,
  allowAddAnother,
}: {
  vehicleId: number | null;
  defaultValues: VehicleFormValues;
  defaultCustomerName: string;
  onClose: () => void;
  onCreated?: (vehicle: Vehicle) => void;
  allowAddAnother?: boolean;
}) {
  const queryClient = useQueryClient();
  const isEditMode = vehicleId !== null;
  const [customerName, setCustomerName] = useState(defaultCustomerName);
  const [customerSheetOpen, setCustomerSheetOpen] = useState(false);
  const addAnotherRef = useRef(false);

  const {
    control,
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<VehicleFormValues>({
    resolver: zodResolver(vehicleSchema),
    defaultValues,
  });

  const isModified = watch("is_modified");

  const mutation = useMutation({
    mutationFn: (values: VehicleFormValues) => {
      const payload = toPayload(values);
      return isEditMode ? updateVehicle(vehicleId, payload) : createVehicle(payload);
    },
    onSuccess: async (saved) => {
      await queryClient.invalidateQueries({ queryKey: ["vehicles"] });
      await queryClient.invalidateQueries({ queryKey: ["customers"] });
      toast.success(isEditMode ? "Veículo atualizado." : "Veículo criado.");
      if (addAnotherRef.current) {
        addAnotherRef.current = false;
        reset(EMPTY_VALUES);
        setCustomerName("");
        return;
      }
      onCreated?.(saved);
      onClose();
    },
    onError: (error) => {
      toast.error(extractErrorMessage(error, "Não foi possível salvar o veículo."));
    },
  });

  function handleSelectCustomer(customer: Customer) {
    setValue("customer_id", customer.id, { shouldValidate: true, shouldDirty: true });
    setCustomerName(customer.name);
  }

  function handleClearCustomer() {
    setValue("customer_id", null, { shouldValidate: true, shouldDirty: true });
    setCustomerName("");
  }

  return (
    <form
      onSubmit={(event) => {
        // Stop the submit from bubbling to an ancestor form when this sheet is
        // opened inline (e.g. from an Ordem de Serviço) -- React re-dispatches
        // bubbling events through the portal along the component tree.
        event.stopPropagation();
        handleSubmit((values) => mutation.mutate(values))(event);
      }}
      className="flex flex-1 flex-col overflow-hidden"
      noValidate
    >
      <div className="flex-1 space-y-6 overflow-y-auto p-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Cliente</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="customer_id">Cliente responsável</Label>
                <Button
                  type="button"
                  variant="link"
                  size="sm"
                  className="h-auto p-0 text-xs"
                  onClick={() => setCustomerSheetOpen(true)}
                >
                  <UserPlus className="size-3" />
                  Adicionar cliente
                </Button>
              </div>
              <CustomerCombobox
                selectedName={customerName}
                onSelect={handleSelectCustomer}
                onClear={handleClearCustomer}
                invalid={Boolean(errors.customer_id)}
              />
              {errors.customer_id && (
                <p className="text-sm text-destructive">{errors.customer_id.message}</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Identificação</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="license_plate">Placa</Label>
              <Controller
                control={control}
                name="license_plate"
                render={({ field }) => (
                  <Input
                    id="license_plate"
                    placeholder="ABC1234"
                    value={field.value}
                    onChange={(event) => field.onChange(normalizePlate(event.target.value))}
                    aria-invalid={Boolean(errors.license_plate)}
                  />
                )}
              />
              {errors.license_plate && (
                <p className="text-sm text-destructive">{errors.license_plate.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="brand">Marca</Label>
              <Input id="brand" {...register("brand")} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="model">Modelo</Label>
              <Input id="model" {...register("model")} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="version">Versão</Label>
              <Input id="version" {...register("version")} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="color">Cor</Label>
              <Input id="color" {...register("color")} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="vehicle_type">Tipo de veículo</Label>
              <Controller
                control={control}
                name="vehicle_type"
                render={({ field }) => (
                  <Select
                    value={field.value || UNSPECIFIED}
                    onValueChange={(value) =>
                      field.onChange(value === UNSPECIFIED ? "" : value)
                    }
                  >
                    <SelectTrigger id="vehicle_type" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={UNSPECIFIED}>Não informado</SelectItem>
                      {VEHICLE_TYPE_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="usage_category">Categoria de uso</Label>
              <Controller
                control={control}
                name="usage_category"
                render={({ field }) => (
                  <Select
                    value={field.value || UNSPECIFIED}
                    onValueChange={(value) =>
                      field.onChange(value === UNSPECIFIED ? "" : value)
                    }
                  >
                    <SelectTrigger id="usage_category" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={UNSPECIFIED}>Não informado</SelectItem>
                      {USAGE_CATEGORY_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Especificações</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="manufacture_year">Ano de fabricação</Label>
              <Controller
                control={control}
                name="manufacture_year"
                render={({ field }) => (
                  <Input
                    id="manufacture_year"
                    inputMode="numeric"
                    value={field.value}
                    onChange={(event) =>
                      field.onChange(onlyDigits(event.target.value).slice(0, 4))
                    }
                    aria-invalid={Boolean(errors.manufacture_year)}
                  />
                )}
              />
              {errors.manufacture_year && (
                <p className="text-sm text-destructive">{errors.manufacture_year.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="model_year">Ano do modelo</Label>
              <Controller
                control={control}
                name="model_year"
                render={({ field }) => (
                  <Input
                    id="model_year"
                    inputMode="numeric"
                    value={field.value}
                    onChange={(event) =>
                      field.onChange(onlyDigits(event.target.value).slice(0, 4))
                    }
                    aria-invalid={Boolean(errors.model_year)}
                  />
                )}
              />
              {errors.model_year && (
                <p className="text-sm text-destructive">{errors.model_year.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="mileage">Quilometragem</Label>
              <Controller
                control={control}
                name="mileage"
                render={({ field }) => (
                  <Input
                    id="mileage"
                    inputMode="numeric"
                    value={field.value}
                    onChange={(event) => field.onChange(onlyDigits(event.target.value))}
                  />
                )}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="doors">Portas</Label>
              <Controller
                control={control}
                name="doors"
                render={({ field }) => (
                  <Select
                    value={field.value || UNSPECIFIED}
                    onValueChange={(value) =>
                      field.onChange(value === UNSPECIFIED ? "" : value)
                    }
                  >
                    <SelectTrigger id="doors" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={UNSPECIFIED}>Não informado</SelectItem>
                      {DOORS_OPTIONS.map((doors) => (
                        <SelectItem key={doors} value={String(doors)}>
                          {doors}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="fuel_type">Combustível</Label>
              <Controller
                control={control}
                name="fuel_type"
                render={({ field }) => (
                  <Select
                    value={field.value || UNSPECIFIED}
                    onValueChange={(value) =>
                      field.onChange(value === UNSPECIFIED ? "" : value)
                    }
                  >
                    <SelectTrigger id="fuel_type" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={UNSPECIFIED}>Não informado</SelectItem>
                      {FUEL_TYPE_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="transmission">Câmbio</Label>
              <Controller
                control={control}
                name="transmission"
                render={({ field }) => (
                  <Select
                    value={field.value || UNSPECIFIED}
                    onValueChange={(value) =>
                      field.onChange(value === UNSPECIFIED ? "" : value)
                    }
                  >
                    <SelectTrigger id="transmission" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={UNSPECIFIED}>Não informado</SelectItem>
                      {TRANSMISSION_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="steering">Direção</Label>
              <Controller
                control={control}
                name="steering"
                render={({ field }) => (
                  <Select
                    value={field.value || UNSPECIFIED}
                    onValueChange={(value) =>
                      field.onChange(value === UNSPECIFIED ? "" : value)
                    }
                  >
                    <SelectTrigger id="steering" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={UNSPECIFIED}>Não informado</SelectItem>
                      {STEERING_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="air_conditioning">Ar-condicionado</Label>
              <Controller
                control={control}
                name="air_conditioning"
                render={({ field }) => (
                  <Select
                    value={field.value || UNSPECIFIED}
                    onValueChange={(value) =>
                      field.onChange(value === UNSPECIFIED ? "" : value)
                    }
                  >
                    <SelectTrigger id="air_conditioning" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={UNSPECIFIED}>Não informado</SelectItem>
                      {TRI_STATE_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="is_modified">Veículo modificado</Label>
              <Controller
                control={control}
                name="is_modified"
                render={({ field }) => (
                  <Select
                    value={field.value || UNSPECIFIED}
                    onValueChange={(value) =>
                      field.onChange(value === UNSPECIFIED ? "" : value)
                    }
                  >
                    <SelectTrigger id="is_modified" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={UNSPECIFIED}>Não informado</SelectItem>
                      {TRI_STATE_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>

            {isModified === "true" && (
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="modification_notes">Observações da modificação</Label>
                <Textarea id="modification_notes" rows={3} {...register("modification_notes")} />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="chassis">Chassi</Label>
              <Controller
                control={control}
                name="chassis"
                render={({ field }) => (
                  <Input
                    id="chassis"
                    value={field.value}
                    onChange={(event) =>
                      field.onChange(event.target.value.toUpperCase().replace(/\s/g, ""))
                    }
                  />
                )}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="renavam">RENAVAM</Label>
              <Controller
                control={control}
                name="renavam"
                render={({ field }) => (
                  <Input
                    id="renavam"
                    inputMode="numeric"
                    value={field.value}
                    onChange={(event) => field.onChange(onlyDigits(event.target.value))}
                  />
                )}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="fipe_code">Código FIPE</Label>
              <Input id="fipe_code" {...register("fipe_code")} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Observações</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea id="notes" rows={4} {...register("notes")} />
          </CardContent>
        </Card>
      </div>

      <SheetFooter className="flex-row justify-end gap-2 border-t">
        <Button type="button" variant="outline" onClick={onClose}>
          Cancelar
        </Button>
        {allowAddAnother && (
          <Button
            type="submit"
            variant="secondary"
            disabled={isSubmitting || mutation.isPending}
            onClick={() => {
              addAnotherRef.current = true;
            }}
          >
            Salvar e adicionar outro
          </Button>
        )}
        <Button
          type="submit"
          disabled={isSubmitting || mutation.isPending}
          onClick={() => {
            addAnotherRef.current = false;
          }}
        >
          {(isSubmitting || mutation.isPending) && <Loader2 className="animate-spin" />}
          Salvar
        </Button>
      </SheetFooter>

      {/* Cadastro inline de cliente -- volta selecionado sem perder os dados do veículo. */}
      <CustomerFormSheet
        open={customerSheetOpen}
        onOpenChange={setCustomerSheetOpen}
        customerId={null}
        onCreated={handleSelectCustomer}
      />
    </form>
  );
}
