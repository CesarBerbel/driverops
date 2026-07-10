import { z } from "zod";

import { parseCurrencyBRL, parsePercent, parseQuantityBRL } from "@/lib/masks";

// A single OS line (service/package/part). `ref_id` is null for avulso items.
// `name` is the snapshot description shown and stored; `unit_price` is a
// currency-formatted string that may be empty (treated as R$ 0,00).
export const orderLineSchema = z.object({
  ref_id: z.number().nullable(),
  name: z.string().trim().min(1, "Informe uma descrição."),
  quantity: z.string().refine((value) => {
    const parsed = parseQuantityBRL(value);
    return parsed !== null && parsed >= 0;
  }, "Informe uma quantidade válida."),
  unit_price: z.string().refine((value) => {
    if (!value) return true;
    const parsed = parseCurrencyBRL(value);
    return parsed !== null && parsed >= 0;
  }, "Informe um valor não negativo."),
  // Só usado por peças: índice do serviço vinculado na lista de serviços da OS.
  linked_service_index: z.number().nullable().optional(),
});

export type OrderLineValues = z.infer<typeof orderLineSchema>;

export const orderSchema = z
  .object({
    customer_id: z.number({ message: "Selecione um cliente." }).nullable(),
    vehicle_id: z.number({ message: "Selecione um veículo." }).nullable(),
    status: z.enum([
      "open",
      "diagnosing",
      "awaiting_approval",
      "approved",
      "in_progress",
      "awaiting_parts",
      "testing",
      "ready",
      "finished",
      "canceled",
      "rejected",
    ]),
    assigned_technician_id: z.number().nullable(),
    opened_at: z.string().min(1, "Informe a data de abertura."),
    expected_delivery: z.string().optional(),
    current_mileage: z.string().optional(),
    customer_report: z.string().trim().min(1, "O relato do cliente é obrigatório."),
    diagnosis: z.string().optional(),
    internal_notes: z.string().optional(),
    service_items: z.array(orderLineSchema),
    package_items: z.array(orderLineSchema),
    part_items: z.array(orderLineSchema),
    discount_type: z.enum(["none", "percent", "fixed"]),
    discount_value: z.string(),
  })
  .refine((values) => values.customer_id !== null, {
    message: "Selecione um cliente.",
    path: ["customer_id"],
  })
  .refine((values) => values.vehicle_id !== null, {
    message: "Selecione um veículo.",
    path: ["vehicle_id"],
  })
  .superRefine((values, ctx) => {
    if (values.discount_type === "percent") {
      const parsed = parsePercent(values.discount_value);
      if (parsed === null || parsed < 0 || parsed > 100) {
        ctx.addIssue({
          code: "custom",
          path: ["discount_value"],
          message: "O desconto percentual deve estar entre 0 e 100.",
        });
      }
    } else if (values.discount_type === "fixed") {
      const parsed = parseCurrencyBRL(values.discount_value);
      if (parsed !== null && parsed < 0) {
        ctx.addIssue({
          code: "custom",
          path: ["discount_value"],
          message: "O desconto não pode ser negativo.",
        });
      }
    }
  });

export type OrderFormValues = z.infer<typeof orderSchema>;
