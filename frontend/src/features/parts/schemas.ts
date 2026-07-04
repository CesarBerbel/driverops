import { z } from "zod";

import { parseCurrencyBRL, parseQuantityBRL } from "@/lib/masks";

const requiredQuantitySchema = z
  .string()
  .refine((value) => parseQuantityBRL(value) !== null, "Informe uma quantidade válida.")
  .refine((value) => (parseQuantityBRL(value) ?? 0) >= 0, "A quantidade não pode ser negativa.");

const optionalQuantitySchema = z.string().refine((value) => {
  if (!value) return true;
  const parsed = parseQuantityBRL(value);
  return parsed !== null && parsed >= 0;
}, "Informe um valor não negativo.");

const optionalCurrencySchema = z.string().refine((value) => {
  if (!value) return true;
  const parsed = parseCurrencyBRL(value);
  return parsed !== null && parsed >= 0;
}, "Informe um valor não negativo.");

export const partSchema = z
  .object({
    category_id: z.number({ message: "Selecione uma categoria." }).nullable(),
    name: z.string().trim().min(1, "O nome é obrigatório.").max(150, "O nome deve ter no máximo 150 caracteres."),
    internal_code: z.string().optional(),
    brand: z.string().optional(),
    model_application: z.string().optional(),
    unit_of_measure: z.string().min(1, "A unidade de medida é obrigatória."),
    current_quantity: requiredQuantitySchema,
    min_quantity: optionalQuantitySchema,
    cost_price: optionalCurrencySchema,
    sale_price: optionalCurrencySchema,
    location: z.string().optional(),
    supplier: z.string().optional(),
    ncm: z.string().optional(),
    barcode: z.string().optional(),
    notes: z.string().optional(),
  })
  .refine((values) => values.category_id !== null, {
    message: "Selecione uma categoria.",
    path: ["category_id"],
  });

export type PartFormValues = z.infer<typeof partSchema>;
