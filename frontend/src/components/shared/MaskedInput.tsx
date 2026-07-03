import * as React from "react";

import { Input } from "@/components/ui/input";
import { onlyDigits } from "@/lib/masks";

interface MaskedInputProps
  extends Omit<React.ComponentProps<typeof Input>, "value" | "onChange"> {
  value: string;
  onChange: (digits: string) => void;
  format: (digits: string) => string;
  maxDigits: number;
}

const MaskedInput = React.forwardRef<HTMLInputElement, MaskedInputProps>(
  ({ value, onChange, format, maxDigits, ...props }, ref) => {
    function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
      const digits = onlyDigits(event.target.value).slice(0, maxDigits);
      onChange(digits);
    }

    return (
      <Input
        ref={ref}
        inputMode="numeric"
        value={format(value ?? "")}
        onChange={handleChange}
        {...props}
      />
    );
  },
);
MaskedInput.displayName = "MaskedInput";

export { MaskedInput };
