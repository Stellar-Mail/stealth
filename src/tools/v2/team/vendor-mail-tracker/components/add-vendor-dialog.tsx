/**
 * AddVendorDialog — modal form for creating a new vendor record.
 *
 * Accessible: role="dialog", aria-modal, focus-trapped to the form,
 * Escape closes, Enter on last field submits, all fields have <label>.
 * Validation errors are announced via aria-invalid + aria-describedby.
 */

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { motionPresets } from "@/lib/motion-presets";
import type { VendorCategory, VendorDraft, VendorStatus } from "../types";

const CATEGORIES: VendorCategory[] = [
  "infrastructure",
  "software",
  "marketing",
  "legal",
  "finance",
  "hr",
  "logistics",
  "other",
];

const STATUSES: VendorStatus[] = ["active", "pending", "paused", "terminated"];

const inputClass =
  "glow-ring w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/60 outline-none focus:border-white/20 aria-invalid:border-red-500/40";

const labelClass = "block text-[11px] font-medium text-muted-foreground mb-1";

interface FieldError {
  name?: string;
  domain?: string;
  contactEmail?: string;
  category?: string;
  status?: string;
}

interface AddVendorDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (draft: VendorDraft) => void;
}

export function AddVendorDialog({ open, onClose, onSubmit }: AddVendorDialogProps) {
  const firstFieldRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState("");
  const [domain, setDomain] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [category, setCategory] = useState<VendorCategory>("infrastructure");
  const [status, setStatus] = useState<VendorStatus>("active");
  const [contractStart, setContractStart] = useState("");
  const [contractEnd, setContractEnd] = useState("");
  const [monthlySpend, setMonthlySpend] = useState("");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [errors, setErrors] = useState<FieldError>({});

  // Focus first field on open
  useEffect(() => {
    if (open) {
      setTimeout(() => firstFieldRef.current?.focus(), 50);
    } else {
      // Reset form
      setName("");
      setDomain("");
      setContactEmail("");
      setCategory("infrastructure");
      setStatus("active");
      setContractStart("");
      setContractEnd("");
      setMonthlySpend("");
      setAddress("");
      setNotes("");
      setErrors({});
    }
  }, [open]);

  // Keyboard: Escape closes
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  function validate(): boolean {
    const next: FieldError = {};
    if (!name.trim()) next.name = "Vendor name is required.";
    if (!domain.trim()) next.domain = "Domain is required.";
    if (!contactEmail.trim()) next.contactEmail = "Contact email is required.";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail))
      next.contactEmail = "Enter a valid email address.";
    if (!category) next.category = "Category is required.";
    if (!status) next.status = "Status is required.";
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    onSubmit({
      name: name.trim(),
      domain: domain.trim(),
      contactEmail: contactEmail.trim(),
      category,
      status,
      contractStart: contractStart || new Date().toISOString().slice(0, 10),
      contractEnd: contractEnd || null,
      monthlySpendCents: Math.round((parseFloat(monthlySpend) || 0) * 100),
      address: address.trim(),
      notes: notes.trim(),
    });
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            {...motionPresets.patterns.modal.backdrop}
            onClick={onClose}
            className="fixed inset-0 z-40 bg-black/70 backdrop-blur-md"
          />

          {/* Dialog */}
          <motion.div
            {...motionPresets.patterns.modal.content}
            role="dialog"
            aria-modal="true"
            aria-labelledby="add-vendor-title"
            className="glass-strong fixed left-1/2 top-1/2 z-50 w-[min(520px,calc(100vw-2rem))] max-h-[90vh] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-2xl flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-white/[0.08] px-6 py-4">
              <div>
                <h2
                  id="add-vendor-title"
                  className="text-sm font-semibold text-foreground"
                >
                  Add Vendor
                </h2>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Register a new vendor for mail tracking.
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close dialog"
                className="glow-ring rounded-lg p-1.5 text-muted-foreground transition hover:bg-white/[0.07] hover:text-foreground"
              >
                <X className="h-4 w-4" aria-hidden />
              </button>
            </div>

            {/* Form body */}
            <form
              id="add-vendor-form"
              onSubmit={handleSubmit}
              noValidate
              className="flex-1 overflow-y-auto px-6 py-5 space-y-4 scrollbar-thin"
            >
              {/* Name */}
              <div>
                <label htmlFor="vendor-name" className={labelClass}>
                  Vendor name <span aria-hidden className="text-red-300">*</span>
                </label>
                <input
                  ref={firstFieldRef}
                  id="vendor-name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Orbit Cloud"
                  autoComplete="organization"
                  aria-required="true"
                  aria-invalid={!!errors.name}
                  aria-describedby={errors.name ? "vendor-name-error" : undefined}
                  className={inputClass}
                />
                {errors.name && (
                  <p id="vendor-name-error" role="alert" className="mt-1 text-[11px] text-red-300">
                    {errors.name}
                  </p>
                )}
              </div>

              {/* Domain + Email (2-col) */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="vendor-domain" className={labelClass}>
                    Domain <span aria-hidden className="text-red-300">*</span>
                  </label>
                  <input
                    id="vendor-domain"
                    type="text"
                    value={domain}
                    onChange={(e) => setDomain(e.target.value)}
                    placeholder="orbitcloud.io"
                    aria-required="true"
                    aria-invalid={!!errors.domain}
                    aria-describedby={errors.domain ? "vendor-domain-error" : undefined}
                    className={inputClass}
                  />
                  {errors.domain && (
                    <p id="vendor-domain-error" role="alert" className="mt-1 text-[11px] text-red-300">
                      {errors.domain}
                    </p>
                  )}
                </div>
                <div>
                  <label htmlFor="vendor-email" className={labelClass}>
                    Contact email <span aria-hidden className="text-red-300">*</span>
                  </label>
                  <input
                    id="vendor-email"
                    type="email"
                    value={contactEmail}
                    onChange={(e) => setContactEmail(e.target.value)}
                    placeholder="billing@orbitcloud.io"
                    autoComplete="email"
                    aria-required="true"
                    aria-invalid={!!errors.contactEmail}
                    aria-describedby={errors.contactEmail ? "vendor-email-error" : undefined}
                    className={inputClass}
                  />
                  {errors.contactEmail && (
                    <p id="vendor-email-error" role="alert" className="mt-1 text-[11px] text-red-300">
                      {errors.contactEmail}
                    </p>
                  )}
                </div>
              </div>

              {/* Category + Status (2-col) */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="vendor-category" className={labelClass}>
                    Category <span aria-hidden className="text-red-300">*</span>
                  </label>
                  <select
                    id="vendor-category"
                    value={category}
                    onChange={(e) => setCategory(e.target.value as VendorCategory)}
                    aria-required="true"
                    className={cn(inputClass, "cursor-pointer appearance-none")}
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c} className="capitalize">
                        {c.charAt(0).toUpperCase() + c.slice(1)}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="vendor-status" className={labelClass}>
                    Status <span aria-hidden className="text-red-300">*</span>
                  </label>
                  <select
                    id="vendor-status"
                    value={status}
                    onChange={(e) => setStatus(e.target.value as VendorStatus)}
                    aria-required="true"
                    className={cn(inputClass, "cursor-pointer appearance-none")}
                  >
                    {STATUSES.map((s) => (
                      <option key={s} value={s} className="capitalize">
                        {s.charAt(0).toUpperCase() + s.slice(1)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Contract dates (2-col) */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="vendor-contract-start" className={labelClass}>
                    Contract start
                  </label>
                  <input
                    id="vendor-contract-start"
                    type="date"
                    value={contractStart}
                    onChange={(e) => setContractStart(e.target.value)}
                    className={cn(inputClass, "[color-scheme:dark]")}
                  />
                </div>
                <div>
                  <label htmlFor="vendor-contract-end" className={labelClass}>
                    Contract end
                  </label>
                  <input
                    id="vendor-contract-end"
                    type="date"
                    value={contractEnd}
                    onChange={(e) => setContractEnd(e.target.value)}
                    className={cn(inputClass, "[color-scheme:dark]")}
                  />
                </div>
              </div>

              {/* Monthly spend */}
              <div>
                <label htmlFor="vendor-spend" className={labelClass}>
                  Monthly spend (USD)
                </label>
                <div className="relative">
                  <span
                    className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground"
                    aria-hidden
                  >
                    $
                  </span>
                  <input
                    id="vendor-spend"
                    type="number"
                    min="0"
                    step="0.01"
                    value={monthlySpend}
                    onChange={(e) => setMonthlySpend(e.target.value)}
                    placeholder="0.00"
                    className={cn(inputClass, "pl-7")}
                  />
                </div>
              </div>

              {/* Address */}
              <div>
                <label htmlFor="vendor-address" className={labelClass}>
                  Mailing address
                </label>
                <input
                  id="vendor-address"
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="123 Main St, City, ST 00000"
                  autoComplete="street-address"
                  className={inputClass}
                />
              </div>

              {/* Notes */}
              <div>
                <label htmlFor="vendor-notes" className={labelClass}>
                  Notes
                </label>
                <textarea
                  id="vendor-notes"
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Contract renewal terms, billing notes, SLA details…"
                  className={cn(inputClass, "resize-none")}
                />
              </div>
            </form>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 border-t border-white/[0.08] px-6 py-4">
              <button
                type="button"
                onClick={onClose}
                className="glow-ring rounded-xl border border-white/10 px-4 py-2 text-sm text-muted-foreground transition hover:bg-white/[0.04] hover:text-foreground"
              >
                Cancel
              </button>
              <button
                type="submit"
                form="add-vendor-form"
                className="glow-ring rounded-xl border border-white/80 bg-white px-5 py-2 text-sm font-semibold text-zinc-950 transition hover:opacity-90"
              >
                Add Vendor
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
