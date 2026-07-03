import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().min(1, "Informe seu e-mail.").email("E-mail inválido."),
  password: z.string().min(1, "Informe sua senha."),
});
export type LoginFormValues = z.infer<typeof loginSchema>;

export const forgotPasswordSchema = z.object({
  email: z.string().min(1, "Informe seu e-mail.").email("E-mail inválido."),
});
export type ForgotPasswordFormValues = z.infer<typeof forgotPasswordSchema>;

// Mirrors the server-side Django AUTH_PASSWORD_VALIDATORS as a UX nicety --
// the backend remains the source of truth and re-validates on submit.
const passwordStrength = z
  .string()
  .min(8, "A senha deve ter pelo menos 8 caracteres.")
  .refine((value) => !/^\d+$/.test(value), "A senha não pode ser totalmente numérica.");

export const resetPasswordSchema = z
  .object({
    new_password: passwordStrength,
    new_password_confirm: z.string().min(1, "Confirme a nova senha."),
  })
  .refine((data) => data.new_password === data.new_password_confirm, {
    message: "As senhas não coincidem.",
    path: ["new_password_confirm"],
  });
export type ResetPasswordFormValues = z.infer<typeof resetPasswordSchema>;

export const changePasswordSchema = z
  .object({
    current_password: z.string().min(1, "Informe sua senha atual."),
    new_password: passwordStrength,
    new_password_confirm: z.string().min(1, "Confirme a nova senha."),
  })
  .refine((data) => data.new_password === data.new_password_confirm, {
    message: "As senhas não coincidem.",
    path: ["new_password_confirm"],
  });
export type ChangePasswordFormValues = z.infer<typeof changePasswordSchema>;

export const profileSchema = z.object({
  full_name: z.string().min(1, "Informe seu nome.").max(150, "Nome muito longo."),
});
export type ProfileFormValues = z.infer<typeof profileSchema>;
