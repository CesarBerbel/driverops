import { z } from "zod";

export const customerSchema = z
  .object({
    name: z.string().min(1, "O nome é obrigatório.").max(150, "Nome muito longo."),
    customer_type: z.enum(["individual", "company"]),
    email: z.string().email("E-mail inválido.").or(z.literal("")),
    phone: z
      .string()
      .refine((value) => !value || value.length === 10 || value.length === 11, {
        message: "Telefone inválido. Informe DDD + número.",
      }),
    document: z.string(),
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
    const expectedLength = values.customer_type === "company" ? 14 : 11;
    if (values.document.length !== expectedLength) {
      ctx.addIssue({
        code: "custom",
        path: ["document"],
        message:
          values.customer_type === "company"
            ? "CNPJ inválido. Informe 14 dígitos."
            : "CPF inválido. Informe 11 dígitos.",
      });
    }
  });

export type CustomerFormValues = z.infer<typeof customerSchema>;
