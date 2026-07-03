import { z } from "zod";

import { isValidPlate } from "./plate";

const currentMaxYear = () => new Date().getFullYear() + 2;

const yearField = z.string().refine(
  (value) => {
    if (!value) return true;
    const year = Number(value);
    return year >= 1900 && year <= currentMaxYear();
  },
  { message: "Ano inválido. Informe um ano de 4 dígitos válido." },
);

export const vehicleSchema = z
  .object({
    customer_id: z.number({ message: "Selecione um cliente." }).nullable(),
    license_plate: z
      .string()
      .min(1, "A placa é obrigatória.")
      .refine(isValidPlate, {
        message: "Placa inválida. Use o padrão antigo (ABC1234) ou Mercosul (ABC1D23).",
      }),
    brand: z.string(),
    model: z.string(),
    version: z.string(),
    manufacture_year: yearField,
    model_year: yearField,
    color: z.string(),
    mileage: z.string(),
    fuel_type: z.string(),
    transmission: z.string(),
    steering: z.string(),
    doors: z.string(),
    air_conditioning: z.string(),
    is_modified: z.string(),
    modification_notes: z.string(),
    vehicle_type: z.string(),
    usage_category: z.string(),
    chassis: z.string(),
    renavam: z.string(),
    fipe_code: z.string(),
    notes: z.string(),
  })
  .refine((values) => values.customer_id !== null, {
    message: "Selecione um cliente.",
    path: ["customer_id"],
  })
  .superRefine((values, ctx) => {
    if (!values.manufacture_year || !values.model_year) return;
    if (Number(values.model_year) < Number(values.manufacture_year)) {
      ctx.addIssue({
        code: "custom",
        path: ["model_year"],
        message: "O ano do modelo não pode ser anterior ao ano de fabricação.",
      });
    }
  });

export type VehicleFormValues = z.infer<typeof vehicleSchema>;
