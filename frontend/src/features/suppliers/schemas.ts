import { z } from "zod";

export const supplierSchema = z
  .object({
    name: z.string().min(1, "O nome/razão social é obrigatório.").max(150, "Nome muito longo."),
    trade_name: z.string(),
    supplier_type: z.enum(["individual", "company"]),
    document: z.string(),
    state_registration: z.string(),
    email: z.string().email("E-mail inválido.").or(z.literal("")),
    phone: z
      .string()
      .refine((value) => !value || value.length === 10 || value.length === 11, {
        message: "Telefone inválido. Informe DDD + número.",
      }),
    whatsapp: z
      .string()
      .refine((value) => !value || value.length === 10 || value.length === 11, {
        message: "WhatsApp inválido. Informe DDD + número.",
      }),
    contact_name: z.string(),
    zip_code: z.string().refine((value) => !value || value.length === 8, {
      message: "CEP inválido. Informe 8 dígitos.",
    }),
    street: z.string(),
    number: z.string(),
    complement: z.string(),
    neighborhood: z.string(),
    city: z.string(),
    state: z.string().refine((value) => !value || value.length === 2, {
      message: "UF deve ter 2 letras.",
    }),
    country: z.string(),
    notes: z.string(),
  })
  .superRefine((values, ctx) => {
    if (!values.document) return;
    const expectedLength = values.supplier_type === "company" ? 14 : 11;
    if (values.document.length !== expectedLength) {
      ctx.addIssue({
        code: "custom",
        path: ["document"],
        message:
          values.supplier_type === "company"
            ? "CNPJ inválido. Informe 14 dígitos."
            : "CPF inválido. Informe 11 dígitos.",
      });
    }
  });

export type SupplierFormValues = z.infer<typeof supplierSchema>;
