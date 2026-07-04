import {
  formatCurrencyBRL,
  formatQuantityBRL,
  onlyDigits,
  parseCurrencyBRL,
  parsePercent,
  parseQuantityBRL,
} from "@/lib/masks";

import type { OrderFormValues, OrderLineValues } from "../schemas";
import type {
  WorkOrder,
  WorkOrderPackageItem,
  WorkOrderPartItem,
  WorkOrderPayload,
  WorkOrderServiceItem,
} from "../types";

// Human-facing OS number, zero-padded ("OS 0001").
export function formatOrderNumber(n: number): string {
  return `OS ${String(n).padStart(4, "0")}`;
}

function lineToForm(
  item: WorkOrderServiceItem | WorkOrderPackageItem | WorkOrderPartItem,
  refId: number | null,
): OrderLineValues {
  return {
    ref_id: refId,
    name: item.display_name,
    quantity: formatQuantityBRL(Number(item.quantity)),
    unit_price: formatCurrencyBRL(Number(item.unit_price)),
  };
}

export const EMPTY_ORDER_VALUES: OrderFormValues = {
  customer_id: null,
  vehicle_id: null,
  status: "open",
  opened_at: todayISO(),
  expected_delivery: "",
  current_mileage: "",
  customer_report: "",
  diagnosis: "",
  internal_notes: "",
  service_items: [],
  package_items: [],
  part_items: [],
  discount_type: "none",
  discount_value: "",
};

export function todayISO(): string {
  // yyyy-mm-dd in local time, for the native date input's default.
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}

// yyyy-mm-dd + N days, computed in UTC to avoid DST/timezone drift. Used to
// prefill the expected delivery from the global default deadline.
export function addDaysISO(iso: string, days: number): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-").map(Number);
  const base = new Date(Date.UTC(y, m - 1, d));
  base.setUTCDate(base.getUTCDate() + days);
  return base.toISOString().slice(0, 10);
}

export function toFormValues(order: WorkOrder): OrderFormValues {
  return {
    customer_id: order.customer,
    vehicle_id: order.vehicle,
    status: order.status,
    opened_at: order.opened_at,
    expected_delivery: order.expected_delivery ?? "",
    current_mileage: order.current_mileage != null ? String(order.current_mileage) : "",
    customer_report: order.customer_report,
    diagnosis: order.diagnosis,
    internal_notes: order.internal_notes,
    service_items: order.service_items.map((i) => lineToForm(i, i.service)),
    package_items: order.package_items.map((i) => lineToForm(i, i.package)),
    part_items: order.part_items.map((i) => lineToForm(i, i.part)),
    discount_type: order.discount_type,
    discount_value:
      order.discount_type === "percent"
        ? order.discount_value.replace(".", ",")
        : order.discount_type === "fixed"
          ? formatCurrencyBRL(Number(order.discount_value))
          : "",
  };
}

function lineToPayload(line: OrderLineValues) {
  return {
    description: line.name.trim(),
    quantity: String(parseQuantityBRL(line.quantity) ?? 0),
    unit_price: String(parseCurrencyBRL(line.unit_price) ?? 0),
  };
}

export function toPayload(values: OrderFormValues): Partial<WorkOrderPayload> {
  let discountValue = "0";
  if (values.discount_type === "percent") {
    discountValue = String(parsePercent(values.discount_value) ?? 0);
  } else if (values.discount_type === "fixed") {
    discountValue = String(parseCurrencyBRL(values.discount_value) ?? 0);
  }
  const mileageDigits = onlyDigits(values.current_mileage ?? "");
  return {
    customer: values.customer_id as number,
    vehicle: values.vehicle_id as number,
    status: values.status,
    opened_at: values.opened_at,
    expected_delivery: values.expected_delivery || null,
    current_mileage: mileageDigits ? Number(mileageDigits) : null,
    customer_report: values.customer_report,
    diagnosis: values.diagnosis ?? "",
    internal_notes: values.internal_notes ?? "",
    discount_type: values.discount_type,
    discount_value: discountValue,
    service_items: values.service_items.map((l) => ({
      service: l.ref_id,
      ...lineToPayload(l),
    })),
    package_items: values.package_items.map((l) => ({
      package: l.ref_id,
      ...lineToPayload(l),
    })),
    part_items: values.part_items.map((l) => ({
      part: l.ref_id,
      ...lineToPayload(l),
    })),
  };
}

// Live subtotal for a single line (quantity × unit price), never negative.
export function lineSubtotal(line: OrderLineValues): number {
  const quantity = parseQuantityBRL(line.quantity) ?? 0;
  const price = parseCurrencyBRL(line.unit_price) ?? 0;
  return Math.max(0, quantity * price);
}
