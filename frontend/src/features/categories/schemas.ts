import { z } from "zod";

export const categorySchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "O nome é obrigatório.")
    .max(100, "O nome deve ter no máximo 100 caracteres."),
  description: z.string().max(255, "A descrição deve ter no máximo 255 caracteres.").optional(),
  notes: z.string().optional(),
});
export type CategoryFormValues = z.infer<typeof categorySchema>;
