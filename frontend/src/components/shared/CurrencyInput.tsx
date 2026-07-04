import { Input } from "@/components/ui/input";
import { formatCentsAsBRL, onlyDigits } from "@/lib/masks";

interface CurrencyInputProps {
  id?: string;
  value: string;
  onChange: (formatted: string) => void;
  "aria-invalid"?: boolean;
}

export function CurrencyInput({ value, onChange, ...rest }: CurrencyInputProps) {
  return (
    <Input
      inputMode="numeric"
      placeholder="R$ 0,00"
      value={value}
      onChange={(event) => onChange(formatCentsAsBRL(onlyDigits(event.target.value)))}
      {...rest}
    />
  );
}
