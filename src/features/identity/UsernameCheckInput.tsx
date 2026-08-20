import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { useEffect, useState } from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { validateUsername, type UsernameValidationResult } from "./username";

export interface UsernameCheckInputProps {
  id?: string;
  name?: string;
  value: string;
  onChange: (value: string) => void;
  onValidationChange?: (result: UsernameValidationResult & { available?: boolean }) => void;
  disabled?: boolean;
  autoFocus?: boolean;
}

export function UsernameCheckInput({
  id = "username",
  name = "username",
  value,
  onChange,
  onValidationChange,
  disabled = false,
  autoFocus = false,
}: UsernameCheckInputProps) {
  const [checking, setChecking] = useState(false);
  const [isAvailable, setIsAvailable] = useState<boolean | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!value) {
      setIsAvailable(null);
      setErrorMsg(null);
      onValidationChange?.({ valid: false, normalized: "" });
      return;
    }

    const localRes = validateUsername(value);
    if (!localRes.valid) {
      setIsAvailable(false);
      setErrorMsg(localRes.message ?? "Invalid username");
      onValidationChange?.({ ...localRes, available: false });
      return;
    }

    setErrorMsg(null);
    setChecking(true);

    const controller = new AbortController();
    const timer = setTimeout(() => {
      fetch(`/api/v1/auth/username/check?username=${encodeURIComponent(localRes.normalized)}`, {
        signal: controller.signal,
      })
        .then((res) => res.json())
        .then((payload) => {
          setChecking(false);
          if (payload?.data) {
            const avail = Boolean(payload.data.available);
            setIsAvailable(avail);
            if (!avail) {
              setErrorMsg(payload.data.message ?? "Username is not available");
            }
            onValidationChange?.({
              ...localRes,
              available: avail,
              reason: payload.data.reason,
            });
          }
        })
        .catch((err) => {
          if (err.name !== "AbortError") {
            setChecking(false);
          }
        });
    }, 300);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [value, onValidationChange]);

  const localRes = validateUsername(value);

  return (
    <div className="space-y-2">
      <Label htmlFor={id} className="text-sm font-medium">
        Stealth Handle
      </Label>

      <div className="relative">
        <Input
          id={id}
          name={name}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="your_handle"
          disabled={disabled}
          autoFocus={autoFocus}
          className={`pr-10 ${
            isAvailable === true
              ? "border-emerald-500 focus-visible:ring-emerald-500"
              : isAvailable === false
                ? "border-destructive focus-visible:ring-destructive"
                : ""
          }`}
          aria-invalid={isAvailable === false}
          aria-describedby={`${id}-status`}
        />

        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center justify-center">
          {checking && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
          {!checking && isAvailable === true && (
            <CheckCircle2 className="size-4 text-emerald-500" />
          )}
          {!checking && isAvailable === false && <XCircle className="size-4 text-destructive" />}
        </div>
      </div>

      <div id={`${id}-status`} role="status" aria-live="polite" className="text-xs space-y-1">
        {errorMsg && <p className="text-destructive font-medium">{errorMsg}</p>}
        {!errorMsg && isAvailable === true && localRes.canonicalEmail && (
          <p className="text-emerald-600 dark:text-emerald-400 font-medium">
            Available: {localRes.canonicalEmail} ({localRes.federationHandle})
          </p>
        )}
        {!value && (
          <p className="text-muted-foreground">
            Your Stealth email will be <span className="font-mono">handle@stealth.me</span> and
            Stellar handle <span className="font-mono">handle*stealth.me</span>
          </p>
        )}
      </div>
    </div>
  );
}
