import * as React from "react";

import { cn } from "@/lib/utils";

type BadgeVariant = "default" | "muted" | "outline";

function Badge({
  className,
  variant = "default",
  ...props
}: React.ComponentProps<"span"> & { variant?: BadgeVariant }) {
  return (
    <span
      data-slot="badge"
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium",
        variant === "default" && "border-transparent bg-primary text-primary-foreground",
        variant === "muted" && "border-destructive/30 bg-destructive/10 text-destructive",
        // "outline": só borda/texto -- a cor vem via className de quem usa.
        variant === "outline" && "text-foreground",
        className,
      )}
      {...props}
    />
  );
}

export { Badge };
