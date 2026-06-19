import type { ChangeEvent } from "react";
import { cn } from "@/lib/utils";
import {
  RECEIPT_STATES,
  RECEIPT_STATE_OPTIONS,
  getReceiptStateOption,
  type ReceiptState,
} from "../constants/receiptStates";

export interface ReceiptStateFieldProps {
  /** Currently selected receipt state. */
  value: ReceiptState;
  /** Called when the admin picks a different receipt state. */
  onChange: (state: ReceiptState) => void;
  /** Optional id used to link the label and the select control. */
  id?: string;
  /** Optional extra class names for the wrapper. */
  className?: string;
}

export function ReceiptStateField({
  value,
  onChange,
  id = "receipt-state",
  className,
}: ReceiptStateFieldProps) {
  const selected = getReceiptStateOption(value);

  const handleChange = (event: ChangeEvent<HTMLSelectElement>) => {
    onChange(event.target.value as ReceiptState);
  };

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <label htmlFor={id} className="text-sm font-medium text-foreground">
        Read receipt state
      </label>
      <select
        id={id}
        value={value}
        onChange={handleChange}
        className={cn(
          "rounded-lg border border-white/[0.08] bg-white/[0.02] px-3 py-2",
          "text-sm text-foreground",
        )}
      >
        {RECEIPT_STATES.map((state) => (
          <option key={state} value={state}>
            {RECEIPT_STATE_OPTIONS[state].label}
          </option>
        ))}
      </select>
      <p className="text-sm text-muted-foreground">{selected.description}</p>
      <p className="text-xs text-muted-foreground">
        <span className="font-medium text-foreground">Example: </span>
        {selected.example}
      </p>
    </div>
  );
}
