import { z } from "zod";

export const workshopProfileSchema = z.object({
  trade_name: z
    .string()
    .trim()
    .min(1, "O nome fantasia é obrigatório.")
    .max(150, "O nome fantasia deve ter no máximo 150 caracteres."),
  legal_name: z.string().optional(),
  cnpj: z.string().optional(),
  state_registration: z.string().optional(),
  responsible: z.string().optional(),
  email: z
    .string()
    .optional()
    .refine((value) => !value || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value), {
      message: "Informe um e-mail válido.",
    }),
  phone: z.string().optional(),
  whatsapp: z.string().optional(),
  website: z.string().optional(),
  zip_code: z.string().optional(),
  street: z.string().optional(),
  number: z.string().optional(),
  complement: z.string().optional(),
  neighborhood: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  country: z.string().optional(),
  business_hours: z.string().optional(),
  notes: z.string().optional(),
});

export type WorkshopProfileFormValues = z.infer<typeof workshopProfileSchema>;

export const orderSettingsSchema = z.object({
  // Kept as a string in the form (digits-only input); converted on submit.
  default_delivery_days: z
    .string()
    .refine((value) => value !== "" && Number.isInteger(Number(value)) && Number(value) >= 0, {
      message: "Informe um número de dias válido (não negativo).",
    }),
  warranty_terms: z.string().optional(),
  quote_terms: z.string().optional(),
  service_authorization_terms: z.string().optional(),
  customer_acknowledgment_terms: z.string().optional(),
  default_os_notes: z.string().optional(),
  pdf_footer_text: z.string().optional(),
  print_instructions: z.string().optional(),
  general_conditions: z.string().optional(),
  notify_customer_by_email: z.boolean(),
  notify_statuses: z.array(z.string()),
  notify_on_creation: z.boolean(),
  notify_on_payment: z.boolean(),
});

export type OrderSettingsFormValues = z.infer<typeof orderSettingsSchema>;
