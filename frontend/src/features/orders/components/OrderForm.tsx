import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Car, Loader2, MessageCircle, Plus, UserPlus } from "lucide-react";
import { useEffect, useState } from "react";
import { Controller, useFieldArray, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";

import { CurrencyInput } from "@/components/shared/CurrencyInput";
import { CustomerCombobox } from "@/components/shared/CustomerCombobox";
import { PackageCombobox } from "@/components/shared/PackageCombobox";
import { PartCombobox } from "@/components/shared/PartCombobox";
import { ServiceCombobox } from "@/components/shared/ServiceCombobox";
import { VehicleCombobox } from "@/components/shared/VehicleCombobox";
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
import { Textarea } from "@/components/ui/textarea";
import { CustomerFormSheet } from "@/features/customers/CustomerFormSheet";
import type { Customer } from "@/features/customers/types";
import type { Part } from "@/features/parts/types";
import { PartQuickCreateDialog } from "@/features/parts/components/PartQuickCreateDialog";
import { PackageQuickCreateDialog } from "@/features/services/components/PackageQuickCreateDialog";
import { ServiceQuickCreateDialog } from "@/features/services/components/ServiceQuickCreateDialog";
import type { Service, ServicePackage } from "@/features/services/types";
import { listVehicles } from "@/features/vehicles/api";
import { formatPlateForDisplay } from "@/features/vehicles/plate";
import type { Vehicle } from "@/features/vehicles/types";
import { VehicleFormSheet } from "@/features/vehicles/VehicleFormSheet";
import { VehicleSelectorDialog } from "@/features/vehicles/VehicleSelectorDialog";
import { getOrderSettings } from "@/features/settings/api";
import { extractErrorMessage } from "@/lib/api-client";
import {
  formatCurrencyBRL,
  formatPhone,
  formatQuantityBRL,
  onlyDigits,
  parseCurrencyBRL,
  parsePercent,
} from "@/lib/masks";
import { buildWhatsAppUrl } from "@/lib/whatsapp";

import { createWorkOrder, listTechnicians, updateWorkOrder } from "../api";
import { DISCOUNT_TYPE_OPTIONS, ORDER_STATUS_OPTIONS } from "../constants";
import {
  addDaysISO,
  EMPTY_ORDER_VALUES,
  lineSubtotal,
  toFormValues,
  toPayload,
} from "../lib/orderMapping";
import { orderSchema, type OrderFormValues } from "../schemas";
import type { OrderDiscountType, WorkOrder } from "../types";
import { OrderLineList } from "./OrderLineList";

function percentInput(value: string): string {
  const cleaned = value.replace(/[^\d,]/g, "");
  const firstComma = cleaned.indexOf(",");
  if (firstComma === -1) return cleaned;
  return cleaned.slice(0, firstComma + 1) + cleaned.slice(firstComma + 1).replace(/,/g, "");
}

function vehicleLabelOf(vehicle: Vehicle): string {
  const desc = [vehicle.brand, vehicle.model].filter(Boolean).join(" ");
  const plate = formatPlateForDisplay(vehicle.license_plate);
  return desc ? `${plate} · ${desc}` : plate;
}

interface OrderFormProps {
  order: WorkOrder | null;
  onSuccess: () => void;
  onCancel: () => void;
}

export function OrderForm({ order, onSuccess, onCancel }: OrderFormProps) {
  const queryClient = useQueryClient();
  const isEditMode = order !== null;

  const [customerName, setCustomerName] = useState(order?.customer_name ?? "");
  const [customerWhatsapp, setCustomerWhatsapp] = useState(order?.customer_whatsapp ?? "");
  const [vehicleLabel, setVehicleLabel] = useState(
    order ? `${formatPlateForDisplay(order.vehicle_plate)}${order.vehicle_description ? ` · ${order.vehicle_description}` : ""}` : "",
  );

  const [customerSheetOpen, setCustomerSheetOpen] = useState(false);
  const [vehicleSheetOpen, setVehicleSheetOpen] = useState(false);
  const [serviceDialogOpen, setServiceDialogOpen] = useState(false);
  const [packageDialogOpen, setPackageDialogOpen] = useState(false);
  const [partDialogOpen, setPartDialogOpen] = useState(false);
  const [selectorVehicles, setSelectorVehicles] = useState<Vehicle[]>([]);
  const [selectorOpen, setSelectorOpen] = useState(false);

  const {
    control,
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<OrderFormValues>({
    resolver: zodResolver(orderSchema),
    defaultValues: order ? toFormValues(order) : EMPTY_ORDER_VALUES,
  });

  const serviceArray = useFieldArray({ control, name: "service_items" });
  const packageArray = useFieldArray({ control, name: "package_items" });
  const partArray = useFieldArray({ control, name: "part_items" });

  const techniciansQuery = useQuery({
    queryKey: ["technicians"],
    queryFn: listTechnicians,
  });
  const technicians = techniciansQuery.data ?? [];

  const customerId = useWatch({ control, name: "customer_id" });
  const vehicleId = useWatch({ control, name: "vehicle_id" });
  const watchedServices = useWatch({ control, name: "service_items" });
  const watchedPackages = useWatch({ control, name: "package_items" });
  const watchedParts = useWatch({ control, name: "part_items" });
  const discountType = useWatch({ control, name: "discount_type" });
  const discountValue = useWatch({ control, name: "discount_value" });
  const openedAt = useWatch({ control, name: "opened_at" });

  // Prefill the expected delivery from the global default deadline (data de
  // abertura + prazo padrão) on new OS, until the user edits it by hand. Editing
  // the global default never touches an existing OS (fetch is create-only).
  const [deliveryTouched, setDeliveryTouched] = useState(isEditMode);
  const orderSettingsQuery = useQuery({
    queryKey: ["order-settings"],
    queryFn: getOrderSettings,
    enabled: !isEditMode,
  });
  const defaultDeliveryDays = orderSettingsQuery.data?.default_delivery_days;
  useEffect(() => {
    if (isEditMode || deliveryTouched || defaultDeliveryDays == null || !openedAt) return;
    setValue("expected_delivery", addDaysISO(openedAt, defaultDeliveryDays));
  }, [isEditMode, deliveryTouched, defaultDeliveryDays, openedAt, setValue]);

  // Opções do select "Serviço vinculado" das peças (por índice na lista de serviços).
  const serviceLinkOptions = (watchedServices ?? []).map((line, index) => ({
    index,
    label: line.name?.trim() || `Serviço ${index + 1}`,
  }));

  const servicesTotal = (watchedServices ?? []).reduce((sum, l) => sum + lineSubtotal(l), 0);
  const packagesTotal = (watchedPackages ?? []).reduce((sum, l) => sum + lineSubtotal(l), 0);
  const partsTotal = (watchedParts ?? []).reduce((sum, l) => sum + lineSubtotal(l), 0);
  const grossTotal = servicesTotal + packagesTotal + partsTotal;
  let discount = 0;
  if (discountType === "percent") {
    discount = (grossTotal * (parsePercent(discountValue ?? "") ?? 0)) / 100;
  } else if (discountType === "fixed") {
    discount = parseCurrencyBRL(discountValue ?? "") ?? 0;
  }
  const finalValue = Math.max(0, grossTotal - discount);

  const mutation = useMutation({
    mutationFn: (values: OrderFormValues) => {
      const payload = toPayload(values);
      return isEditMode ? updateWorkOrder(order.id, payload) : createWorkOrder(payload);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["work-orders"] });
      toast.success(isEditMode ? "Ordem de serviço atualizada." : "Ordem de serviço criada.");
      onSuccess();
    },
    onError: (error) => {
      toast.error(extractErrorMessage(error, "Não foi possível salvar a ordem de serviço."));
    },
  });

  // --- vehicle / customer linking ---

  function selectVehicle(vehicle: Vehicle) {
    setValue("vehicle_id", vehicle.id, { shouldValidate: true, shouldDirty: true });
    setVehicleLabel(vehicleLabelOf(vehicle));
    setValue("customer_id", vehicle.customer, { shouldValidate: true, shouldDirty: true });
    setCustomerName(vehicle.customer_name);
    setCustomerWhatsapp(vehicle.customer_whatsapp);
  }

  function clearVehicle() {
    setValue("vehicle_id", null, { shouldValidate: true, shouldDirty: true });
    setVehicleLabel("");
  }

  async function loadCustomerVehicles(id: number) {
    try {
      const vehicles = await listVehicles({ customerId: id, status: "active" });
      if (vehicles.length === 1) {
        selectVehicle(vehicles[0]);
      } else if (vehicles.length > 1) {
        setSelectorVehicles(vehicles);
        setSelectorOpen(true);
      }
    } catch {
      // Non-fatal: the user can still search the vehicle by plate.
    }
  }

  function selectCustomer(customer: Customer) {
    setValue("customer_id", customer.id, { shouldValidate: true, shouldDirty: true });
    setCustomerName(customer.name);
    setCustomerWhatsapp(customer.whatsapp);
    // Keep vehicle/customer consistent: drop a vehicle from another customer.
    if (vehicleId != null) clearVehicle();
    void loadCustomerVehicles(customer.id);
  }

  function clearCustomer() {
    setValue("customer_id", null, { shouldValidate: true, shouldDirty: true });
    setCustomerName("");
    setCustomerWhatsapp("");
    clearVehicle();
  }

  // --- item helpers ---

  function addService(service: Service) {
    serviceArray.append({
      ref_id: service.id,
      name: service.name,
      quantity: "1",
      unit_price: formatCurrencyBRL(Number(service.labor_cost)),
    });
    if (service.standard_parts.length > 0) {
      for (const sp of service.standard_parts) {
        partArray.append({
          ref_id: sp.part,
          name: sp.part_name,
          quantity: formatQuantityBRL(Number(sp.suggested_quantity)),
          unit_price: "",
        });
      }
      toast("Peças padrão do serviço adicionadas. Ajuste o valor ou remova conforme necessário.");
    }
  }

  function addPackage(servicePackage: ServicePackage) {
    packageArray.append({
      ref_id: servicePackage.id,
      name: servicePackage.name,
      quantity: "1",
      unit_price: formatCurrencyBRL(Number(servicePackage.final_value)),
    });
  }

  function addPart(part: Part) {
    partArray.append({
      ref_id: part.id,
      name: part.name,
      quantity: "1",
      unit_price: formatCurrencyBRL(Number(part.sale_price ?? 0)),
    });
  }

  const addCustom = (append: (v: OrderFormValues["service_items"][number]) => void) => () =>
    append({ ref_id: null, name: "", quantity: "1", unit_price: "" });

  function handleDiscountTypeChange(value: OrderDiscountType) {
    setValue("discount_type", value, { shouldDirty: true });
    setValue("discount_value", "", { shouldDirty: true });
  }

  return (
    <form
      onSubmit={handleSubmit((values) => mutation.mutate(values))}
      className="space-y-6"
      noValidate
    >
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 lg:items-start">
        {/* Coluna esquerda: identificação, veículo (antes do cliente), cliente, relato, diagnóstico. */}
        <div className="space-y-6">
      {/* 1. Dados principais */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Dados principais</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="opened_at">Data de abertura</Label>
            <Input
              id="opened_at"
              type="date"
              aria-invalid={Boolean(errors.opened_at)}
              {...register("opened_at")}
            />
            {errors.opened_at && (
              <p className="text-sm text-destructive">{errors.opened_at.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="expected_delivery">Previsão de entrega</Label>
            <Controller
              control={control}
              name="expected_delivery"
              render={({ field }) => (
                <Input
                  id="expected_delivery"
                  type="date"
                  value={field.value ?? ""}
                  onChange={(event) => {
                    // A manual edit stops the automatic prefill from overriding it.
                    setDeliveryTouched(true);
                    field.onChange(event.target.value);
                  }}
                />
              )}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="current_mileage">Quilometragem atual</Label>
            <Controller
              control={control}
              name="current_mileage"
              render={({ field }) => (
                <Input
                  id="current_mileage"
                  inputMode="numeric"
                  placeholder="Ex.: 85000"
                  value={field.value ? formatQuantityBRL(Number(onlyDigits(field.value))) : ""}
                  onChange={(event) => field.onChange(onlyDigits(event.target.value))}
                />
              )}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="status">Status da OS</Label>
            <Controller
              control={control}
              name="status"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="status" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ORDER_STATUS_OPTIONS.map((option) => (
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
            <Label htmlFor="assigned_technician">Técnico responsável</Label>
            <Controller
              control={control}
              name="assigned_technician_id"
              render={({ field }) => (
                <Select
                  value={field.value == null ? "none" : String(field.value)}
                  onValueChange={(value) =>
                    field.onChange(value === "none" ? null : Number(value))
                  }
                >
                  <SelectTrigger id="assigned_technician" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sem técnico</SelectItem>
                    {technicians.map((tech) => (
                      <SelectItem key={tech.id} value={String(tech.id)}>
                        {tech.name}
                        {tech.technical_specialty_display
                          ? ` · ${tech.technical_specialty_display}`
                          : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>
        </CardContent>
      </Card>

      {/* 2. Veículo (antes do cliente -- a placa é a prioridade operacional) */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Veículo</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <Label htmlFor="vehicle_id">Placa do veículo</Label>
            {!isEditMode && (
              <Button
                type="button"
                variant="link"
                size="sm"
                className="h-auto p-0 text-xs"
                onClick={() => setVehicleSheetOpen(true)}
              >
                <Car className="size-3" />
                Adicionar veículo
              </Button>
            )}
          </div>
          <VehicleCombobox
            selectedLabel={vehicleLabel}
            onSelect={selectVehicle}
            onClear={clearVehicle}
            customerId={customerId}
            disabled={isEditMode}
            invalid={Boolean(errors.vehicle_id)}
          />
          {isEditMode && (
            <p className="text-xs text-muted-foreground">
              O veículo não pode ser alterado após a abertura da OS.
            </p>
          )}
          {errors.vehicle_id && (
            <p className="text-sm text-destructive">{errors.vehicle_id.message}</p>
          )}
          {!isEditMode && customerId != null && vehicleId == null && (
            <p className="text-xs text-muted-foreground">
              Este cliente ainda não tem veículo selecionado. Busque pela placa ou cadastre um
              novo veículo.
            </p>
          )}
        </CardContent>
      </Card>

      {/* 3. Cliente (preenchido automaticamente ao escolher o veículo) */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Cliente</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <Label htmlFor="customer_id">Cliente</Label>
            {!isEditMode && (
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
            )}
          </div>
          <CustomerCombobox
            selectedName={customerName}
            onSelect={selectCustomer}
            onClear={clearCustomer}
            disabled={isEditMode}
            invalid={Boolean(errors.customer_id)}
          />
          {isEditMode && (
            <p className="text-xs text-muted-foreground">
              O cliente não pode ser alterado após a abertura da OS.
            </p>
          )}
          {errors.customer_id && (
            <p className="text-sm text-destructive">{errors.customer_id.message}</p>
          )}
          {customerName && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              {customerWhatsapp ? (
                <a
                  href={buildWhatsAppUrl(customerWhatsapp)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-success hover:underline"
                >
                  <MessageCircle className="size-4" />
                  {formatPhone(customerWhatsapp)}
                </a>
              ) : (
                <span>WhatsApp não informado</span>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 4. Relato do cliente */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Relato do cliente</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            id="customer_report"
            rows={3}
            aria-label="Relato do cliente"
            aria-invalid={Boolean(errors.customer_report)}
            {...register("customer_report")}
          />
          {errors.customer_report && (
            <p className="mt-2 text-sm text-destructive">{errors.customer_report.message}</p>
          )}
        </CardContent>
      </Card>

      {/* 5. Diagnóstico */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Diagnóstico técnico</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea id="diagnosis" rows={3} aria-label="Diagnóstico" {...register("diagnosis")} />
        </CardContent>
      </Card>

      {/* Observações internas (coluna esquerda) */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Observações internas</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            id="internal_notes"
            rows={3}
            aria-label="Observações internas"
            {...register("internal_notes")}
          />
        </CardContent>
      </Card>
        </div>

        {/* Coluna direita: itens (serviços/pacotes/peças) e valores. */}
        <div className="space-y-6">
      {/* 6. Serviços */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Serviços</CardTitle>
        </CardHeader>
        <CardContent>
          <OrderLineList
            title="Serviços cadastrados ou avulsos"
            helper="Adicione serviços do catálogo, cadastre um novo ou informe um serviço avulso."
            namePrefix="service_items"
            control={control}
            register={register}
            fields={serviceArray.fields}
            watchedItems={watchedServices}
            remove={serviceArray.remove}
            errors={errors.service_items}
            picker={<ServiceCombobox onSelect={addService} />}
            inlineCreate={
              <Button
                type="button"
                variant="link"
                size="sm"
                className="h-auto p-0 text-xs"
                onClick={() => setServiceDialogOpen(true)}
              >
                <Plus className="size-3" />
                Novo serviço
              </Button>
            }
            onAddCustom={addCustom(serviceArray.append)}
            customLabel="Serviço avulso"
            emptyLabel="Nenhum serviço adicionado ainda."
          />
        </CardContent>
      </Card>

      {/* 7. Pacotes de serviços */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Pacotes de serviços</CardTitle>
        </CardHeader>
        <CardContent>
          <OrderLineList
            title="Pacotes cadastrados ou avulsos"
            namePrefix="package_items"
            control={control}
            register={register}
            fields={packageArray.fields}
            watchedItems={watchedPackages}
            remove={packageArray.remove}
            errors={errors.package_items}
            picker={<PackageCombobox onSelect={addPackage} />}
            inlineCreate={
              <Button
                type="button"
                variant="link"
                size="sm"
                className="h-auto p-0 text-xs"
                onClick={() => setPackageDialogOpen(true)}
              >
                <Plus className="size-3" />
                Novo pacote
              </Button>
            }
            onAddCustom={addCustom(packageArray.append)}
            customLabel="Pacote avulso"
            emptyLabel="Nenhum pacote adicionado ainda."
          />
        </CardContent>
      </Card>

      {/* 8. Peças utilizadas */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Peças utilizadas</CardTitle>
        </CardHeader>
        <CardContent>
          <OrderLineList
            title="Peças cadastradas ou avulsas"
            helper="Adicione peças do catálogo, cadastre uma nova ou informe uma peça avulsa."
            namePrefix="part_items"
            control={control}
            register={register}
            fields={partArray.fields}
            watchedItems={watchedParts}
            remove={partArray.remove}
            errors={errors.part_items}
            picker={<PartCombobox onSelect={addPart} />}
            inlineCreate={
              <Button
                type="button"
                variant="link"
                size="sm"
                className="h-auto p-0 text-xs"
                onClick={() => setPartDialogOpen(true)}
              >
                <Plus className="size-3" />
                Nova peça
              </Button>
            }
            onAddCustom={addCustom(partArray.append)}
            customLabel="Peça avulsa"
            emptyLabel="Nenhuma peça adicionada ainda."
            serviceOptions={serviceLinkOptions}
          />
        </CardContent>
      </Card>

      {/* 9. Valores */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Valores</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Total de serviços</span>
              <span data-testid="order-services-total">{formatCurrencyBRL(servicesTotal)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Total de pacotes</span>
              <span data-testid="order-packages-total">{formatCurrencyBRL(packagesTotal)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Total de peças</span>
              <span data-testid="order-parts-total">{formatCurrencyBRL(partsTotal)}</span>
            </div>
            <div className="flex justify-between border-t pt-1 font-medium">
              <span>Total bruto</span>
              <span data-testid="order-gross-total">{formatCurrencyBRL(grossTotal)}</span>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="discount_type">Tipo de desconto</Label>
              <Controller
                control={control}
                name="discount_type"
                render={({ field }) => (
                  <Select
                    value={field.value}
                    onValueChange={(value) =>
                      handleDiscountTypeChange(value as OrderDiscountType)
                    }
                  >
                    <SelectTrigger id="discount_type" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DISCOUNT_TYPE_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>

            {discountType === "percent" && (
              <div className="space-y-2">
                <Label htmlFor="discount_value">Desconto (%)</Label>
                <Controller
                  control={control}
                  name="discount_value"
                  render={({ field }) => (
                    <Input
                      id="discount_value"
                      inputMode="decimal"
                      placeholder="0"
                      value={field.value}
                      onChange={(event) => field.onChange(percentInput(event.target.value))}
                      aria-invalid={Boolean(errors.discount_value)}
                    />
                  )}
                />
                {errors.discount_value && (
                  <p className="text-sm text-destructive">{errors.discount_value.message}</p>
                )}
              </div>
            )}

            {discountType === "fixed" && (
              <div className="space-y-2">
                <Label htmlFor="discount_value">Desconto (R$)</Label>
                <Controller
                  control={control}
                  name="discount_value"
                  render={({ field }) => (
                    <CurrencyInput
                      id="discount_value"
                      value={field.value}
                      onChange={field.onChange}
                      aria-invalid={Boolean(errors.discount_value)}
                    />
                  )}
                />
                {errors.discount_value && (
                  <p className="text-sm text-destructive">{errors.discount_value.message}</p>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center justify-between border-t pt-3">
            <span className="font-medium">Valor final</span>
            <span className="text-lg font-semibold" data-testid="order-final-value">
              {formatCurrencyBRL(finalValue)}
            </span>
          </div>
        </CardContent>
      </Card>
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" disabled={isSubmitting || mutation.isPending}>
          {(isSubmitting || mutation.isPending) && <Loader2 className="animate-spin" />}
          Salvar
        </Button>
      </div>

      {/* Inline cadastros -- abrem sem perder os dados já preenchidos na OS */}
      <CustomerFormSheet
        open={customerSheetOpen}
        onOpenChange={setCustomerSheetOpen}
        customerId={null}
        onCreated={selectCustomer}
      />
      <VehicleFormSheet
        open={vehicleSheetOpen}
        onOpenChange={setVehicleSheetOpen}
        vehicleId={null}
        defaultCustomerId={customerId}
        defaultCustomerName={customerName}
        onCreated={selectVehicle}
      />
      <ServiceQuickCreateDialog
        open={serviceDialogOpen}
        onOpenChange={setServiceDialogOpen}
        onCreated={addService}
      />
      <PackageQuickCreateDialog
        open={packageDialogOpen}
        onOpenChange={setPackageDialogOpen}
        onCreated={addPackage}
      />
      <PartQuickCreateDialog
        open={partDialogOpen}
        onOpenChange={setPartDialogOpen}
        onCreated={addPart}
      />
      <VehicleSelectorDialog
        open={selectorOpen}
        onOpenChange={setSelectorOpen}
        vehicles={selectorVehicles}
        onSelect={(vehicle) => {
          selectVehicle(vehicle);
          setSelectorOpen(false);
        }}
      />
    </form>
  );
}
