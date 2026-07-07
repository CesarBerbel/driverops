import { Check } from "lucide-react";

import { cn } from "@/lib/utils";

interface CheckboxProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  id?: string;
  disabled?: boolean;
  "aria-label"?: string;
}

// Checkbox acessível (role="checkbox"), sem dependência externa.
export function Checkbox({ checked, onCheckedChange, id, disabled, ...rest }: CheckboxProps) {
  return (
    <button
      type="button"
      role="checkbox"
      id={id}
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        "flex size-4 shrink-0 items-center justify-center rounded border transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
        checked ? "border-primary bg-primary text-primary-foreground" : "border-input",
        disabled && "cursor-not-allowed opacity-50",
      )}
      {...rest}
    >
      {checked && <Check className="size-3" />}
    </button>
  );
}
