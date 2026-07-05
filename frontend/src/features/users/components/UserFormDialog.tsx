import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useEffect } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { extractErrorMessage } from "@/lib/api-client";
import { onlyDigits } from "@/lib/masks";

import { createUser, listRoles, updateUser } from "../api";
import { TECHNICAL_SPECIALTY_OPTIONS } from "../constants";
import type { ManagedUser } from "../types";

const userSchema = z
  .object({
    full_name: z.string().trim().min(1, "O nome é obrigatório."),
    email: z.string().email("Informe um e-mail válido."),
    phone: z.string().optional(),
    whatsapp: z.string().optional(),
    role: z.number({ message: "Selecione um perfil." }).nullable(),
    technical_specialty: z.string().optional(),
    is_active: z.boolean(),
    force_password_change: z.boolean(),
    notes: z.string().optional(),
    password: z.string().optional(),
    send_invite: z.boolean(),
    isEdit: z.boolean(),
  })
  .superRefine((values, ctx) => {
    if (values.role === null) {
      ctx.addIssue({ code: "custom", path: ["role"], message: "Selecione um perfil." });
    }
    if (!values.isEdit && !values.send_invite && !(values.password ?? "").trim()) {
      ctx.addIssue({
        code: "custom",
        path: ["password"],
        message: "Informe uma senha inicial ou marque enviar convite.",
      });
    }
  });

type FormValues = z.infer<typeof userSchema>;

interface UserFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: ManagedUser | null;
}

export function UserFormDialog({ open, onOpenChange, user }: UserFormDialogProps) {
  const isEdit = user !== null;
  const queryClient = useQueryClient();
  const rolesQuery = useQuery({ queryKey: ["roles"], queryFn: listRoles });

  const {
    control,
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(userSchema),
    defaultValues: {
      full_name: "",
      email: "",
      phone: "",
      whatsapp: "",
      role: null,
      technical_specialty: "",
      is_active: true,
      force_password_change: false,
      notes: "",
      password: "",
      send_invite: false,
      isEdit,
    },
  });

  useEffect(() => {
    if (!open) return;
    reset({
      full_name: user?.full_name ?? "",
      email: user?.email ?? "",
      phone: user?.phone ?? "",
      whatsapp: user?.whatsapp ?? "",
      role: user?.role ?? null,
      technical_specialty: user?.technical_specialty ?? "",
      is_active: user?.is_active ?? true,
      force_password_change: user?.force_password_change ?? false,
      notes: user?.notes ?? "",
      password: "",
      send_invite: false,
      isEdit,
    });
  }, [open, user, isEdit, reset]);

  const roleId = watch("role");
  const sendInvite = watch("send_invite");
  const selectedRole = rolesQuery.data?.find((r) => r.id === roleId);
  const isTecnico = selectedRole?.key === "tecnico";

  // Especialidade só vale para Técnico -- limpa se trocar de perfil.
  useEffect(() => {
    if (!isTecnico) setValue("technical_specialty", "");
  }, [isTecnico, setValue]);

  const mutation = useMutation({
    mutationFn: (values: FormValues) => {
      const payload = {
        full_name: values.full_name.trim(),
        email: values.email.trim().toLowerCase(),
        phone: onlyDigits(values.phone ?? ""),
        whatsapp: onlyDigits(values.whatsapp ?? ""),
        role: values.role,
        technical_specialty: isTecnico ? values.technical_specialty ?? "" : "",
        is_active: values.is_active,
        force_password_change: values.force_password_change,
        notes: values.notes ?? "",
        ...(isEdit
          ? {}
          : {
              password: values.password ?? "",
              send_invite: values.send_invite,
            }),
      };
      return isEdit ? updateUser(user.id, payload) : createUser(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      toast.success(isEdit ? "Usuário atualizado." : "Usuário criado.", {
        id: "user-saved",
      });
      onOpenChange(false);
    },
    onError: (error) => {
      toast.error(extractErrorMessage(error, "Não foi possível salvar o usuário."));
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar usuário" : "Novo usuário"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Atualize os dados e o perfil do usuário."
              : "O e-mail é o login. Defina uma senha inicial ou envie um convite por e-mail."}
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={handleSubmit((values) => mutation.mutate(values))}
          className="space-y-4"
          noValidate
        >
          <div className="space-y-2">
            <Label htmlFor="full_name">Nome completo</Label>
            <Input id="full_name" {...register("full_name")} aria-invalid={Boolean(errors.full_name)} />
            {errors.full_name && (
              <p className="text-sm text-destructive">{errors.full_name.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">E-mail (login)</Label>
            <Input
              id="email"
              type="email"
              {...register("email")}
              disabled={isEdit}
              aria-invalid={Boolean(errors.email)}
            />
            {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="phone">Telefone</Label>
              <Input id="phone" inputMode="numeric" {...register("phone")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="whatsapp">WhatsApp</Label>
              <Input id="whatsapp" inputMode="numeric" {...register("whatsapp")} />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="role">Perfil</Label>
              <Controller
                control={control}
                name="role"
                render={({ field }) => (
                  <Select
                    value={field.value != null ? String(field.value) : ""}
                    onValueChange={(value) => field.onChange(Number(value))}
                  >
                    <SelectTrigger id="role" aria-invalid={Boolean(errors.role)}>
                      <SelectValue placeholder="Selecione o perfil" />
                    </SelectTrigger>
                    <SelectContent>
                      {rolesQuery.data?.map((role) => (
                        <SelectItem key={role.id} value={String(role.id)}>
                          {role.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.role && <p className="text-sm text-destructive">{errors.role.message}</p>}
            </div>

            {isTecnico && (
              <div className="space-y-2">
                <Label htmlFor="technical_specialty">Especialidade técnica</Label>
                <Controller
                  control={control}
                  name="technical_specialty"
                  render={({ field }) => (
                    <Select value={field.value || ""} onValueChange={field.onChange}>
                      <SelectTrigger id="technical_specialty">
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        {TECHNICAL_SPECIALTY_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
            )}
          </div>

          {!isEdit && (
            <div className="space-y-3 rounded-md border p-3">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" className="size-4 accent-primary" {...register("send_invite")} />
                Enviar convite por e-mail (o usuário define a própria senha)
              </label>
              {!sendInvite && (
                <div className="space-y-2">
                  <Label htmlFor="password">Senha inicial</Label>
                  <Input
                    id="password"
                    type="password"
                    {...register("password")}
                    aria-invalid={Boolean(errors.password)}
                  />
                  {errors.password && (
                    <p className="text-sm text-destructive">{errors.password.message}</p>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="flex flex-col gap-2">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" className="size-4 accent-primary" {...register("is_active")} />
              Usuário ativo
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="size-4 accent-primary"
                {...register("force_password_change")}
              />
              Forçar troca de senha no próximo acesso
            </label>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Observações internas</Label>
            <Textarea id="notes" rows={2} {...register("notes")} />
          </div>

          <DialogFooter className="flex-row justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending && <Loader2 className="animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
