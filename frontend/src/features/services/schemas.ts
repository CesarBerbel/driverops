import { z } from "zod";

import { parseCurrencyBRL, parsePercent, parseQuantityBRL } from "@/lib/masks";

const standardPartSchema = z.object({
  part_id: z.number(),
  part_name: z.string(),
  suggested_quantity: z.string().refine((value) => {
    const parsed = parseQuantityBRL(value);
    return parsed !== null && parsed >= 0;
  }, "Informe uma quantidade válida (não negativa)."),
  is_required: z.boolean(),
  notes: z.string().optional(),
});

export const serviceSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, "O nome do serviço é obrigatório.")
      .max(150, "O nome deve ter no máximo 150 caracteres."),
    category_id: z.number({ message: "Selecione uma categoria." }).nullable(),
    description: z.string().optional(),
    labor_cost: z.string().refine((value) => {
      if (!value) return true;
      const parsed = parseCurrencyBRL(value);
      return parsed !== null && parsed >= 0;
    }, "Informe um valor não negativo."),
    estimated_minutes: z.string().optional(),
    notes: z.string().optional(),
    standard_parts: z.array(standardPartSchema),
  })
  .refine((values) => values.category_id !== null, {
    message: "Selecione uma categoria.",
    path: ["category_id"],
  });

export type ServiceFormValues = z.infer<typeof serviceSchema>;

const packageServiceSchema = z.object({
  service_id: z.number(),
  service_name: z.string(),
  service_value: z.string(),
});

export const packageSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, "O nome do pacote é obrigatório.")
      .max(150, "O nome deve ter no máximo 150 caracteres."),
    description: z.string().optional(),
    services: z.array(packageServiceSchema).min(1, "Adicione ao menos um serviço."),
    discount_type: z.enum(["none", "percent", "fixed"]),
    discount_value: z.string(),
    notes: z.string().optional(),
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

export type PackageFormValues = z.infer<typeof packageSchema>;
