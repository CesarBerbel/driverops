import { Slot } from "@radix-ui/react-slot";
import type { VariantProps } from "class-variance-authority";
import * as React from "react";

import { cn } from "@/lib/utils";

import { buttonVariants } from "./button-variants";

function Button({
  className,
  variant,
  size,
  asChild = false,
  type,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "button";

  return (
    <Comp
      data-slot="button"
      // Padrão "button": evita que botões de ação dentro de um <form> (ex.: gerar
      // PDF/copiar link no painel de orçamento da OS) disparem o submit e naveguem
      // para fora. Botões de envio devem declarar type="submit" explicitamente.
      type={asChild ? type : (type ?? "button")}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button };
