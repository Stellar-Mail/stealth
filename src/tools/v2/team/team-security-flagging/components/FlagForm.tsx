/**
 * Team Security Flagging Tool - Flag Form Component
 *
 * Form for creating and editing security flags
 */

import { useState, useId } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type {
  SecurityFlag,
  CreateFlagFormData,
  UpdateFlagFormData,
  FlagCategory,
  FlagSeverity,
} from "../types";
import { CATEGORY_META, SEVERITY_META, VALIDATION_MESSAGES, ARIA_LABELS } from "../constants";
import { announce } from "../utils/accessibility";

interface FlagFormProps {
  flag?: SecurityFlag;
  onSubmit: (data: CreateFlagFormData | UpdateFlagFormData) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
  className?: string;
}

interface FormErrors {
  title?: string;
  description?: string;
  category?: string;
  severity?: string;
}

export function FlagForm({
  flag,
  onSubmit,
  onCancel,
  isLoading = false,
  className,
}: FlagFormProps) {
  const isEdit = !!flag;
  const titleId = useId();
  const descriptionId = useId();
  const categoryId = useId();
  const severityId = useId();
  const tagsId = useId();

  // Form state
  const [formData, setFormData] = useState<CreateFlagFormData>({
    title: flag?.title || "",
    description: flag?.description || "",
    category: flag?.category || "phishing",
    severity: flag?.severity || "medium",
    tags: flag?.tags || [],
  });

  const [errors, setErrors] = useState<FormErrors>({});
  const [tagInput, setTagInput] = useState("");

  // Validation
  const validate = (): boolean => {
    const newErrors: FormErrors = {};

    // Title validation
    if (!formData.title.trim()) {
      newErrors.title = VALIDATION_MESSAGES.titleRequired;
    } else if (formData.title.trim().length < 3) {
      newErrors.title = VALIDATION_MESSAGES.titleTooShort;
    } else if (formData.title.length > 100) {
      newErrors.title = VALIDATION_MESSAGES.titleTooLong;
    }

    // Description validation
    if (!formData.description.trim()) {
      newErrors.description = VALIDATION_MESSAGES.descriptionRequired;
    } else if (formData.description.trim().length < 10) {
      newErrors.description = VALIDATION_MESSAGES.descriptionTooShort;
    }

    // Category validation
    if (!formData.category) {
      newErrors.category = VALIDATION_MESSAGES.categoryRequired;
    }

    // Severity validation
    if (!formData.severity) {
      newErrors.severity = VALIDATION_MESSAGES.severityRequired;
    }

    setErrors(newErrors);

    // Announce errors to screen readers
    if (Object.keys(newErrors).length > 0) {
      const errorCount = Object.keys(newErrors).length;
      announce(
        `Form has ${errorCount} validation error${errorCount !== 1 ? "s" : ""}. Please review and correct.`,
        "assertive",
      );
    }

    return Object.keys(newErrors).length === 0;
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) {
      return;
    }

    try {
      await onSubmit(formData);
      announce(isEdit ? "Flag updated successfully" : "Flag created successfully");
    } catch (error) {
      announce(
        `Error: ${error instanceof Error ? error.message : "Failed to save flag"}`,
        "assertive",
      );
    }
  };

  // Handle tag addition
  const addTag = () => {
    const tag = tagInput.trim();
    if (tag && !formData.tags?.includes(tag)) {
      setFormData({
        ...formData,
        tags: [...(formData.tags || []), tag],
      });
      setTagInput("");
      announce(`Tag "${tag}" added`);
    }
  };

  // Handle tag removal
  const removeTag = (tag: string) => {
    setFormData({
      ...formData,
      tags: formData.tags?.filter((t) => t !== tag),
    });
    announce(`Tag "${tag}" removed`);
  };

  return (
    <form
      onSubmit={handleSubmit}
      className={cn("space-y-6", className)}
      aria-label={isEdit ? "Edit flag form" : "Create flag form"}
      noValidate
    >
      {/* Title */}
      <div className="space-y-2">
        <Label htmlFor={titleId} className="required">
          Title
          <span className="sr-only">(required)</span>
        </Label>
        <Input
          id={titleId}
          type="text"
          value={formData.title}
          onChange={(e) => setFormData({ ...formData, title: e.target.value })}
          placeholder="Brief description of the security concern"
          aria-required="true"
          aria-invalid={!!errors.title}
          aria-describedby={errors.title ? `${titleId}-error` : undefined}
          disabled={isLoading}
          autoFocus
        />
        {errors.title && (
          <p id={`${titleId}-error`} className="text-sm text-destructive" role="alert">
            {errors.title}
          </p>
        )}
      </div>

      {/* Category and Severity - Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Category */}
        <div className="space-y-2">
          <Label htmlFor={categoryId} className="required">
            Category
            <span className="sr-only">(required)</span>
          </Label>
          <Select
            value={formData.category}
            onValueChange={(value) => setFormData({ ...formData, category: value as FlagCategory })}
            disabled={isLoading}
          >
            <SelectTrigger
              id={categoryId}
              aria-required="true"
              aria-invalid={!!errors.category}
              aria-describedby={errors.category ? `${categoryId}-error` : undefined}
              aria-label={ARIA_LABELS.categorySelect}
            >
              <SelectValue placeholder="Select category" />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(CATEGORY_META).map(([key, meta]) => (
                <SelectItem key={key} value={key}>
                  {meta.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.category && (
            <p id={`${categoryId}-error`} className="text-sm text-destructive" role="alert">
              {errors.category}
            </p>
          )}
        </div>

        {/* Severity */}
        <div className="space-y-2">
          <Label htmlFor={severityId} className="required">
            Severity
            <span className="sr-only">(required)</span>
          </Label>
          <Select
            value={formData.severity}
            onValueChange={(value) => setFormData({ ...formData, severity: value as FlagSeverity })}
            disabled={isLoading}
          >
            <SelectTrigger
              id={severityId}
              aria-required="true"
              aria-invalid={!!errors.severity}
              aria-describedby={errors.severity ? `${severityId}-error` : undefined}
              aria-label={ARIA_LABELS.severitySelect}
            >
              <SelectValue placeholder="Select severity" />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(SEVERITY_META).map(([key, meta]) => (
                <SelectItem key={key} value={key}>
                  {meta.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.severity && (
            <p id={`${severityId}-error`} className="text-sm text-destructive" role="alert">
              {errors.severity}
            </p>
          )}
        </div>
      </div>

      {/* Description */}
      <div className="space-y-2">
        <Label htmlFor={descriptionId} className="required">
          Description
          <span className="sr-only">(required)</span>
        </Label>
        <Textarea
          id={descriptionId}
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          placeholder="Provide detailed information about this security flag..."
          rows={6}
          aria-required="true"
          aria-invalid={!!errors.description}
          aria-describedby={errors.description ? `${descriptionId}-error` : undefined}
          disabled={isLoading}
        />
        {errors.description && (
          <p id={`${descriptionId}-error`} className="text-sm text-destructive" role="alert">
            {errors.description}
          </p>
        )}
        <p className="text-xs text-muted-foreground">Minimum 10 characters</p>
      </div>

      {/* Tags */}
      <div className="space-y-2">
        <Label htmlFor={tagsId}>Tags (optional)</Label>
        <div className="flex gap-2">
          <Input
            id={tagsId}
            type="text"
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addTag();
              }
            }}
            placeholder="Add tags..."
            disabled={isLoading}
            aria-label="Add tags to categorize this flag"
          />
          <Button
            type="button"
            variant="outline"
            onClick={addTag}
            disabled={!tagInput.trim() || isLoading}
            aria-label="Add tag"
          >
            Add
          </Button>
        </div>

        {/* Tag list */}
        {formData.tags && formData.tags.length > 0 && (
          <div className="flex flex-wrap gap-2" role="list" aria-label="Current tags">
            {formData.tags.map((tag) => (
              <span
                key={tag}
                role="listitem"
                className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-sm bg-muted text-muted-foreground"
              >
                {tag}
                <button
                  type="button"
                  onClick={() => removeTag(tag)}
                  className="hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
                  aria-label={`Remove tag ${tag}`}
                  disabled={isLoading}
                >
                  <X className="size-3" aria-hidden="true" />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Form actions */}
      <div className="flex gap-2 pt-4 border-t">
        <Button
          type="submit"
          disabled={isLoading}
          aria-label={isEdit ? "Update flag" : "Create flag"}
        >
          {isLoading ? "Saving..." : isEdit ? "Update Flag" : "Create Flag"}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={isLoading}
          aria-label="Cancel"
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
